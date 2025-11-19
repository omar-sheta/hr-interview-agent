"""
Evaluation service.

AI-powered evaluation and scoring of interview responses.
"""

import logging
import requests
from datetime import datetime
from typing import Any, Dict, List

from ..config import settings
from ..data_manager import data_manager

logger = logging.getLogger("hr_interview_agent.evaluation_service")


def evaluate_response_with_ai(question: str, transcript: str) -> Dict[str, Any]:
    """
    Evaluate a candidate's response using AI.
    
    Args:
        question: The interview question
        transcript: The candidate's response transcript
        
    Returns:
        Dict with score, feedback, strengths, and areas for improvement
    """
    # Handle empty transcripts
    if not transcript or transcript.strip() == "":
        transcript = "[No response provided]"
    elif transcript.strip() == "SKIPPED":
        transcript = "[Question was skipped by the candidate]"
    
    # Use AI to evaluate the response
    try:
        evaluation_prompt = f"""You are an expert HR interviewer. Evaluate this interview response on a scale of 1-10.

Question: {question}

Candidate's Response: {transcript}

Evaluate based on these HR criteria:
1. Relevance and completeness of the answer
2. Technical knowledge demonstrated
3. Communication clarity and professionalism
4. Problem-solving approach
5. Specific examples and details provided

Provide:
- Score (1-10): Where 1 is very poor, 5 is average, and 10 is exceptional
- Brief feedback (2-3 sentences) explaining the score
- Key strengths and areas for improvement

Format your response as:
Score: [number]
Feedback: [your feedback]
Strengths: [key strengths]
Areas for improvement: [areas to improve]"""
        
        ai_response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": "gemma3:27b",
                "prompt": evaluation_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,  # Lower temperature for more consistent scoring
                    "top_p": 0.9,
                    "num_predict": 300
                }
            },
            timeout=60
        )
        
        if ai_response.status_code == 200:
            ai_result = ai_response.json()
            evaluation_text = ai_result.get("response", "")
            
            # Parse the AI response to extract score and feedback
            score = 5  # Default score
            feedback = "Standard response evaluated."
            strengths = "Response provided."
            improvements = "Could provide more specific examples."
            
            lines = evaluation_text.strip().split('\n')
            for line in lines:
                if line.startswith('Score:'):
                    try:
                        score = float(line.replace('Score:', '').strip())
                        score = max(1, min(10, score))  # Ensure score is between 1-10
                    except:
                        score = 5
                elif line.startswith('Feedback:'):
                    feedback = line.replace('Feedback:', '').strip()
                elif line.startswith('Strengths:'):
                    strengths = line.replace('Strengths:', '').strip()
                elif line.startswith('Areas for improvement:'):
                    improvements = line.replace('Areas for improvement:', '').strip()
            
            return {
                "score": score,
                "feedback": feedback,
                "strengths": strengths,
                "areas_for_improvement": improvements
            }
        else:
            # Fallback scoring if AI is unavailable
            return _fallback_scoring(transcript)
            
    except Exception as e:
        logger.error(f"Error in AI evaluation: {e}")
        return _fallback_scoring(transcript)


def _fallback_scoring(transcript: str) -> Dict[str, Any]:
    """Fallback scoring based on word count when AI is unavailable."""
    word_count = len(transcript.split())
    
    if word_count < 5:
        score = 2
        feedback = "Very brief response - needs more detail and examples."
    elif word_count < 20:
        score = 4
        feedback = "Brief response - could benefit from more specific examples and details."
    elif word_count < 50:
        score = 6
        feedback = "Adequate response length - good baseline answer."
    elif word_count < 100:
        score = 8
        feedback = "Comprehensive response with good detail."
    else:
        score = 9
        feedback = "Very detailed and thorough response."
    
    return {
        "score": score,
        "feedback": feedback,
        "strengths": "Response provided with reasonable effort.",
        "areas_for_improvement": "Consider providing more specific examples and technical details."
    }


def evaluate_interview_session(session_id: str) -> Dict[str, Any]:
    """
    Evaluate all responses in an interview session.
    
    Args:
        session_id: Interview session ID
        
    Returns:
        Dict with scored responses and summary
    """
    session = data_manager.get_session(session_id)
    if not session:
        raise ValueError(f"Interview session {session_id} not found")
    
    if session["status"] != "completed":
        raise ValueError(f"Interview not yet completed. Status: {session['status']}")
    
    # Get responses with full transcript data
    responses_with_transcripts = data_manager.get_session_responses_with_transcripts(session_id)
    
    logger.info(f"Evaluating {len(responses_with_transcripts)} responses for session {session_id}")
    
    # AI-powered HR evaluation and scoring
    total_score = 0
    scored_responses = []
    
    for i, response in enumerate(responses_with_transcripts):
        question_index = response.get("question_index", i)
        question = session["questions"][question_index] if question_index < len(session["questions"]) else "Unknown question"
        transcript = response.get("transcript", "[No transcript found]")
        
        # Evaluate with AI
        evaluation = evaluate_response_with_ai(question, transcript)
        
        scored_responses.append({
            **response,
            "score": round(evaluation["score"], 1),
            "feedback": evaluation["feedback"],
            "strengths": evaluation["strengths"],
            "areas_for_improvement": evaluation["areas_for_improvement"],
            "question": question
        })
        
        total_score += evaluation["score"]
    
    average_score = total_score / len(scored_responses) if scored_responses else 0
    
    # Persist results for admin dashboard
    persist_completed_session(session_id, session, scored_responses, average_score)
    
    return {
        "session_id": session_id,
        "candidate_name": session["candidate_name"],
        "job_role": session["job_role"],
        "total_questions": len(session["questions"]),
        "completed_responses": len(scored_responses),
        "average_score": round(average_score, 1),
        "responses": scored_responses,
        "summary": f"Interview completed with average score of {average_score:.1f}/10"
    }


def persist_completed_session(
    session_id: str,
    session: Dict[str, Any],
    scored_responses: List[Dict[str, Any]],
    average_score: float
) -> None:
    """Persist results so the admin dashboard can retrieve them later."""
    answers = []
    feedback = []
    # Deduplicate responses by question_index, keeping the latest one
    unique_responses = {}
    for response in scored_responses:
        q_idx = response.get("question_index")
        unique_responses[q_idx] = response
    
    # Sort by question_index
    sorted_responses = [unique_responses[idx] for idx in sorted(unique_responses.keys())]

    answers = []
    feedback = []
    for response in sorted_responses:
        answers.append({
            "question_index": response.get("question_index"),
            "question": response.get("question"),
            "transcript": response.get("transcript"),
            "transcript_id": response.get("transcript_id"),
        })
        feedback.append({
            "question_index": response.get("question_index"),
            "feedback": response.get("feedback"),
            "strengths": response.get("strengths"),
            "areas_for_improvement": response.get("areas_for_improvement"),
            "score": response.get("score"),
        })

    record = {
        "session_id": session_id,
        "candidate_id": session.get("candidate_id"),
        "candidate_username": session.get("candidate_username"),
        "interview_id": session.get("interview_id"),
        "interview_title": session.get("interview_title"),
        "timestamp": datetime.now().isoformat(),
        "answers": answers,
        "feedback": feedback,
        "scores": {
            "average": round(average_score, 1),
            "details": [
                {
                    "question_index": response.get("question_index"),
                    "score": response.get("score"),
                }
                for response in scored_responses
            ],
        },
        "summary": f"Interview completed with average score of {average_score:.1f}/10",
        "status": "pending",
    }
    data_manager.upsert_result(session_id, record)
