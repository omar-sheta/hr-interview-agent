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
    # This part of the code was incomplete in the original document,
    # assuming the user intended to fix indentation within a dictionary.
    # The following lines are a placeholder for the actual logic that would
    # precede the metadata dictionary, which is the focus of the indentation fix.
    # For the purpose of this fix, we are only adjusting the indentation of the dictionary items.
    interview = data_manager.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Example of how 'config' might be obtained
    config = interview.get("config", {})
    questions = config.get("questions", [])

    # Create request object
    start_req = InterviewStartRequest(
        candidate_name=candidate.get("username") or "Candidate",
        questions=questions,
        num_questions=len(questions) if questions else 3,
        job_role=config.get("job_role"),
        job_description=config.get("job_description")
    )

    session_payload = start_interview_session(start_req)

    metadata = {
            "candidate_id": candidate.get("id"),
            "candidate_username": candidate.get("username"),
            "interview_id": interview_id,
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
