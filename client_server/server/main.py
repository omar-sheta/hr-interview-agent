from __future__ import annotations

"""
HR Interview Agent - Client-Server FastAPI Server

A centralized server that handles all AI processing:
- Speech-to-Text (MLX-Whisper)
- Text-to-Speech (Piper)
- LLM Generation (Gemma 3:27B)
- Interview Management
"""

import asyncio
import logging
import os
import re
import sys
import tempfile
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

# Add parent directory to path to import existing modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from hr_agent.api.stt_mlx import transcribe_audio_mlx
from hr_agent.api.tts import (
    get_piper_voice,
    _prepare_text,
    _load_voice_metadata,
    _synthesize_to_wav_bytes,
)
from hr_agent.config import settings

app = FastAPI(
    title="HR Interview Agent Server",
    description="Centralized server for HR interview AI processing",
    version="1.0.0",
)

logger = logging.getLogger("hr_interview_agent.server")

# CORS middleware for web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for demo (use database in production)
interview_sessions: Dict[str, Dict[str, Any]] = {}

CONTENT_TYPE_EXTENSION_MAP = {
    "audio/webm": ".webm",
    "audio/webm;codecs=opus": ".webm",
    "audio/ogg": ".ogg",
    "audio/ogg;codecs=opus": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mp4;codecs=mp4a.40.2": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/wave": ".wav",
    "audio/x-wav": ".wav",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".aac",
}


# ---------------------------------------------------------------------------
# Question Generation Helpers
# ---------------------------------------------------------------------------

STOP_WORDS = {
    "the", "and", "with", "from", "this", "that", "have", "will", "your",
    "about", "using", "experience", "skills", "team", "work", "role",
    "responsibilities", "ability", "strong", "knowledge", "prior", "must",
    "should", "high", "level", "for", "collaborate", "understanding", "tools",
    "software", "across", "years", "such", "including", "support", "business",
    "drive", "create", "range", "excellent", "communication", "solve", "solve",
    "build", "build", "focus", "design", "deliver", "manage", "ensure",
}

TEMPLATES_KEYWORD = [
    "Can you walk me through a recent project where you applied {keyword}?",
    "How do you stay current with best practices around {keyword}?",
    "Describe a complex challenge involving {keyword} and how you solved it.",
    "How would you leverage {keyword} to deliver value as a {role}?",
    "Tell me about a time you led a team while focusing on {keyword}.",
    "What metrics do you track to measure success when working with {keyword}?",
    "How do you mentor teammates who are newer to {keyword}?",
]

TEMPLATES_GENERAL = [
    "What excites you most about contributing as a {role}?",
    "How do you prioritize competing deadlines in a fast-paced environment?",
    "Describe how you ensure communication stays clear across cross-functional partners.",
    "Walk me through your approach to planning the first 90 days in this {role} role.",
    "How do you evaluate whether a solution truly solved the original problem?",
]


def extract_keywords(text: Optional[str], max_keywords: int = 8) -> List[str]:
    if not text:
        return []
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9+\-#]*", text.lower())
    keywords: List[str] = []
    for token in tokens:
        if len(token) < 3 or token in STOP_WORDS:
            continue
        if token not in keywords:
            keywords.append(token)
        if len(keywords) >= max_keywords:
            break
    return keywords


def extract_questions_from_text(content: str, max_questions: int) -> List[str]:
    lines: List[str] = []
    for line in content.splitlines():
        clean = line.strip()
        if not clean:
            continue
        clean = re.sub(r"^\d+[\).\-]\s*", "", clean)
        if not clean.endswith("?"):
            clean = clean.rstrip(".")
            clean = clean + "?"
        lines.append(clean)

    if not lines:
        chunks = [chunk.strip() for chunk in re.split(r"\?\s*", content) if chunk.strip()]
        lines = [chunk + "?" for chunk in chunks]

    return lines[:max_questions]


def generate_questions_locally(
    job_description: Optional[str],
    num_questions: int,
    job_role: Optional[str] = None,
) -> List[str]:
    role_phrase = job_role or "this role"
    keywords = extract_keywords(job_description)
    if not keywords and job_role:
        keywords = extract_keywords(job_role)
    if not keywords:
        keywords = ["problem solving", "stakeholder communication", "continuous improvement"]

    questions: List[str] = []

    for template in TEMPLATES_KEYWORD:
        if len(questions) >= num_questions:
            break
        keyword = keywords[len(questions) % len(keywords)]
        questions.append(template.format(role=role_phrase, keyword=keyword))

    for template in TEMPLATES_GENERAL:
        if len(questions) >= num_questions:
            break
        questions.append(template.format(role=role_phrase))

    while len(questions) < num_questions:
        keyword = keywords[len(questions) % len(keywords)]
        questions.append(f"What best practices have you developed around {keyword}?")

    return questions[:num_questions]


def infer_job_description(prompt: Optional[str], messages: List[Dict[str, str]]) -> Optional[str]:
    text_blocks = []
    if prompt:
        text_blocks.append(prompt)
    text_blocks.extend([msg.get("content", "") for msg in messages])
    combined = "\n".join(text_blocks)
    if not combined:
        return None

    lowered = combined.lower()
    marker = "job description"
    if marker in lowered:
        idx = lowered.find(marker)
        snippet = combined[idx + len(marker):]
        snippet = snippet.split("Provide only", 1)[0]
        return snippet.strip(" :\n") or combined.strip()

    return combined.strip()


def build_questions_payload(request: GenerateRequest) -> Dict[str, Any]:
    messages = request.formatted_messages()
    job_description = request.job_description or infer_job_description(request.prompt, messages)
    num_questions = request.desired_question_count()
    job_role = request.job_role

    if num_questions <= 0:
        raise ValueError("Number of questions must be greater than zero")

    try:
        ollama_response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={
                "model": request.model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": request.temperature,
                    "num_predict": request.max_tokens
                }
            },
            timeout=60,
        )

        if ollama_response.status_code == 200:
            result = ollama_response.json()
            content = result.get("message", {}).get("content", "")
            questions = extract_questions_from_text(content, num_questions)
            if not questions:
                raise ValueError("LLM returned no parseable questions")
            return {
                "questions": questions,
                "source": "ollama",
                "model": request.model,
                "content": "\n".join(questions),
                "raw": content,
                "timestamp": datetime.now().isoformat(),
                "used_fallback": False,
            }

        detail = ollama_response.text or "LLM generation failed"
        raise RuntimeError(f"LLM generation failed ({ollama_response.status_code}): {detail}")

    except Exception as error:
        if job_description is None and job_role is None:
            raise ValueError("Job description or job role is required to generate questions") from error
        fallback_questions = generate_questions_locally(job_description, num_questions, job_role)
        logger.warning("Falling back to rule-based questions: %s", error)
        return {
            "questions": fallback_questions,
            "source": "fallback",
            "model": request.model,
            "content": "\n".join(fallback_questions),
            "raw": job_description or job_role or "",
            "timestamp": datetime.now().isoformat(),
            "used_fallback": True,
            "fallback_reason": str(error),
        }


# Data Models
class TranscribeRequest(BaseModel):
    """Request model for transcription."""
    detailed: bool = False


class SynthesizeRequest(BaseModel):
    """Request model for speech synthesis."""
    text: str
    voice: str = "en_US-amy-medium"


class GenerateRequest(BaseModel):
    """Request model for text generation."""
    messages: Optional[List[Dict[str, str]]] = None
    prompt: Optional[str] = None
    model: str = "gemma3:27b"
    temperature: float = 0.7
    max_tokens: int = 1000
    job_role: Optional[str] = None
    job_description: Optional[str] = None
    num_questions: Optional[int] = None

    def formatted_messages(self) -> List[Dict[str, str]]:
        """Return chat-formatted messages derived from prompt/messages."""
        if self.messages:
            return self.messages
        if self.prompt:
            return [
                {
                    "role": "user",
                    "content": self.prompt,
                }
            ]
        raise ValueError("Either messages or prompt must be provided")

    def desired_question_count(self) -> int:
        if self.num_questions and self.num_questions > 0:
            return min(self.num_questions, 20)
        return 5


class InterviewStartRequest(BaseModel):
    """Request model to start interview."""
    candidate_name: Optional[str] = None
    job_role: Optional[str] = None
    job_description: Optional[str] = None
    num_questions: int = 3
    questions: Optional[List[str]] = None


class InterviewSubmitRequest(BaseModel):
    """Request model to submit interview response."""
    session_id: str
    question_index: int


# Health Check
@app.get("/health")
async def health_check():
    """Server health status."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "stt": "available",
            "tts": "available", 
            "llm": "available"
        }
    }


# Speech-to-Text Endpoint
@app.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    detailed: bool = Form(False)
):
    """Transcribe audio to text using MLX-Whisper."""
    try:
        # Save uploaded file temporarily
        extension = ''
        if audio.filename:
            extension = os.path.splitext(audio.filename)[1]
        if not extension and audio.content_type:
            extension = CONTENT_TYPE_EXTENSION_MAP.get(audio.content_type.lower(), '')
        if not extension:
            extension = '.tmp'
        if not extension.startswith('.'):
            extension = f'.{extension}'

        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Transcribe using existing MLX-Whisper function
            transcript = await transcribe_audio_mlx(temp_path, detailed=detailed)
            
            return {
                "transcript": transcript,
                "filename": audio.filename,
                "timestamp": datetime.now().isoformat()
            }
        finally:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# Text-to-Speech Endpoint  
@app.post("/synthesize")
async def synthesize_speech(request: SynthesizeRequest):
    """Synthesize text to speech using Piper."""
    try:
        # Prepare text and get Piper voice
        clean_text = _prepare_text(request.text, True)  # Ensure punctuation
        if not clean_text:
            raise HTTPException(status_code=400, detail="Text is empty")
        
        pv = get_piper_voice(request.voice)
        meta = _load_voice_metadata(request.voice)
        sample_rate = int(meta.get("audio", {}).get("sample_rate", 22050))
        
        # Synthesize to WAV bytes
        audio_bytes = _synthesize_to_wav_bytes(
            pv,
            clean_text,
            sample_rate=sample_rate,
            length_scale=None,
            noise_scale=None,
            noise_w=None
        )
        
        if not audio_bytes or len(audio_bytes) <= 44:
            raise HTTPException(status_code=500, detail="TTS synthesis produced no audio")
        
        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(e)}")


# LLM Generation Endpoint
@app.post("/generate")
async def generate_text(request: GenerateRequest):
    """Generate interview-ready questions, falling back to templates if needed."""
    try:
        payload = build_questions_payload(request)
        return payload
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text generation failed: {str(e)}")


# Interview Management
@app.post("/interview/start")
async def start_interview(request: InterviewStartRequest):
    """Start a new interview session."""
    try:
        session_id = str(uuid.uuid4())

        cleaned_questions: List[str] = []
        question_source = "client"
        used_fallback = False

        if request.questions:
            cleaned_questions = [q.strip() for q in request.questions if q and q.strip()]
            if not cleaned_questions:
                raise ValueError("Provided questions were empty after cleaning")
        else:
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

        # Store session
        interview_sessions[session_id] = {
            "session_id": session_id,
            "candidate_name": request.candidate_name,
            "job_role": request.job_role,
            "job_description": request.job_description,
            "questions": cleaned_questions,
            "responses": [],
            "current_question": 0,
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "question_source": question_source,
            "used_fallback": used_fallback,
        }
        
        return {
            "session_id": session_id,
            "questions": cleaned_questions,
            "message": "Interview session started successfully",
            "question_source": question_source,
            "used_fallback": used_fallback,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start interview: {str(e)}")


@app.get("/interview/{session_id}")
async def get_interview_session(session_id: str):
    """Get interview session details."""
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    return interview_sessions[session_id]


@app.post("/interview/submit")
async def submit_response(
    session_id: str = Form(...),
    question_index: int = Form(...),
    audio: UploadFile = File(...)
):
    """Submit interview response with audio."""
    try:
        if session_id not in interview_sessions:
            raise HTTPException(status_code=404, detail="Interview session not found")
        
        session = interview_sessions[session_id]
        
        # Transcribe audio response
        transcribe_result = await transcribe_audio(audio, detailed=False)
        transcript = transcribe_result["transcript"]
        
        # Store response
        response_data = {
            "question_index": question_index,
            "question": session["questions"][question_index] if question_index < len(session["questions"]) else "",
            "transcript": transcript,
            "audio_filename": audio.filename,
            "submitted_at": datetime.now().isoformat()
        }
        
        session["responses"].append(response_data)
        session["current_question"] = question_index + 1
        
        # Check if interview is complete
        if session["current_question"] >= len(session["questions"]):
            session["status"] = "completed"
        
        return {
            "message": "Response submitted successfully",
            "transcript": transcript,
            "session_status": session["status"],
            "next_question_index": session["current_question"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit response: {str(e)}")


@app.get("/interview/{session_id}/results")
async def get_interview_results(session_id: str):
    """Get interview results and scoring."""
    if session_id not in interview_sessions:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    session = interview_sessions[session_id]
    
    if session["status"] != "completed":
        raise HTTPException(status_code=400, detail="Interview not yet completed")
    
    # Simple scoring based on response length and relevance
    total_score = 0
    scored_responses = []
    
    for response in session["responses"]:
        # Basic scoring logic (can be enhanced with proper AI scoring)
        transcript_length = len(response["transcript"].split())
        
        if transcript_length < 10:
            score = 2
        elif transcript_length < 30:
            score = 5
        elif transcript_length < 60:
            score = 7
        else:
            score = 9
        
        scored_responses.append({
            **response,
            "score": score,
            "feedback": f"Response length: {transcript_length} words"
        })
        
        total_score += score
    
    average_score = total_score / len(scored_responses) if scored_responses else 0
    
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


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,  # Different port from main app
        reload=True
    )
