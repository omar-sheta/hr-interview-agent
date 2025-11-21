"""
Admin router.

Endpoints for admin dashboard (interview management, results).
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..models.schemas import (
    AdminInterviewCreateRequest,
    AdminInterviewUpdateRequest,
    RefineQuestionRequest,
    ReorderQuestionsRequest
)
from ..services.auth_service import require_admin
from ..data_manager import data_manager
from ..utils.helpers import normalize_ids, get_local_ip
from ..services.email_service import email_service
from ..services.email_templates import get_invite_email, get_status_update_email
import logging

logger = logging.getLogger("hr_interview_agent.admin")

router = APIRouter()


@router.get("/api/admin/interviews")
async def list_admin_interviews(admin_id: str = Query(..., description="Admin user id")):
    """List all interviews for the admin dashboard."""
    require_admin(admin_id)
    return {"interviews": data_manager.load_interviews()}


@router.post("/api/admin/interviews")
async def create_admin_interview(request: AdminInterviewCreateRequest):
    """Create a new interview definition with optional AI question generation."""
    require_admin(request.admin_id)
    interviews = data_manager.load_interviews()
    
    # Start with the provided config or empty dict
    config = request.config or {}
    
    # If AI generation is requested, generate questions
    if request.use_ai_generation and (request.job_role or request.job_description):
        try:
            from ..services.question_service import build_questions_payload
            from ..models.schemas import GenerateRequest
            
            logger.info(f"🤖 Generating {request.num_questions} questions with AI")
            gen_request = GenerateRequest(
                job_role=request.job_role,
                job_description=request.job_description or request.description,
                num_questions=request.num_questions,
                model="gemma3:27b",
                temperature=0.7
            )
            
            payload = build_questions_payload(gen_request)
            questions = payload.get("questions", [])
            
            if questions:
                config["questions"] = questions
                config["ai_generated"] = True
                config["source"] = payload.get("source", "unknown")
                logger.info(f"✅ Generated {len(questions)} questions")
            else:
                logger.warning("❌ No questions generated, using empty list")
                config["questions"] = []
        except Exception as e:
            logger.error(f"❌ AI generation failed: {e}")
            # Continue with interview creation even if AI generation fails
            config["questions"] = []
            config["ai_generation_error"] = str(e)
    
    new_interview = {
        "id": f"int-{uuid.uuid4()}",
        "title": request.title,
        "description": request.description,
        "config": config,
        "allowed_candidate_ids": normalize_ids(request.allowed_candidate_ids),
        "active": bool(request.active),
        "created_by": request.admin_id,
        "created_at": datetime.now().isoformat(),
    }
    interviews.append(new_interview)
    data_manager.save_interviews(interviews)
    
    # Send invite emails to newly assigned candidates
    try:
        if request.allowed_candidate_ids:
            logger.info(f"📨 Attempting to send emails to {len(request.allowed_candidate_ids)} candidates")
            # Get candidate details
            candidates = data_manager.get_users_by_ids(request.allowed_candidate_ids)
            logger.info(f"📨 Found {len(candidates)} candidate records")
            
            # Determine base URL
            local_ip = get_local_ip()
            base_url = f"https://{local_ip}:5173"
            
            for candidate in candidates:
                if candidate.get("email"):
                    logger.info(f"📨 Sending email to {candidate.get('email')}")
                    email_content = get_invite_email(
                        candidate_name=candidate.get("username"),
                        interview_title=new_interview["title"],
                        interview_link=f"{base_url}/login",
                        deadline=request.deadline
                    )
                    result = email_service.send_email(
                        to_email=candidate["email"],
                        subject=f"Interview Invitation: {new_interview['title']}",
                        html_content=email_content
                    )
                    logger.info(f"📨 Email send result: {result}")
                else:
                    logger.info(f"📨 No email found for candidate: {candidate.get('username')}")
    except Exception as e:
        # Log error but don't fail the request
        logger.error(f"❌ Failed to send invite emails: {e}")
        import traceback
        traceback.print_exc()

    return {"interview": new_interview}


@router.put("/api/admin/interviews/{interview_id}")
async def update_admin_interview(interview_id: str, request: AdminInterviewUpdateRequest):
    """Update interview details."""
    logger.info(f"🔄 update_admin_interview called for {interview_id}")
    require_admin(request.admin_id)
    interviews = data_manager.load_interviews()
    updated = None
    old_candidate_ids = set()
    
    for idx, interview in enumerate(interviews):
        if str(interview.get("id")) == str(interview_id):
            # Capture old candidates before update
            old_candidate_ids = set(interview.get("allowed_candidate_ids", []))
            
            updated = dict(interview)
            if request.title is not None:
                updated["title"] = request.title
            if request.description is not None:
                updated["description"] = request.description
            if request.config is not None:
                updated["config"] = request.config
            if request.allowed_candidate_ids is not None:
                updated["allowed_candidate_ids"] = normalize_ids(request.allowed_candidate_ids)
            if request.active is not None:
                updated["active"] = bool(request.active)
            updated["updated_at"] = datetime.now().isoformat()
            interviews[idx] = updated
            break
            
    if not updated:
        raise HTTPException(status_code=404, detail="Interview not found")
    data_manager.save_interviews(interviews)
    
    # Calculate newly added candidates
    new_candidate_ids = set(updated.get("allowed_candidate_ids", []))
    added_candidate_ids = list(new_candidate_ids - old_candidate_ids)
    
    logger.info(f"DEBUG: Old IDs: {old_candidate_ids}")
    logger.info(f"DEBUG: New IDs: {new_candidate_ids}")
    logger.info(f"DEBUG: Added IDs: {added_candidate_ids}")

    if added_candidate_ids:
        logger.info(f"📨 Sending emails to {len(added_candidate_ids)} newly added candidates")
        candidates = data_manager.get_users_by_ids(added_candidate_ids)
        
        # Determine base URL
        local_ip = get_local_ip()
        base_url = f"https://{local_ip}:5173"
        
        for candidate in candidates:
            if candidate.get("email"):
                logger.info(f"📨 Sending invite to {candidate.get('email')}")
                email_content = get_invite_email(
                    candidate_name=candidate.get("username"), 
                    interview_title=updated["title"], 
                    interview_link=f"{base_url}/login",
                    deadline=updated.get("deadline")
                )
                email_service.send_email(
                    to_email=candidate["email"], 
                    subject=f"Interview Invitation: {updated['title']}", 
                    html_content=email_content
                )
            else:
                logger.info(f"DEBUG: Candidate {candidate.get('username')} has no email")

    return {"interview": updated}


@router.get("/api/admin/interviews/{interview_id}/results")
async def get_admin_interview_results(
    interview_id: str,
    admin_id: str = Query(..., description="Admin user id"),
):
    """Return results for a specific interview."""
    require_admin(admin_id)
    results = [
        result for result in data_manager.load_results()
        if str(result.get("interview_id")) == str(interview_id)
    ]
    return {"results": results}


@router.get("/api/admin/results")
async def list_admin_results(
    admin_id: str = Query(..., description="Admin user id"),
    candidate_id: Optional[str] = Query(None),
    interview_id: Optional[str] = Query(None),
):
    """Return all completed interview results with optional filtering."""
    require_admin(admin_id)
    results = data_manager.load_results()
    if candidate_id:
        results = [r for r in results if str(r.get("candidate_id")) == str(candidate_id)]
    if interview_id:
        results = [r for r in results if str(r.get("interview_id")) == str(interview_id)]
    return {"results": results}


@router.put("/api/admin/results/{session_id}")
async def update_admin_result(
    session_id: str,
    admin_id: str = Query(..., description="Admin user id"),
    status: str = Query(..., description="Status label e.g., pending/rejected/accepted"),
    result_id: Optional[str] = Query(None, description="Optional result id"),
):
    """Allow admins to update the review status of a completed interview."""
    require_admin(admin_id)
    if status not in {"pending", "rejected", "accepted"}:
        raise HTTPException(status_code=400, detail="Invalid status value")
    results = data_manager.load_results()
    target_index = None
    for index, result in enumerate(results):
        if result.get("session_id") == session_id or (
            result_id and result.get("id") == result_id
        ):
            target_index = index
            break
    if target_index is None:
        raise HTTPException(status_code=404, detail="Result not found")
    
    # Update status
    results[target_index]["status"] = status
    data_manager.save_results(results)
    
    # Send email notification to candidate
    try:
        result = results[target_index]
        candidate_id = result.get("candidate_id")
        interview_id = result.get("interview_id")
        
        if candidate_id and interview_id:
            # Get candidate and interview details
            candidate = data_manager.get_user_by_id(candidate_id)
            interviews = data_manager.load_interviews()
            interview = next((i for i in interviews if i.get("id") == interview_id), None)
            
            if candidate and candidate.get("email") and interview:
                print(f"📨 Sending status update email to {candidate.get('email')} - Status: {status}")
                email_content = get_status_update_email(
                    candidate_name=candidate.get("username"),
                    interview_title=interview.get("title"),
                    status=status,
                    score=result.get("average_score")
                )
                email_result = email_service.send_email(
                    to_email=candidate["email"],
                    subject=f"Interview Status Update: {interview.get('title')}",
                    html_content=email_content
                )
                print(f"📨 Status email send result: {email_result}")
    except Exception as e:
        print(f"❌ Failed to send status update email: {e}")
        import traceback
        traceback.print_exc()
    
    return {"session_id": session_id, "status": status}


@router.post("/api/admin/results/{session_id}/accept")
async def accept_result(
    session_id: str,
    admin_id: str = Query(..., description="Admin user id"),
):
    """Accept a candidate's interview result and send acceptance email."""
    require_admin(admin_id)
    
    results = data_manager.load_results()
    target_index = None
    for index, result in enumerate(results):
        if result.get("session_id") == session_id:
            target_index = index
            break
    
    if target_index is None:
        raise HTTPException(status_code=404, detail="Result not found")
    
    # Update status to accepted
    results[target_index]["status"] = "accepted"
    data_manager.save_results(results)
    
    # Send acceptance email
    try:
        result = results[target_index]
        candidate_id = result.get("candidate_id")
        interview_id = result.get("interview_id")
        
        if candidate_id and interview_id:
            candidate = data_manager.get_user_by_id(candidate_id)
            interviews = data_manager.load_interviews()
            interview = next((i for i in interviews if i.get("id") == interview_id), None)
            
            if candidate and candidate.get("email") and interview:
                logger.info(f"📨 Sending acceptance email to {candidate.get('email')}")
                email_content = get_status_update_email(
                    candidate_name=candidate.get("username"),
                    interview_title=interview.get("title"),
                    status="accepted",
                    score=result.get("average_score")
                )
                email_result = email_service.send_email(
                    to_email=candidate["email"],
                    subject=f"Congratulations! Interview Accepted: {interview.get('title')}",
                    html_content=email_content
                )
                logger.info(f"📨 Acceptance email sent: {email_result}")
                return {"session_id": session_id, "status": "accepted", "email_sent": True}
    except Exception as e:
        logger.error(f"❌ Failed to send acceptance email: {e}")
        import traceback
        traceback.print_exc()
        return {"session_id": session_id, "status": "accepted", "email_sent": False}
    
    return {"session_id": session_id, "status": "accepted", "email_sent": False}


@router.post("/api/admin/results/{session_id}/reject")
async def reject_result(
    session_id: str,
    admin_id: str = Query(..., description="Admin user id"),
):
    """Reject a candidate's interview result and send rejection email."""
    require_admin(admin_id)
    
    results = data_manager.load_results()
    target_index = None
    for index, result in enumerate(results):
        if result.get("session_id") == session_id:
            target_index = index
            break
    
    if target_index is None:
        raise HTTPException(status_code=404, detail="Result not found")
    
    # Update status to rejected
    results[target_index]["status"] = "rejected"
    data_manager.save_results(results)
    
    # Send rejection email
    try:
        result = results[target_index]
        candidate_id = result.get("candidate_id")
        interview_id = result.get("interview_id")
        
        if candidate_id and interview_id:
            candidate = data_manager.get_user_by_id(candidate_id)
            interviews = data_manager.load_interviews()
            interview = next((i for i in interviews if i.get("id") == interview_id), None)
            
            if candidate and candidate.get("email") and interview:
                logger.info(f"📨 Sending rejection email to {candidate.get('email')}")
                email_content = get_status_update_email(
                    candidate_name=candidate.get("username"),
                    interview_title=interview.get("title"),
                    status="rejected",
                    score=result.get("average_score")
                )
                email_result = email_service.send_email(
                    to_email=candidate["email"],
                    subject=f"Interview Status Update: {interview.get('title')}",
                    html_content=email_content
                )
                logger.info(f"📨 Rejection email sent: {email_result}")
                return {"session_id": session_id, "status": "rejected", "email_sent": True}
    except Exception as e:
        logger.error(f"❌ Failed to send rejection email: {e}")
        import traceback
        traceback.print_exc()
        return {"session_id": session_id, "status": "rejected", "email_sent": False}
    
    return {"session_id": session_id, "status": "rejected", "email_sent": False}



@router.delete("/api/admin/interviews/{interview_id}")
async def delete_admin_interview(
    interview_id: str,
    admin_id: str = Query(..., description="Admin user id"),
):
    """Delete an interview."""
    require_admin(admin_id)
    if data_manager.delete_interview(interview_id):
        return {"message": "Interview deleted successfully", "interview_id": interview_id}
    raise HTTPException(status_code=404, detail="Interview not found")


@router.delete("/api/admin/results/{session_id}")
async def delete_admin_result(
    session_id: str,
    admin_id: str = Query(..., description="Admin user id"),
):
    """Delete a result by session ID."""
    require_admin(admin_id)
    if data_manager.delete_result(session_id):
        return {"message": "Result deleted successfully", "session_id": session_id}
    raise HTTPException(status_code=404, detail="Result not found")


@router.get("/api/admin/analytics")
async def get_admin_analytics(admin_id: str = Query(..., description="Admin user id")):
    """Return analytics data for the dashboard."""
    require_admin(admin_id)
    
    from datetime import datetime, timedelta
    
    interviews = data_manager.load_interviews()
    results = data_manager.load_results()
    users = data_manager.load_users()
    
    total_interviews = len(interviews)
    total_candidates = len([u for u in users if u.get("role") == "candidate"])
    completed_interviews = len(results)
    
    # Calculate completion rate (simplified: completed / (invited candidates * active interviews))
    # This is a rough approximation. A better one would be based on actual invites.
    # For now, let's use completed / total results (which doesn't make sense)
    # Let's use: completed sessions / total unique candidates invited to active interviews
    
    # Better metric: Pass rate
    passed_count = len([r for r in results if r.get("status") == "accepted"])
    pass_rate = (passed_count / completed_interviews * 100) if completed_interviews > 0 else 0
    
    # Average Score
    total_score = 0
    score_count = 0
    for r in results:
        scores = r.get("scores", {})
        if isinstance(scores, dict):
            # Assuming scores are 0-10 or similar. Let's just average the values found.
            vals = [v for v in scores.values() if isinstance(v, (int, float))]
            if vals:
                total_score += sum(vals) / len(vals)
                score_count += 1
    avg_score = (total_score / score_count) if score_count > 0 else 0
    
    # Calculate completion_over_time for last 7 days
    today = datetime.now().date()
    last_7_days = []
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    for i in range(6, -1, -1):  # 6 days ago to today
        day = today - timedelta(days=i)
        day_name = day_names[day.weekday()]
        
        # Count results completed on this day
        count = 0
        for r in results:
            completed_at = r.get("completed_at")
            if completed_at:
                try:
                    # Parse the timestamp
                    if isinstance(completed_at, str):
                        result_date = datetime.fromisoformat(completed_at.replace('Z', '+00:00')).date()
                    else:
                        result_date = datetime.fromtimestamp(completed_at).date()
                    
                    if result_date == day:
                        count += 1
                except Exception as e:
                    logger.warning(f"Failed to parse completed_at: {completed_at}, error: {e}")
                    continue
        
        last_7_days.append({"name": day_name, "value": count})
    
    return {
        "metrics": [
            {"label": "Total Interviews", "value": str(total_interviews), "trend": "+0", "trendUp": True},
            {"label": "Total Candidates", "value": str(total_candidates), "trend": "+0", "trendUp": True},
            {"label": "Completed Sessions", "value": str(completed_interviews), "trend": "+0", "trendUp": True},
            {"label": "Avg. Score", "value": f"{avg_score:.1f}/10", "trend": "+0", "trendUp": True},
        ],
        "funnel": [
            {"name": "Total Candidates", "value": total_candidates, "color": "#2196F3"},
            {"name": "Completed", "value": completed_interviews, "color": "#4CAF50"},
            {"name": "Passed", "value": passed_count, "color": "#FFC107"},
            {"name": "Hired", "value": passed_count, "color": "#FF9800"}, # Assuming Passed = Hired for now
        ],
        "completion_over_time": last_7_days
    }


@router.get("/api/admin/candidates")
async def list_admin_candidates(admin_id: str = Query(..., description="Admin user id")):
    """Return list of candidates with their status."""
    require_admin(admin_id)
    
    users = data_manager.load_users()
    results = data_manager.load_results()
    
    candidates = []
    for user in users:
        if user.get("role") != "candidate":
            continue
            
        # Find latest result for status
        user_results = [r for r in results if str(r.get("candidate_id")) == str(user.get("id"))]
        status = "Pending"
        if user_results:
            # Sort by date desc
            user_results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            last_result = user_results[0]
            status = last_result.get("status", "Interviewed").capitalize()
            if status == "Pending": status = "Interviewed" # If result exists, they interviewed
            
        candidates.append({
            "id": user.get("id"),
            "name": user.get("username"),
            "email": user.get("email") or "No email",
            "role": "Candidate", # Placeholder role
            "status": status,
            "img": user.get("avatar_url") or f"https://ui-avatars.com/api/?name={user.get('username')}"
        })
        
    return {"candidates": candidates}


@router.delete("/api/admin/candidates/{user_id}")
async def delete_admin_candidate(
    user_id: str,
    admin_id: str = Query(..., description="Admin user id"),
):
    """Delete a candidate."""
    require_admin(admin_id)
    if data_manager.delete_user(user_id):
        return {"message": "Candidate deleted successfully", "user_id": user_id}
    raise HTTPException(status_code=404, detail="Candidate not found")


@router.post("/api/admin/interviews/{interview_id}/refine-question")
async def refine_question(interview_id: str, request: RefineQuestionRequest):
    """Refine a specific question in an interview using AI."""
    require_admin(request.admin_id)
    
    # Get the interview
    interview = data_manager.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Get questions from config
    config = interview.get("config", {})
    questions = config.get("questions", [])
    
    if request.question_index < 0 or request.question_index >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index")
    
    original_question = questions[request.question_index]
    
    # Use AI to refine the question
    try:
        import requests
        from ..config import settings
        
        context = ""
        if interview.get("description"):
            context += f"Interview: {interview.get('description')}. "
        
        prompt = (
            f"{context}You are an expert at refining interview questions. "
            f"Your task is to edit the following interview question based on the instruction provided. "
            f"Return only the single, edited question, without any preamble or explanation.\\n\\n"
            f"Original Question: \\\"{original_question}\\\"\\n"
            f"Instruction: \\\"{request.refinement_instruction}\\\"\\n\\n"
            f"Edited Question:"
        )
        
        response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={
                "model": request.model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": request.temperature, "num_predict": 200}
            },
            timeout=60
        )
        
        if response.status_code == 200:
            content = response.json().get("message", {}).get("content", "").strip()
            # Clean the response
            refined_question = content.split('\\n')[0].strip()
            if refined_question.startswith('"') and refined_question.endswith('"'):
                refined_question = refined_question[1:-1]
            
            if not refined_question:
                raise ValueError("AI returned an empty response")
            
            # Update the question
            questions[request.question_index] = refined_question
            config["questions"] = questions
            interview["config"] = config
            
            # Save the interview
            interviews = data_manager.load_interviews()
            for idx, i in enumerate(interviews):
                if i.get("id") == interview_id:
                    interviews[idx] = interview
                    break
            data_manager.save_interviews(interviews)
            
            logger.info(f"✅ Refined question {request.question_index} in interview {interview_id}")
            
            return {
                "interview": interview,
                "refined_question": refined_question,
                "original_question": original_question
            }
        else:
            raise HTTPException(status_code=500, detail=f"AI refinement failed: {response.text}")
            
    except Exception as e:
        logger.error(f"❌ Failed to refine question: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refine question: {str(e)}")


@router.post("/api/admin/interviews/{interview_id}/reorder-questions")
async def reorder_questions(interview_id: str, request: ReorderQuestionsRequest):
    """Reorder questions in an interview."""
    require_admin(request.admin_id)
    
    # Get the interview
    interview = data_manager.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Get questions from config
    config = interview.get("config", {})
    questions = config.get("questions", [])
    
    # Validate the new order
    if len(request.new_order) != len(questions):
        raise HTTPException(
            status_code=400,
            detail=f"New order must have {len(questions)} indices, got {len(request.new_order)}"
        )
    
    if set(request.new_order) != set(range(len(questions))):
        raise HTTPException(
            status_code=400,
            detail="New order must contain all indices from 0 to n-1 exactly once"
        )
    
    # Reorder the questions
    try:
        reordered_questions = [questions[i] for i in request.new_order]
        config["questions"] = reordered_questions
        interview["config"] = config
        
        # Save the interview
        interviews = data_manager.load_interviews()
        for idx, i in enumerate(interviews):
            if i.get("id") == interview_id:
                interviews[idx] = interview
                break
        data_manager.save_interviews(interviews)
        
        logger.info(f"✅ Reordered questions in interview {interview_id}")
        
        return {
            "interview": interview,
            "new_order": request.new_order,
            "questions": reordered_questions
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to reorder questions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reorder questions: {str(e)}")

