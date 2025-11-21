"""
Admin router.

Endpoints for admin dashboard (interview management, results).
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Optional
from pathlib import Path

from ..models.schemas import (
    AdminInterviewCreateRequest,
    AdminInterviewUpdateRequest,
    RefineQuestionRequest,
    ReorderQuestionsRequest,
    GenerateRequest
)
from ..services.question_service import build_questions_payload
from ..services.auth_service import require_admin
from ..data_manager import data_manager
from ..utils.helpers import normalize_ids, get_local_ip
from ..services.email_service import email_service
from ..services.email_templates import get_invite_email, get_status_update_email
import logging

logger = logging.getLogger("hr_interview_agent.admin")

router = APIRouter()


@router.get("/api/interviews/{interview_id}/audio/{question_index}")
async def get_question_audio(interview_id: str, question_index: int):
    """
    Serve pre-generated TTS audio for a specific question.
    Returns 404 if audio file doesn't exist.
    """
    try:
        from ..services.tts_audio_service import get_audio_path
        audio_path = get_audio_path(interview_id, question_index)
        
        if audio_path and audio_path.exists():
            return FileResponse(
                audio_path,
                media_type="audio/wav",
                headers={
                    "Cache-Control": "public, max-age=604800",  # Cache for 1 week
                    "Content-Disposition": f"inline; filename=q{question_index}.wav"
                }
            )
        else:
            raise HTTPException(status_code=404, detail="Audio file not found")
    except Exception as e:
        logger.error(f"❌ Error serving audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/admin/interviews")
async def list_admin_interviews(admin_id: str = Query(..., description="Admin user id")):
    """List all interviews for the admin dashboard."""
    require_admin(admin_id)
    return {"interviews": data_manager.load_interviews()}


@router.post("/api/admin/generate-questions")
async def generate_questions(request: GenerateRequest):
    """Generate interview questions using AI."""
    try:
        logger.info(f"🤖 Generating questions for role: {request.job_role}")
        payload = build_questions_payload(request)
        return payload
    except Exception as e:
        logger.error(f"❌ Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/admin/refine-question")
async def refine_question(
    admin_id: str = Query(..., description="Admin user ID"),
    question: str = Query(..., description="Question to refine"),
    job_role: str = Query(None, description="Job role for context"),
    job_description: str = Query(None, description="Job description for context"),
    instruction: str = Query(None, description="Custom refinement instruction"),
):
    """Refine a single question using AI."""
    require_admin(admin_id)
    try:
        logger.info(f"✨ Refining question: {question[:50]}...")
        
        # Build prompt based on user instruction or default
        base_instruction = instruction or "Refine and improve this interview question to make it more specific, clear, and effective"
        
        # Construct a very clear prompt for the AI
        prompt_context = f"""
*** TASK: REFINE INTERVIEW QUESTION ***
ORIGINAL QUESTION: "{question}"
INSTRUCTION: {base_instruction}
JOB CONTEXT: {job_description or 'General Role'}

ACTION: Rewrite the original question to follow the instruction. 
REQUIREMENTS:
1. The output must be a single, high-quality interview question.
2. Do not include explanations, prefixes, or suffixes.
3. Do not output multiple options, just the best one.
"""

        # Build a request to generate one improved question
        refine_request = GenerateRequest(
            job_role=job_role or "Refinement Task",
            job_description=prompt_context,
            num_questions=1,
            use_ai_generation=True
        )
        
        payload = build_questions_payload(refine_request)
        questions = payload.get("questions", [])
        
        if questions and len(questions) > 0:
            refined = questions[0]
            logger.info(f"✅ Question refined successfully")
            return {"refined_question": refined}
        else:
            raise HTTPException(status_code=500, detail="Failed to generate refined question")
            
    except Exception as e:
        logger.error(f"❌ Refinement failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    
    # Generate TTS audio for all questions
    try:
        questions = config.get("questions", [])
        if questions:
            from ..services.tts_audio_service import generate_interview_audio
            logger.info(f"🎤 Generating TTS audio for {len(questions)} questions")
            audio_files = generate_interview_audio(new_interview["id"], questions)
            
            # Update interview config with audio files
            new_interview["config"]["audio_files"] = audio_files
            data_manager.save_interviews(interviews)
            logger.info(f"✅ Generated {len([f for f in audio_files if f])} audio files")
    except Exception as e:
        logger.error(f"❌ Failed to generate TTS audio: {e}")
        # Continue without audio files
    
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
    
    logger.info(f"🔍 Old IDs: {old_candidate_ids}")
    logger.info(f"🔍 New IDs: {new_candidate_ids}")
    logger.info(f"🔍 Added IDs: {added_candidate_ids}")

    # Send emails to newly added candidates
    try:
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
                    result = email_service.send_email(
                        to_email=candidate["email"], 
                        subject=f"Interview Invitation: {updated['title']}", 
                        html_content=email_content
                    )
                    logger.info(f"📨 Email send result: {result}")
                else:
                    logger.info(f"⚠️  Candidate {candidate.get('username')} has no email")
        else:
            logger.info("ℹ️  No new candidates added - no emails to send")
    except Exception as e:
        logger.error(f"❌ Failed to send invite emails to new candidates: {e}")
        import traceback
        traceback.print_exc()

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
    
    # Helper to calculate score from feedback
    def calculate_score(result):
        if result.get("overall_score") and result.get("overall_score") > 0:
            return result.get("overall_score")
        if result.get("score") and result.get("score") > 0:
            return result.get("score")
            
        feedback = result.get("feedback", [])
        # Handle string feedback (if JSON wasn't parsed)
        if isinstance(feedback, str):
            try:
                import json
                feedback = json.loads(feedback)
            except:
                feedback = []

        if feedback and isinstance(feedback, list) and len(feedback) > 0:
            total = 0
            count = 0
            for item in feedback:
                if isinstance(item, dict):
                    val = item.get("score") or item.get("overall")
                    if val is not None:
                        total += float(val)
                        count += 1
            if count > 0:
                return round(total / count, 1)
        return 0

    # Update results with calculated score if missing
    for r in results:
        if not r.get("overall_score") or r.get("overall_score") == 0:
            r["overall_score"] = calculate_score(r)
            if r.get("candidate_username") == "youssef":
                print(f"DEBUG: Calculated score for youssef: {r['overall_score']}")
                print(f"DEBUG: Feedback length: {len(r.get('feedback', []))}")

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


@router.post("/api/admin/interviews/{interview_id}/recommend")
async def get_interview_recommendations(
    interview_id: str,
    admin_id: str = Query(..., description="Admin user id"),
    regenerate: bool = Query(False, description="Force regenerate recommendations"),
):
    """Get AI recommendations for all candidates in an interview."""
    require_admin(admin_id)
    
    # Get interview
    interviews = data_manager.load_interviews()
    interview = next((i for i in interviews if str(i.get("id")) == str(interview_id)), None)
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Check if we have saved recommendations and don't need to regenerate
    if not regenerate and interview.get("ai_recommendation"):
        logger.info(f"Returning saved AI recommendations for interview {interview_id}")
        return interview["ai_recommendation"]
    
    # Get all results for this interview
    results = data_manager.load_results()
    interview_results = [r for r in results if str(r.get("interview_id")) == str(interview_id)]
    
    if not interview_results:
        raise HTTPException(status_code=404, detail="No completed interviews found")
    
    # Get candidate info
    users = data_manager.load_users()
    
    # Build candidate summaries with feedback
    candidate_summaries = []
    for result in interview_results:
        # Get score correctly
        scores = result.get("scores", {})
        if isinstance(scores, dict):
            score = scores.get("overall", 0) or scores.get("average", 0)
        else:
            score = result.get("overall_score", 0) or result.get("score", 0)
        
        candidate_id = result.get("candidate_id")
        candidate = next((u for u in users if str(u.get("id")) == str(candidate_id)), None)
        candidate_name = result.get("candidate_username") or (candidate.get("username") if candidate else "Unknown")
        
        # Get feedback summary
        feedback = result.get("feedback", [])
        feedback_text = ""
        if isinstance(feedback, list) and len(feedback) > 0:
            positive_items = []
            negative_items = []
            for item in feedback[:3]:  # Top 3 questions
                if isinstance(item, dict):
                    q_score = item.get("score", 0)
                    q_feedback = item.get("feedback", "")
                    if q_score >= 7:
                        positive_items.append(f"Strong answer (Score: {q_score})")
                    elif q_score < 5:
                        negative_items.append(f"Weak answer (Score: {q_score}): {q_feedback[:50]}")
            
            if positive_items:
                feedback_text += "Strengths: " + ", ".join(positive_items[:2])
            if negative_items:
                if feedback_text:
                    feedback_text += " | "
                feedback_text += "Weaknesses: " + ", ".join(negative_items[:2])
        
        candidate_summaries.append({
            "name": candidate_name,
            "score": score,
            "session_id": result.get("session_id"),
            "status": result.get("status", "pending"),
            "feedback": feedback_text
        })
    
    # Sort by score descending
    candidate_summaries.sort(key=lambda x: x["score"], reverse=True)
    
    # Build summary text for AI with feedback
    candidates_text = "\n".join([
        f"- {c['name']}: Score {c['score']:.1f}/10 (Status: {c['status']}){' - ' + c['feedback'] if c['feedback'] else ''}"
        for c in candidate_summaries
    ])
    
    # Construct prompt
    prompt = f"""You are an HR recruitment assistant analyzing candidates for a position.

Interview Position: {interview.get('title')}
Total Candidates: {len(candidate_summaries)}

Candidate Performance Summary:
{candidates_text}

Based on these results, provide hiring recommendations:

1. TOP CANDIDATES: List 1-3 candidates recommended for ACCEPTANCE (with brief reason based on their scores and feedback)
2. CONCERNS: Any candidates with concerning performance (mention specific weaknesses)
3. OVERALL INSIGHT: One sentence about the candidate pool quality

Format your response EXACTLY as:
TOP CANDIDATES:
[List here]

CONCERNS:
[List here]

OVERALL INSIGHT:
[Your insight]"""

    try:
        import requests
        from ..config import settings
        
        response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": "gemma3:27b",
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.4}
            },
            timeout=45
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="AI service unavailable")
        
        ai_response = response.json().get("response", "")
        
        # Parse sections
        top_candidates = ""
        concerns = ""
        insight = ""
        
        if "TOP CANDIDATES:" in ai_response:
            parts = ai_response.split("CONCERNS:")
            top_part = parts[0].replace("TOP CANDIDATES:", "").strip()
            top_candidates = top_part
            
            if len(parts) > 1:
                concern_parts = parts[1].split("OVERALL INSIGHT:")
                concerns = concern_parts[0].strip()
                if len(concern_parts) > 1:
                    insight = concern_parts[1].strip()
        
        result = {
            "interview_id": interview_id,
            "interview_title": interview.get("title"),
            "total_candidates": len(candidate_summaries),
            "candidates": candidate_summaries,
            "recommendations": {
                "top_candidates": top_candidates,
                "concerns": concerns,
                "overall_insight": insight
            },
            "avg_score": sum(c["score"] for c in candidate_summaries) / len(candidate_summaries) if candidate_summaries else 0,
            "generated_at": datetime.now().isoformat()
        }
        
        # Save to database
        data_manager.update_interview_recommendation(interview_id, result)
        logger.info(f"Saved AI recommendations for interview {interview_id}")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to get interview recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendations: {str(e)}")




@router.get("/api/admin/dashboard-stats")
async def get_admin_dashboard_stats(admin_id: str = Query(..., description="Admin user id")):
    """Return key stats for the admin dashboard."""
    require_admin(admin_id)
    
    interviews = data_manager.load_interviews()
    results = data_manager.load_results()
    users = data_manager.load_users()
    
    total_interviews = len(interviews)
    total_candidates = len([u for u in users if u.get("role") == "candidate"])
    completed_interviews = len(results)
    
    return {
        "total_interviews": total_interviews,
        "completed_interviews": completed_interviews,
        "total_candidates": total_candidates,
    }


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
        # Try to get score from overall_score, score, or feedback
        score = 0
        if r.get("overall_score") and r.get("overall_score") > 0:
            score = r.get("overall_score")
        elif r.get("score") and r.get("score") > 0:
            score = r.get("score")
        elif r.get("feedback"):
            feedback = r.get("feedback")
            if isinstance(feedback, list) and len(feedback) > 0:
                f_total = 0
                f_count = 0
                for item in feedback:
                    if isinstance(item, dict):
                        val = item.get("score") or item.get("overall")
                        if val is not None:
                            f_total += float(val)
                            f_count += 1
                if f_count > 0:
                    score = f_total / f_count
        
        if score > 0:
            total_score += score
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
            completed_at = r.get("completed_at") or r.get("timestamp")
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
    
    # Get pending reviews (status is 'completed' or 'pending')
    pending_reviews = []
    for r in results:
        if r.get("status") in ["completed", "pending"]:
            # Find candidate name if not in result
            candidate_name = r.get("candidate_username")
            if not candidate_name:
                candidate = next((u for u in users if str(u.get("id")) == str(r.get("candidate_id"))), None)
                candidate_name = candidate.get("username") if candidate else "Unknown"
                
            pending_reviews.append({
                "id": r.get("session_id"),
                "candidate": candidate_name,
                "interview": r.get("interview_title"),
                "submitted_at": r.get("timestamp") or r.get("completed_at"),
                "score": r.get("scores", {}).get("average") or r.get("overall_score") or 0
            })
    
    # Sort by date desc
    pending_reviews.sort(key=lambda x: x.get("submitted_at") or "", reverse=True)

    # Calculate unique candidates for funnel
    # Only count candidates that currently exist in the users list
    existing_candidate_ids = set(str(u.get("id")) for u in users if u.get("role") == "candidate")
    
    unique_completed_candidates = set()
    unique_passed_candidates = set()
    
    for r in results:
        c_id = str(r.get("candidate_id"))
        if c_id in existing_candidate_ids:
            unique_completed_candidates.add(c_id)
            if r.get("status") == "accepted":
                unique_passed_candidates.add(c_id)
            
    unique_completed_count = len(unique_completed_candidates)
    unique_passed_count = len(unique_passed_candidates)

    return {
        "metrics": [
            {"label": "Total Interviews", "value": str(total_interviews), "trend": "+0", "trendUp": True},
            {"label": "Total Candidates", "value": str(total_candidates), "trend": "+0", "trendUp": True},
            {"label": "Completed Sessions", "value": str(completed_interviews), "trend": "+0", "trendUp": True},
            {"label": "Avg. Score", "value": f"{avg_score:.1f}/10", "trend": "+0", "trendUp": True},
        ],
        "funnel": [
            {"name": "Total Candidates", "value": total_candidates, "color": "#2196F3"},
            {"name": "Completed", "value": unique_completed_count, "color": "#4CAF50"},
            {"name": "Passed", "value": unique_passed_count, "color": "#FFC107"},
        ],
        "completion_over_time": last_7_days,
        "pending_reviews": pending_reviews
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
            "username": user.get("username"),
            "email": user.get("email") or "No email",
            "role": "Candidate", # Placeholder role
            "status": status,
            "img": user.get("avatar_url") or f"https://ui-avatars.com/api/?name={user.get('username')}"
        })
        
    return {"candidates": candidates}


@router.get("/api/admin/candidates/{user_id}")
async def get_candidate_details(
    user_id: str,
    admin_id: str = Query(..., description="Admin user id")
):
    """Get detailed information about a candidate including history."""
    require_admin(admin_id)
    
    users = data_manager.load_users()
    user = next((u for u in users if str(u.get("id")) == str(user_id)), None)
    
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    # Get all interviews
    all_interviews = data_manager.load_interviews()
    
    # Get all results for this user
    all_results = data_manager.load_results()
    user_results = [r for r in all_results if str(r.get("candidate_id")) == str(user_id)]
    
    # Sort results by date desc
    user_results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Find assigned interviews (active/pending)
    assigned_interviews = []
    for interview in all_interviews:
        if user_id in interview.get("allowed_candidate_ids", []):
            # Check if already completed
            is_completed = any(str(r.get("interview_id")) == str(interview.get("id")) for r in user_results)
            
            assigned_interviews.append({
                "id": interview.get("id"),
                "title": interview.get("title"),
                "description": interview.get("description"),
                "status": "Completed" if is_completed else "Pending",
                "deadline": interview.get("deadline"),
                "config": interview.get("config", {}),
            })
            
    return {
        "candidate": {
            "id": user.get("id"),
            "username": user.get("username"),
            "email": user.get("email"),
            "avatar_url": user.get("avatar_url"),
            "role": user.get("role")
        },
        "assigned_interviews": assigned_interviews,
        "history": user_results
    }


@router.get("/api/admin/interviews/{interview_id}/stats")
async def get_interview_stats(
    interview_id: str,
    admin_id: str = Query(..., description="Admin user id")
):
    """Get statistics and candidate details for a specific interview."""
    require_admin(admin_id)
    
    interview = data_manager.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    results = data_manager.load_results()
    interview_results = [r for r in results if str(r.get("interview_id")) == str(interview_id)]
    
    # Helper to calculate score from feedback
    def calculate_score(result):
        if result.get("overall_score") and result.get("overall_score") > 0:
            return result.get("overall_score")
        if result.get("score") and result.get("score") > 0:
            return result.get("score")
            
        feedback = result.get("feedback", [])
        if feedback and isinstance(feedback, list) and len(feedback) > 0:
            total = 0
            count = 0
            for item in feedback:
                if isinstance(item, dict):
                    val = item.get("score") or item.get("overall")
                    if val is not None:
                        total += float(val)
                        count += 1
            if count > 0:
                return round(total / count, 1)
        return 0

    # Calculate stats
    total_assigned = len(interview.get("allowed_candidate_ids", []))
    completed_count = len(interview_results)
    
    scores = []
    for r in interview_results:
        score = calculate_score(r)
        if score > 0:
            scores.append(score)
            
    avg_score = sum(scores) / len(scores) if scores else 0
    
    # Build candidate list with status
    candidates_data = []
    users = data_manager.load_users()
    
    for user_id in interview.get("allowed_candidate_ids", []):
        user = next((u for u in users if str(u.get("id")) == str(user_id)), None)
        if not user:
            continue
            
        # Check if they have a result
        user_result = next((r for r in interview_results if str(r.get("candidate_id")) == str(user_id)), None)
        
        status = "Pending"
        score = None
        completed_at = None
        session_id = None
        
        if user_result:
            status = user_result.get("status", "Completed")
            score = calculate_score(user_result)
            completed_at = user_result.get("completed_at")
            session_id = user_result.get("session_id")
            
        candidates_data.append({
            "id": user.get("id"),
            "username": user.get("username"),
            "email": user.get("email"),
            "avatar_url": user.get("avatar_url"),
            "status": status,
            "score": score if score > 0 else None,
            "completed_at": completed_at,
            "session_id": session_id
        })
        
    return {
        "interview": interview,
        "stats": {
            "total_assigned": total_assigned,
            "completed": completed_count,
            "pending": total_assigned - completed_count,
            "avg_score": round(avg_score, 1)
        },
        "candidates": candidates_data
    }


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

