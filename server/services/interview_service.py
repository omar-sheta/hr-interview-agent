"""
Interview service.

Business logic for interview session management.
"""

import logging
from typing import Any, Dict, List
from datetime import datetime

from ..data_manager import data_manager
from ..models.schemas import InterviewStartRequest, GenerateRequest
from .question_service import build_questions_payload

logger = logging.getLogger("hr_interview_agent.interview_service")


def start_interview_session(request: InterviewStartRequest) -> Dict[str, Any]:
    """
    Start a new interview session.
    
    Args:
        request: InterviewStartRequest with candidate and job info
        
    Returns:
        Dict with session_id, questions, and metadata
    """
    cleaned_questions: List[str] = []
    question_source = "client"
    used_fallback = False

    if request.questions:
        cleaned_questions = []
        for q in request.questions:
            if isinstance(q, str):
                if q.strip():
                    cleaned_questions.append(q.strip())
            elif isinstance(q, dict):
                # Try to find the question text in common keys
                q_text = q.get("question") or q.get("text") or q.get("content")
                if q_text and isinstance(q_text, str) and q_text.strip():
                    cleaned_questions.append(q_text.strip())
        
        if not cleaned_questions:
            raise ValueError("Provided questions were empty after cleaning")
    else:
        try:
            # Generate interview questions using LLM
            question_prompt = (
                f"Generate {request.num_questions} professional interview questions for a "
                f"{request.job_role or 'software developer'} position. Return only the questions,"
                " one per line, without numbering."
            )

            llm_request = GenerateRequest(
                messages=[{"role": "user", "content": question_prompt}],
                prompt=question_prompt,
                temperature=0.8,
                job_role=request.job_role,
                job_description=request.job_description,
                num_questions=request.num_questions,
            )

            questions_response = build_questions_payload(llm_request)
            cleaned_questions = questions_response["questions"]
            if not cleaned_questions:
                raise ValueError("No interview questions were generated")

            question_source = questions_response.get("source", "unknown")
            used_fallback = questions_response.get("used_fallback", False)

        except Exception as e:
            print(f"Error starting interview session: {str(e)}")
            import traceback
            traceback.print_exc()
            raise e

    # Create session data
    print(f"Creating session for candidate {request.candidate_name}")
    session_data = {
        "candidate_name": request.candidate_name,
        "job_role": request.job_role,
        "job_description": request.job_description,
        "questions": cleaned_questions,
        "current_question": 0,
        "status": "active",
        "question_source": question_source,
        "used_fallback": used_fallback,
        "responses": []  # Will store transcript_ids
    }

    # Store session using data manager
    try:
        session_id = data_manager.create_session(session_data)
        print(f"Session created with ID: {session_id}")
    except Exception as e:
        print(f"Error creating session in data manager: {str(e)}")
        raise e
    
    return {
        "session_id": session_id,
        "questions": cleaned_questions,
        "message": "Interview session started successfully",
        "question_source": question_source,
        "used_fallback": used_fallback,
    }


def submit_interview_response(
    session_id: str,
    question_index: int,
    transcript_id: str = None
) -> Dict[str, Any]:
    """
    Submit a response for an interview question.
    
    Args:
        session_id: Interview session ID
        question_index: Index of the question being answered
        transcript_id: Optional transcript ID (if None, marks as skipped)
        
    Returns:
        Dict with submission status and next steps
    """
    session = data_manager.get_session(session_id)
    if not session:
        raise ValueError(f"Interview session {session_id} not found")
    
    logger.info(f"Submitting response for session {session_id}, question {question_index}")
    
    if not transcript_id:
        # Handle skip or no transcript case
        transcript_data = {
            "transcript": "[Question was skipped by the candidate]",
            "audio_filename": "skipped",
            "submitted_at": datetime.now().isoformat()
        }
        transcript_id = data_manager.store_transcript(session_id, question_index, transcript_data)
    
    # Verify transcript exists
    transcript = data_manager.get_transcript(transcript_id)
    if not transcript:
        raise ValueError(f"Transcript {transcript_id} not found")
    
    # Add response to session
    success = data_manager.add_session_response(session_id, question_index, transcript_id)
    if not success:
        raise ValueError("Failed to add response to session")
    
    # Update session progress
    session = data_manager.get_session(session_id)  # Refresh session data
    current_question = question_index + 1
    updates = {"current_question": current_question}
    
    # Check if interview is complete
    if current_question >= len(session["questions"]):
        updates["status"] = "completed"
        logger.info(f"Interview {session_id} completed!")
    
    data_manager.update_session(session_id, updates)
    
    return {
        "message": "Response submitted successfully",
        "transcript": transcript.get("transcript", ""),
        "transcript_id": transcript_id,
        "session_status": updates.get("status", session.get("status", "active")),
        "next_question_index": current_question
    }
