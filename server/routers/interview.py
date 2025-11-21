"""
Interview router.

Endpoints for interview session management (start, submit, results).
"""

from fastapi import APIRouter, HTTPException, Form, BackgroundTasks
from typing import Optional

from ..models.schemas import InterviewStartRequest
from ..data_manager import data_manager
from ..services.interview_service import start_interview_session, submit_interview_response
from ..services.evaluation_service import evaluate_interview_session
from ..services.email_service import email_service
from ..services.email_templates import get_completion_email_admin

router = APIRouter()


@router.post("/interview/start")
async def start_interview(request: InterviewStartRequest):
    """Start a new interview session."""
    try:
        return start_interview_session(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start interview: {str(e)}")


@router.get("/interview/{session_id}")
async def get_interview_session(session_id: str):
    """Get interview session details."""
    session = data_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    return session


@router.post("/interview/submit")
async def submit_response(
    background_tasks: BackgroundTasks,
    session_id: str = Form(...),
    question_index: int = Form(...),
    transcript_id: Optional[str] = Form(None)
):
    """Submit interview response by referencing a stored transcript."""
    try:
        import logging
        logger = logging.getLogger("hr_interview_agent.interview")
        logger.info(f"📥 Received submission for session {session_id}, question_index={question_index} (type: {type(question_index)})")
        
        result = submit_interview_response(session_id, question_index, transcript_id)
        
        # If interview is completed, trigger async evaluation
        if result.get("session_status") == "completed":
            logger.info(f"🎓 Interview {session_id} completed. Triggering background evaluation.")
            background_tasks.add_task(evaluate_interview_session, session_id)
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit response: {str(e)}")


@router.get("/interview/{session_id}/results")
async def get_interview_results(session_id: str):
    """Get interview results and scoring."""
    try:
        # Check if results already exist
        results = data_manager.load_results()
        existing_result = next((r for r in results if r.get("session_id") == session_id), None)
        
        if existing_result:
            return existing_result
            
        # If no results but session is completed, it might be processing
        session = data_manager.get_session(session_id)
        if session and session.get("status") == "completed":
            return {"status": "processing", "message": "Results are being generated"}
            
        # If not completed or not found, try to evaluate (fallback)
        # This is kept for backward compatibility or manual triggers
        results = evaluate_interview_session(session_id)
        
        # Send completion email to admin (creator of the interview)
        # We need to fetch the interview to get the creator's ID, then fetch the creator to get their email
        if session:
            interview = data_manager.get_interview(session["interview_id"])
            if interview and interview.get("created_by"):
                admin_user = data_manager.get_user_by_id(interview["created_by"])
                if admin_user and admin_user.get("email"):
                    email_content = get_completion_email_admin(
                        session["candidate_name"],
                        session["interview_title"],
                        results["average_score"],
                        results["summary"]
                    )
                    email_service.send_email(
                        admin_user["email"],
                        f"Interview Completed: {session['candidate_name']} - {session['interview_title']}",
                        email_content
                    )
        
        return results
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get results: {str(e)}")
