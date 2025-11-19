"""
Admin router.

Endpoints for admin dashboard (interview management, results).
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..models.schemas import AdminInterviewCreateRequest, AdminInterviewUpdateRequest
from ..services.auth_service import require_admin
from ..data_manager import data_manager
from ..utils.helpers import normalize_ids
from ..services.email_service import email_service
from ..services.email_templates import get_invite_email, get_status_update_email

router = APIRouter()


@router.get("/api/admin/interviews")
async def list_admin_interviews(admin_id: str = Query(..., description="Admin user id")):
    """List all interviews for the admin dashboard."""
    require_admin(admin_id)
    return {"interviews": data_manager.load_interviews()}


@router.post("/api/admin/interviews")
async def create_admin_interview(request: AdminInterviewCreateRequest):
    """Create a new interview definition."""
    require_admin(request.admin_id)
    interviews = data_manager.load_interviews()
    new_interview = {
        "id": f"int-{uuid.uuid4()}",
        "title": request.title,
        "description": request.description,
        "config": request.config or {},
        "allowed_candidate_ids": normalize_ids(request.allowed_candidate_ids),
        "active": bool(request.active),
        "created_by": request.admin_id,
        "created_at": datetime.now().isoformat(),
    }
    interviews.append(new_interview)
    interviews.append(new_interview)
    data_manager.save_interviews(interviews)
    
    # Send invite emails to newly assigned candidates
    try:
        if request.allowed_candidate_ids:
            print(f"📨 Attempting to send emails to {len(request.allowed_candidate_ids)} candidates")
            # Get candidate details
            candidates = data_manager.get_users_by_ids(request.allowed_candidate_ids)
            print(f"📨 Found {len(candidates)} candidate records")
            for candidate in candidates:
                if candidate.get("email"):
                    print(f"📨 Sending email to {candidate.get('email')}")
                    email_content = get_invite_email(
                        candidate_name=candidate.get("username"),
                        interview_title=new_interview["title"],
                        interview_link=f"https://localhost:5173/dashboard", # TODO: dynamic URL
                        deadline=request.deadline
                    )
                    result = email_service.send_email(
                        to_email=candidate["email"],
                        subject=f"Interview Invitation: {new_interview['title']}",
                        html_content=email_content
                    )
                    print(f"📨 Email send result: {result}")
                else:
                    print(f"📨 No email found for candidate: {candidate.get('username')}")
    except Exception as e:
        # Log error but don't fail the request
        print(f"❌ Failed to send invite emails: {e}")
        import traceback
        traceback.print_exc()

    return {"interview": new_interview}


@router.put("/api/admin/interviews/{interview_id}")
async def update_admin_interview(interview_id: str, request: AdminInterviewUpdateRequest):
    """Update interview details."""
    require_admin(request.admin_id)
    interviews = data_manager.load_interviews()
    updated = None
    for idx, interview in enumerate(interviews):
        if str(interview.get("id")) == str(interview_id):
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
    
    # Send invite emails if candidates were added or deadline changed
    # For simplicity, we'll send to all assigned candidates on update for now
    # In a real app, we'd diff the list or have a specific "Send Invites" button
    if updated["allowed_candidate_ids"]:
        candidates = data_manager.get_users_by_ids(updated["allowed_candidate_ids"])
        for candidate in candidates:
            if candidate.get("email"):
                email_content = get_invite_email(
                    candidate["username"], 
                    updated["title"], 
                    updated.get("deadline")
                )
                email_service.send_email(
                    candidate["email"], 
                    f"Interview Update: {updated['title']}", 
                    email_content
                )

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
