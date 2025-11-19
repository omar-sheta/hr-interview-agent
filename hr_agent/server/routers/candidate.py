"""
Candidate router.

Endpoints for candidate-specific functionality (interviews, results).
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..models.schemas import CandidateInterviewStartRequest
from ..services.auth_service import require_candidate
from ..services.interview_service import start_interview_session
from ..models.schemas import InterviewStartRequest
from ..data_manager import data_manager
from ..utils.helpers import normalize_ids

router = APIRouter()


@router.get("/api/candidates")
async def list_all_candidates():
    """Return all candidate users for admin to assign to interviews."""
    all_users = data_manager.load_users()
    candidates = [
        {"id": u["id"], "username": u["username"]}
        for u in all_users
        if u.get("role") == "candidate"
    ]
    return {"candidates": candidates}


@router.get("/api/candidate/interviews")
async def list_candidate_interviews(candidate_id: str = Query(..., description="Candidate user id")):
    """Return active interviews a candidate is allowed to access."""
    candidate = require_candidate(candidate_id)
    
    # Load results once and filter for this candidate
    all_results = data_manager.load_results()
    completed_ids = {
        str(result.get("interview_id"))
        for result in all_results
        if str(result.get("candidate_id")) == str(candidate["id"])
    }
    
    # Load interviews and filter efficiently
    allowed_interviews = []
    all_interviews = data_manager.load_interviews()
    candidate_id_str = str(candidate["id"])
    
    for interview in all_interviews:
        # Skip if not active
        if not interview.get("active"):
            continue
            
        # Skip if already completed
        if str(interview.get("id")) in completed_ids:
            continue
            
        # Check if candidate is allowed
        candidate_ids = normalize_ids(interview.get("allowed_candidate_ids"))
        if candidate_id_str in candidate_ids:
            allowed_interviews.append(interview)
    
    return {"interviews": allowed_interviews}


@router.post("/api/candidate/interviews/{interview_id}/start")
async def start_candidate_interview(interview_id: str, request: CandidateInterviewStartRequest):
    """Kick off an interview session that is tied to a candidate and interview record."""
    candidate = require_candidate(request.candidate_id)
    
    # Check if already completed - optimized to only check for this candidate and interview
    all_results = data_manager.load_results()
    candidate_id_str = str(candidate.get("id"))
    interview_id_str = str(interview_id)
    
    for result in all_results:
        if (str(result.get("candidate_id")) == candidate_id_str and 
            str(result.get("interview_id")) == interview_id_str):
            raise HTTPException(status_code=400, detail="Interview already completed.")
    
    interview = data_manager.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    if not interview.get("active", False):
        raise HTTPException(status_code=400, detail="Interview is not active")
    candidate_ids = normalize_ids(interview.get("allowed_candidate_ids"))
    if candidate_id_str not in candidate_ids:
        raise HTTPException(status_code=403, detail="Candidate is not allowed for this interview")

    config = interview.get("config") or {}
    start_request = InterviewStartRequest(
        candidate_name=candidate.get("username"),
        job_role=config.get("job_role") or interview.get("title"),
        job_description=config.get("job_description") or interview.get("description"),
        num_questions=config.get("num_questions") or len(config.get("questions") or []) or 3,
        questions=config.get("questions")
    )
    session_payload = start_interview_session(start_request)
    metadata = {
        "candidate_id": candidate.get("id"),
        "candidate_username": candidate.get("username"),
        "interview_id": interview.get("id"),
        "interview_title": interview.get("title"),
        "interview_description": interview.get("description"),
        "interview_config": config,
    }
    data_manager.update_session(session_payload["session_id"], metadata)

    return {
        "success": True,
        "session": session_payload,
        "interview": {
            "id": interview.get("id"),
            "title": interview.get("title"),
            "description": interview.get("description"),
            "config": config
        }
    }


@router.get("/api/candidate/results")
async def list_candidate_results(
    candidate_id: str = Query(..., description="Candidate user id"),
    candidate_username: Optional[str] = Query(None, description="Candidate username fallback"),
):
    """Allow candidates to check which interviews they have completed."""
    candidate = require_candidate(candidate_id)
    results = data_manager.load_results()
    candidate_results = [
        result for result in results
        if str(result.get("candidate_id")) == str(candidate.get("id"))
    ]
    if not candidate_results and candidate_username:
        candidate_results = [
            result for result in results
            if str(result.get("candidate_username", "")).lower() == candidate_username.lower()
        ]
    return {"results": candidate_results}
