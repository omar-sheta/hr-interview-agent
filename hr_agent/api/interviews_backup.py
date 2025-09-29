from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import uuid
import os
import pathlib
import requests

from hr_agent.config import settings
from hr_agent import models
from .scoring import call_ollama_gemma, parse_evaluation_scores, SCORING_PROMPT_TEMPLATE

router = APIRouter()

# Ensure data directories exist
os.makedirs(settings.sessions_dir, exist_ok=True)
os.makedirs(settings.uploads_dir, exist_ok=True)

class CreateSessionRequest(BaseModel):
    job_description: str
    questions: List[str]

class NextQuestionResponse(BaseModel):
    question: str
    question_index: int
    status: str
    message: Optional[str] = None

class SessionCreateResponse(BaseModel):
    session_id: str
    message: str

class SessionListResponse(BaseModel):
    sessions: List[dict]

class SessionDetailsResponse(BaseModel):
    id: str
    questions: List[dict]
    status: str

async def score_response_with_gemma(question: str, transcript: str) -> dict:
    """Score a single response using direct function call (no HTTP)"""
    try:
        print(f"📊 Scoring response: question_len={len(question)}, transcript_len={len(transcript)}")
        
        # Format the prompt using the same template as scoring.py
        prompt = SCORING_PROMPT_TEMPLATE.format(
            question=question,
            transcript=transcript
        )
        
        # Call Ollama directly instead of making HTTP request to avoid self-blocking
        raw_response = call_ollama_gemma(prompt)
        
        # Parse the evaluation scores from the response
        scores = parse_evaluation_scores(raw_response)
        
        print(f"✅ Scoring completed: final_score={scores.get('final_score', 0):.1f}")
        return scores
            
    except Exception as e:
        print(f"❌ Scoring error: {e}")
        return {"error": f"Scoring failed: {str(e)}"}

def calculate_overall_interview_score(questions_data: List[dict]) -> dict:
    """Calculate overall interview statistics from individual question scores"""
    valid_scores = []
    linguistic_scores = []
    behavioral_scores = []
    
    for q in questions_data:
        if q.get("score") and not q["score"].get("error"):
            score_data = q["score"]
            final_score = score_data.get("final_score", 0)
            linguistic = score_data.get("detailed_scores", {}).get("linguistic_avg", 0)
            behavioral = score_data.get("detailed_scores", {}).get("behavioral_avg", 0)
            
            if final_score > 0:
                valid_scores.append(final_score)
                if linguistic > 0:
                    linguistic_scores.append(linguistic)
                if behavioral > 0:
                    behavioral_scores.append(behavioral)
    
    if valid_scores:
        return {
            "overall_score": sum(valid_scores) / len(valid_scores),
            "average_linguistic": sum(linguistic_scores) / len(linguistic_scores) if linguistic_scores else 0,
            "average_behavioral": sum(behavioral_scores) / len(behavioral_scores) if behavioral_scores else 0,
            "questions_scored": len(valid_scores),
            "total_questions": len(questions_data)
        }
    else:
        return {
            "overall_score": 0.0,
            "average_linguistic": 0.0,
            "average_behavioral": 0.0,
            "questions_scored": 0,
            "total_questions": len(questions_data)
        }

@router.post("/create", response_model=SessionCreateResponse)
async def create_session(request: CreateSessionRequest):
    """Create a new interview session"""
    
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    
    # Create session data
    session_data = {
        "id": session_id,
        "job_description": request.job_description,
        "questions": [
            {
                "question": q,
                "answered": False,
                "response": "",
                "audio_file": None
            } for q in request.questions
        ],
        "current_question_index": 0,
        "status": "in_progress"
    }
    
    # Save session
    session_file = settings.sessions_dir / f"{session_id}.json"
    with open(session_file, 'w') as f:
        json.dump(session_data, f, indent=2)
    
    return SessionCreateResponse(
        session_id=session_id,
        message=f"Interview session created with {len(request.questions)} questions"
    )

@router.post("/{session_id}/next", response_model=NextQuestionResponse)
async def get_next_question(session_id: str):
    """Get the next question for the interview"""
    session_file = settings.sessions_dir / f"{session_id}.json"
    
    if not session_file.exists():
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    with open(session_file, 'r') as f:
        session_data = json.load(f)
    
    current_index = session_data.get("current_question_index", 0)
    questions = session_data.get("questions", [])
    
    if current_index >= len(questions):
        # Interview completed
        session_data["status"] = "completed"
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        print(f"ℹ️ get_next_question: session {session_id} reached end of questions")
        return NextQuestionResponse(
            question="",
            question_index=-1,
            status="completed",
            message="Interview completed"
        )
    
    question = questions[current_index]["question"]
    print(f"📤 Returning next question for session {session_id}: index={current_index} text='{question[:80]}...' status={session_data['status']}")
    
    return NextQuestionResponse(
        question=question,
        question_index=current_index,
        status=session_data["status"]
    )

@router.get("/list", response_model=SessionListResponse)
async def list_sessions():
    """List all interview sessions"""
    sessions = []
    
    if settings.sessions_dir.exists():
        for session_file in settings.sessions_dir.glob("*.json"):
            try:
                with open(session_file, 'r') as f:
                    session_data = json.load(f)
                sessions.append({
                    "id": session_data["id"],
                    "job_description": session_data.get("job_description", ""),
                    "status": session_data.get("status", "unknown"),
                    "questions_count": len(session_data.get("questions", [])),
                    "questions_answered": sum(1 for q in session_data.get("questions", []) if q.get("answered"))
                })
            except Exception as e:
                print(f"Error loading session {session_file}: {e}")
    
    return SessionListResponse(sessions=sessions)

@router.get("/{session_id}", response_model=SessionDetailsResponse)
async def get_session_details(session_id: str):
    """Get details of a specific session"""
    session_file = settings.sessions_dir / f"{session_id}.json"
    
    if not session_file.exists():
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    with open(session_file, 'r') as f:
        session_data = json.load(f)
    
    return SessionDetailsResponse(
        id=session_data["id"],
        questions=session_data["questions"],
        status=session_data.get("status", "unknown")
    )

@router.post("/{session_id}/submit_response/{question_index}")
async def submit_response(session_id: str, question_index: int, audio_response: UploadFile = File(...)):
    """Submit an audio response for a specific question"""
    
    if question_index < 0:
        raise HTTPException(status_code=400, detail="Invalid question index")
        
    # Load session
    session_file = settings.sessions_dir / f"{session_id}.json"
    if not session_file.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    
    with open(session_file, 'r') as f:
        session_data = json.load(f)
    
    questions = session_data.get("questions", [])
    if question_index >= len(questions):
        raise HTTPException(status_code=400, detail="Question index out of range")
    
    # Determine file extension based on content type
    content_type = audio_response.content_type or ""
    if "webm" in content_type:
        ext = "webm"
    elif "mp4" in content_type:
        ext = "mp4"
    elif "m4a" in content_type:
        ext = "m4a"
    elif "wav" in content_type:
        ext = "wav"
    elif "mov" in content_type:
        ext = "mov"
    else:
        # Default to mp4 for unknown types
        ext = "mp4"
    
    # Save the uploaded file
    filename = f"{session_id}_{question_index}_response.{ext}"
    file_path = settings.uploads_dir / filename
    
    # Read and save the file
    content = await audio_response.read()
    print(f"⬆️ submit_response: session={session_id} q_idx={question_index} incoming='{audio_response.filename}' ct='{content_type}' bytes={len(content)} → '{filename}'")
    
    with open(file_path, 'wb') as f:
        f.write(content)
    
    print(f"💾 saved file: {file_path} size={len(content)} bytes")
    
    # Update session
    questions[question_index]["answered"] = True
    questions[question_index]["response"] = "[Audio recorded - transcription pending]"
    questions[question_index]["audio_file"] = filename
    session_data["current_question_index"] = question_index + 1
    
    with open(session_file, 'w') as f:
        json.dump(session_data, f, indent=2)
    
    print(f"✅ submit_response updated session: answered[{question_index}]=True audio_file='{filename}' current_question_index={session_data['current_question_index']}")
    
    return {"message": "Response saved successfully", "filename": filename}

@router.post("/{session_id}/transcribe_all")
async def transcribe_all_responses(session_id: str):
    """Transcribe all audio responses at the end of the interview"""
    try:
        # Find all audio files for this session (support webm/mp4/m4a/wav/mov uploads)
        audio_files = []
        if settings.uploads_dir.exists():
            patterns = [
                f"{session_id}_*_response.webm",
                f"{session_id}_*_response.mp4",
                f"{session_id}_*_response.m4a",
                f"{session_id}_*_response.wav",
                f"{session_id}_*_response.mov",
                f"{session_id}_*_*"  # fallback to any suffix format like original filename preserved
            ]
            for pat in patterns:
                for audio_file in settings.uploads_dir.glob(pat):
                    # Avoid duplicates
                    if audio_file not in audio_files:
                        audio_files.append(audio_file)
        
        print(f"🔍 Found {len(audio_files)} audio files for session {session_id}")
        for af in audio_files:
            try:
                print(f"  - {af.name} ({af.stat().st_size} bytes)")
            except Exception:
                print(f"  - {af.name}")
        
        if not audio_files:
            raise HTTPException(status_code=404, detail="No audio files found for session")
        
        # Load session
        session_file = settings.sessions_dir / f"{session_id}.json"
        if not session_file.exists():
            raise HTTPException(status_code=404, detail="Session not found")
        
        with open(session_file, 'r') as f:
            session_data = json.load(f)
        
        questions = session_data.get("questions", [])
        print(f"📋 Session has {len(questions)} questions")
        
        # Import transcription function
        try:
            from .stt_mlx import transcribe_audio_mlx
        except ImportError:
            from .stt import transcribe_audio_openai as transcribe_audio_mlx
        
        # Transcribe each audio file
        for audio_file in sorted(audio_files):
            try:
                # Extract question index from filename
                parts = audio_file.stem.split('_')
                if len(parts) >= 2:
                    question_index = int(parts[1])
                else:
                    continue
                
                if question_index >= len(questions):
                    continue
                
                print(f"🎵 Transcribing file {audio_file.name} for question index {question_index}...")
                
                # Transcribe the audio
                transcript = transcribe_audio_mlx(str(audio_file))
                
                if transcript and len(transcript.strip()) > 5:
                    questions[question_index]["transcript"] = transcript
                    questions[question_index]["response"] = transcript
                    print(f"✅ Transcribed question {question_index + 1}: {transcript[:100]}...")
                    
                    # Score the response using Gemma
                    question_text = questions[question_index]["question"]
                    score_data = await score_response_with_gemma(question_text, transcript)
                    
                    if not score_data.get("error"):
                        questions[question_index]["score"] = score_data
                        print(f"✅ Scored question {question_index + 1}: {score_data.get('final_score', 0):.1f}/10")
                    else:
                        print(f"⚠️ Scoring failed for question {question_index + 1}: {score_data.get('error')}")
                    
                else:
                    print(f"❌ Transcription failed or too short for {audio_file.name}")
                    questions[question_index]["transcript"] = "[Transcription failed]"
                    questions[question_index]["response"] = "[Transcription failed]"
                
            except Exception as e:
                print(f"❌ Error processing {audio_file.name}: {e}")
        
        # Calculate overall scores
        session_data["overall_score"] = calculate_overall_interview_score(questions)
        
        # Save updated session
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        return {"message": "All responses transcribed and scored successfully", "session_data": session_data}
        
    except Exception as e:
        print(f"❌ Error in transcribe_all: {e}")
        raise HTTPException(status_code=500, detail=f"Error transcribing responses: {str(e)}")

@router.post("/{session_id}/score_all")
async def score_all_responses(session_id: str):
    """Score all transcribed responses in a session"""
    try:
        session_file = settings.sessions_dir / f"{session_id}.json"
        if not session_file.exists():
            raise HTTPException(status_code=404, detail="Session not found")
        
        with open(session_file, 'r') as f:
            session_data = json.load(f)
        
        questions = session_data.get("questions", [])
        print(f"📊 Scoring all responses for session {session_id}")
        
        # Score each question that has a transcript
        for i, question_data in enumerate(questions):
            if question_data.get("transcript") and len(question_data["transcript"].strip()) > 10:
                question_text = question_data["question"]
                transcript = question_data["transcript"]
                
                score_data = await score_response_with_gemma(question_text, transcript)
                
                if not score_data.get("error"):
                    question_data["score"] = score_data
                    print(f"✅ Scored question {i + 1}: {score_data.get('final_score', 0):.1f}/10")
                else:
                    print(f"⚠️ Scoring failed for question {i + 1}: {score_data.get('error')}")
            else:
                print(f"⚠️ Skipping scoring for question {i + 1}: no valid transcript")
        
        # Calculate overall scores
        session_data["overall_score"] = calculate_overall_interview_score(questions)
        
        # Save updated session
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        return {"message": "All responses scored successfully", "session_data": session_data}
        
    except Exception as e:
        print(f"❌ Error in score_all: {e}")
        raise HTTPException(status_code=500, detail=f"Error scoring responses: {str(e)}")

@router.get("/{session_id}/download/{filename}")
async def download_audio_file(session_id: str, filename: str):
    """Download an audio file from a session"""
    # Security check - ensure filename belongs to the session
    if not filename.startswith(session_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_path = settings.uploads_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(file_path, media_type="audio/mp4", filename=filename)