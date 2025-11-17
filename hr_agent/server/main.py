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
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

# Add parent directory to path to import existing modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
# Also ensure the server directory is on sys.path for importing local config
sys.path.append(os.path.dirname(__file__))

# Prefer our local `config.py` settings; fall back to _PlaceholderSettings when necessary
try:
    import config as local_config
    settings = local_config.settings
except Exception:
    settings = None

try:
    from hr_agent.server.services import stt as stt_service
    from hr_agent.server.services import tts as tts_service
    from hr_agent.server.routes import stt_router
except Exception as exc:
    raise RuntimeError("Failed to import local speech services. Ensure hr_agent/server/services is on PYTHONPATH.") from exc

get_piper_voice = tts_service.get_piper_voice
_prepare_text = tts_service._prepare_text
_load_voice_metadata = tts_service._load_voice_metadata
_synthesize_to_wav_bytes = tts_service._synthesize_to_wav_bytes
stt_available = stt_service.STT_AVAILABLE
tts_available = tts_service.TTS_AVAILABLE

if settings is None:
    class _PlaceholderSettings:
        OLLAMA_BASE_URL = "http://localhost:11434"
        OLLAMA_MODEL = "gemma3:27b"

    settings = _PlaceholderSettings()
from hr_agent.server.data_manager import data_manager


def check_ollama_available(timeout: int | float = None, retries: int | None = None, backoff: float | None = None) -> tuple[bool, str]:
    """Probe the OLLAMA endpoint to ensure it's reachable. Returns (True, 'ok') if reachable, otherwise (False, reason)."""
    # Use configured values if not provided
    try:
        probe_timeout = float(timeout or settings.OLLAMA_PROBE_TIMEOUT)
    except Exception:
        probe_timeout = 2.0
    try:
        probe_retries = int(retries or settings.OLLAMA_PROBE_RETRIES)
    except Exception:
        probe_retries = 3
    try:
        probe_backoff = float(backoff or settings.OLLAMA_PROBE_BACKOFF)
    except Exception:
        probe_backoff = 1.0

    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/version"
    last_err = None
    for attempt in range(probe_retries):
        try:
            r = requests.get(url, timeout=probe_timeout)
            if r.status_code == 200:
                return True, "ok"
            return False, f"status_code={r.status_code}"
        except Exception as e:
            last_err = e
            if attempt < (probe_retries - 1):
                import time
                time.sleep(probe_backoff)
            continue
    return False, str(last_err)

app = FastAPI(
    title="HR Interview Agent Server",
    description="Centralized server for HR interview AI processing",
    version="1.0.0",
)

app.include_router(stt_router.router)

logger = logging.getLogger("hr_interview_agent.server")

# CORS middleware for web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use persistent data manager instead of in-memory storage
# interview_sessions: Dict[str, Dict[str, Any]] = {}  # Replaced with data_manager

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

# Additional stop words to avoid extracting low-value keywords out of job postings
EXTENDED_STOP_WORDS = {
    'are', 'is', 'am', 'be', 'being', 'been', 'a', 'an', 'the', 'in', 'on', 'at', 'by', 'for', 'to',
    'of', 'with', 'we', 'you', 'they', 'job', 'position', 'looking', 'seeking', 'candidate', 'role',
    'hire', 'hiring', 'apply', 'applicant', 'your', 'our', 'this', 'that', "we're", "we've"
}

STOP_WORDS.update(EXTENDED_STOP_WORDS)

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
    
    # Split by lines and process each
    for line in content.splitlines():
        clean = line.strip()
        if not clean:
            continue
            
        # Skip lines that are obviously not questions
        if any(clean.lower().startswith(skip) for skip in ['**', 'why it', 'what you', 'ideal answer', 'good answer', 'red flags', 'difficulty:']):
            continue
            
        # Remove numbering, bullets, and markdown
        clean = re.sub(r"^\*+\s*", "", clean)  # Remove markdown asterisks
        clean = re.sub(r"^\d+[\).\-]\s*", "", clean)  # Remove numbering
        clean = re.sub(r"^[\-\*]\s*", "", clean)  # Remove bullets
        clean = re.sub(r"^\*\*.*?\*\*:?\s*", "", clean)  # Remove bold markdown
        
        # Skip if it's still not a proper question after cleaning
        if len(clean) < 10:
            continue
            
        # Ensure it ends with a question mark
        if not clean.endswith("?"):
            clean = clean.rstrip(".")
            clean = clean + "?"
            
        # Only keep lines that look like actual questions
        if "?" in clean and len(clean.split()) >= 5:
            lines.append(clean)

    # If we didn't get enough questions from line splitting, try different approach
    if len(lines) < max_questions:
        # Split by question marks and clean up
        chunks = [chunk.strip() for chunk in re.split(r"\?\s*", content) if chunk.strip()]
        for chunk in chunks[:max_questions]:
            if len(chunk) > 10 and len(chunk.split()) >= 5:
                question = chunk + "?"
                # Clean up any remaining formatting
                question = re.sub(r"^\*+\s*", "", question)
                question = re.sub(r"^\d+[\).\-]\s*", "", question)
                if question not in lines:
                    lines.append(question)

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
    
    # If no job description or role provided, require either messages or prompt
    if not job_description and not job_role and not messages and not request.prompt:
        raise ValueError("Either messages/prompt or job_description/job_role must be provided")

    try:
        # Check Ollama/LLM availability and prefer local fallback if not reachable
        try:
            ok, reason = check_ollama_available()
            if not ok:
                raise RuntimeError(reason)
        except Exception as e:
            # If LLM is unavailable, we fall back to local templates by raising
            raise RuntimeError(f"LLM endpoint is not available: {e}")

        # Create a more focused prompt for cleaner question generation
        focused_prompt = f"""Generate exactly {num_questions} professional interview questions for this job.

Job Role: {job_role or 'Not specified'}
Job Description: {job_description or 'General position'}

Requirements:
- Return ONLY the questions
- One question per line
- No numbering, bullets, or explanations
- Each question must end with a question mark
- Focus on skills and experience relevant to the role

Questions:"""

        focused_messages = [{"role": "user", "content": focused_prompt}]
        
        # If Ollama is not available at the configured host:port, raise early so we hit fallback
        try:
            requests.get(f"{settings.OLLAMA_BASE_URL}/api/version", timeout=30)
        except Exception as e:
            raise RuntimeError("LLM endpoint is not available: " + str(e))

        ollama_response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={
                "model": request.model,
                "messages": focused_messages,
                "stream": False,
                "options": {
                    "temperature": request.temperature,
                    "num_predict": min(request.max_tokens, 500)  # Limit tokens for cleaner output
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
    voice: str = "en_US-lessac-high"


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
        # If neither messages nor prompt is provided but we have job info, that's ok
        # The build_questions_payload function will create the appropriate prompt
        return []

    def desired_question_count(self) -> int:
        if self.num_questions and self.num_questions > 0:
            return min(self.num_questions, 20)
        return 5


class EditQuestionRequest(BaseModel):
    """Request model for editing a single question."""
    original_question: str
    edit_instruction: str
    job_description: Optional[str] = None
    job_role: Optional[str] = None
    model: str = "gemma3:27b"
    temperature: float = 0.7


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


class LoginRequest(BaseModel):
    username: str
    password: str


class CandidateInterviewStartRequest(BaseModel):
    candidate_id: str


class AdminInterviewCreateRequest(BaseModel):
    admin_id: str
    title: str
    description: Optional[str] = None
    config: Dict[str, Any] = {}
    allowed_candidate_ids: List[str] = []
    active: bool = True


class AdminInterviewUpdateRequest(BaseModel):
    admin_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    allowed_candidate_ids: Optional[List[str]] = None
    active: Optional[bool] = None


def _normalize_ids(values: Optional[List[Any]]) -> List[str]:
    if not values:
        return []
    return [str(value) for value in values]


def _require_user(user_id: str, expected_role: Optional[str] = None) -> Dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    user = data_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if expected_role and user.get("role") != expected_role:
        raise HTTPException(status_code=403, detail="User is not authorized for this action")
    return user


def _require_admin(user_id: str) -> Dict[str, Any]:
    return _require_user(user_id, expected_role="admin")


def _require_candidate(user_id: str) -> Dict[str, Any]:
    return _require_user(user_id, expected_role="candidate")


# Health Check
@app.get("/health")
async def health_check():
    """Server health status."""
    llm_status = {
        "llm": "unknown",
        "llm_reason": None
    }
    ok, reason = check_ollama_available()
    llm_status["llm"] = "available" if ok else "unavailable"
    llm_status["llm_reason"] = None if ok else reason

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "stt": "available" if stt_available else "unavailable",
            "tts": "available" if tts_available else "unavailable",
        },
        **llm_status,
    }


@app.post("/api/login")
async def login(request: LoginRequest):
    """Simple username/password login backed by users.json."""
    user = data_manager.get_user_by_username(request.username)
    if not user or user.get("password") != request.password:
        return {"success": False, "message": "Invalid credentials"}
    
    return {
        "success": True,
        "user_id": user.get("id"),
        "role": user.get("role"),
        "username": user.get("username"),
        "message": "Login successful"
    }


@app.post("/api/logout")
async def logout():
    """Client-driven logout placeholder (no server-side session)."""
    return {"success": True, "message": "Logged out"}


@app.get("/api/candidate/interviews")
async def list_candidate_interviews(candidate_id: str = Query(..., description="Candidate user id")):
    """Return active interviews a candidate is allowed to access."""
    candidate = _require_candidate(candidate_id)
    completed_ids = {
        str(result.get("interview_id"))
        for result in data_manager.load_results()
        if str(result.get("candidate_id")) == str(candidate["id"])
    }
    allowed_interviews = []
    for interview in data_manager.load_interviews():
        candidate_ids = _normalize_ids(interview.get("allowed_candidate_ids"))
        if (
            interview.get("active")
            and str(candidate["id"]) in candidate_ids
            and str(interview.get("id")) not in completed_ids
        ):
            allowed_interviews.append(interview)
    return {"interviews": allowed_interviews}


@app.post("/api/candidate/interviews/{interview_id}/start")
async def start_candidate_interview(interview_id: str, request: CandidateInterviewStartRequest):
    """Kick off an interview session that is tied to a candidate and interview record."""
    candidate = _require_candidate(request.candidate_id)
    for result in data_manager.load_results():
        if (
            str(result.get("candidate_id")) == str(candidate.get("id"))
            and str(result.get("interview_id")) == str(interview_id)
        ):
            raise HTTPException(status_code=400, detail="Interview already completed.")
    interview = data_manager.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    if not interview.get("active", False):
        raise HTTPException(status_code=400, detail="Interview is not active")
    candidate_ids = _normalize_ids(interview.get("allowed_candidate_ids"))
    if str(candidate["id"]) not in candidate_ids:
        raise HTTPException(status_code=403, detail="Candidate is not allowed for this interview")

    config = interview.get("config") or {}
    start_request = InterviewStartRequest(
        candidate_name=candidate.get("username"),
        job_role=config.get("job_role") or interview.get("title"),
        job_description=config.get("job_description") or interview.get("description"),
        num_questions=config.get("num_questions") or len(config.get("questions") or []) or 3,
        questions=config.get("questions")
    )
    session_payload = await start_interview(start_request)
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


@app.get("/api/candidate/results")
async def list_candidate_results(candidate_id: str = Query(..., description="Candidate user id")):
    """Allow candidates to check which interviews they have completed."""
    candidate = _require_candidate(candidate_id)
    candidate_results = [
        result for result in data_manager.load_results()
        if str(result.get("candidate_id")) == str(candidate.get("id"))
    ]
    return {"results": candidate_results}


@app.get("/api/admin/interviews")
async def list_admin_interviews(admin_id: str = Query(..., description="Admin user id")):
    """List all interviews for the admin dashboard."""
    _require_admin(admin_id)
    return {"interviews": data_manager.load_interviews()}


@app.post("/api/admin/interviews")
async def create_admin_interview(request: AdminInterviewCreateRequest):
    """Create a new interview definition."""
    _require_admin(request.admin_id)
    interviews = data_manager.load_interviews()
    new_interview = {
        "id": f"int-{uuid.uuid4()}",
        "title": request.title,
        "description": request.description,
        "config": request.config or {},
        "allowed_candidate_ids": _normalize_ids(request.allowed_candidate_ids),
        "active": bool(request.active),
        "created_by": request.admin_id,
        "created_at": datetime.now().isoformat(),
    }
    interviews.append(new_interview)
    data_manager.save_interviews(interviews)
    return {"interview": new_interview}


@app.put("/api/admin/interviews/{interview_id}")
async def update_admin_interview(interview_id: str, request: AdminInterviewUpdateRequest):
    """Update interview details."""
    _require_admin(request.admin_id)
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
                updated["allowed_candidate_ids"] = _normalize_ids(request.allowed_candidate_ids)
            if request.active is not None:
                updated["active"] = bool(request.active)
            updated["updated_at"] = datetime.now().isoformat()
            interviews[idx] = updated
            break
    if not updated:
        raise HTTPException(status_code=404, detail="Interview not found")
    data_manager.save_interviews(interviews)
    return {"interview": updated}


@app.get("/api/admin/interviews/{interview_id}/results")
async def get_admin_interview_results(
    interview_id: str,
    admin_id: str = Query(..., description="Admin user id"),
):
    """Return results for a specific interview."""
    _require_admin(admin_id)
    results = [
        result for result in data_manager.load_results()
        if str(result.get("interview_id")) == str(interview_id)
    ]
    return {"results": results}


@app.get("/api/admin/results")
async def list_admin_results(
    admin_id: str = Query(..., description="Admin user id"),
    candidate_id: Optional[str] = Query(None),
    interview_id: Optional[str] = Query(None),
):
    """Return all completed interview results with optional filtering."""
    _require_admin(admin_id)
    results = data_manager.load_results()
    if candidate_id:
        results = [r for r in results if str(r.get("candidate_id")) == str(candidate_id)]
    if interview_id:
        results = [r for r in results if str(r.get("interview_id")) == str(interview_id)]
    return {"results": results}


@app.put("/api/admin/results/{session_id}")
async def update_admin_result(
    session_id: str,
    admin_id: str = Query(..., description="Admin user id"),
    status: str = Query(..., description="Status label e.g., pending/rejected/accepted"),
    result_id: Optional[str] = Query(None, description="Optional result id"),
):
    """Allow admins to update the review status of a completed interview."""
    _require_admin(admin_id)
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
    results[target_index]["status"] = status
    data_manager.save_results(results)
    return {"session_id": session_id, "status": status}


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


@app.post("/questions/edit")
async def edit_question_with_ai(request: EditQuestionRequest):
    """Edit an existing interview question using an AI instruction."""
    try:
        if not request.original_question or not request.edit_instruction:
            raise HTTPException(status_code=422, detail="Original question and edit instruction are required.")

        context = ""
        if request.job_role:
            context += f"The job role is: {request.job_role}. "
        if request.job_description:
            context += f"The job description is: {request.job_description}. "

        prompt = (
            f"{context}You are an expert at refining interview questions. "
            f"Your task is to edit the following interview question based on the instruction provided. "
            f"Return only the single, edited question, without any preamble or explanation.\n\n"
            f"Original Question: \"{request.original_question}\"\n"
            f"Instruction: \"{request.edit_instruction}\"\n\n"
            f"Edited Question:"
        )

        messages = [{"role": "user", "content": prompt}]

        ollama_response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={
                "model": request.model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": request.temperature, "num_predict": 200},
            },
            timeout=60,
        )

        if ollama_response.status_code == 200:
            result = ollama_response.json()
            content = result.get("message", {}).get("content", "").strip()
            
            # Clean the response to be just the question
            edited_question = content.split('\n')[0].strip()
            if edited_question.startswith('"') and edited_question.endswith('"'):
                edited_question = edited_question[1:-1]

            if not edited_question:
                raise ValueError("LLM returned an empty response.")

            return {
                "edited_question": edited_question,
                "original_question": request.original_question,
                "model": request.model,
                "timestamp": datetime.now().isoformat(),
            }

        detail = ollama_response.text or "LLM editing failed"
        raise RuntimeError(f"LLM editing failed ({ollama_response.status_code}): {detail}")

    except Exception as e:
        logger.error(f"Failed to edit question with AI: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to edit question: {str(e)}")


# Interview Management
@app.post("/interview/start")
async def start_interview(request: InterviewStartRequest):
    """Start a new interview session."""
    try:
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

        # Create session data
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
        session_id = data_manager.create_session(session_data)
        
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
    session = data_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    return session


@app.post("/interview/submit")
async def submit_response(
    session_id: str = Form(...),
    question_index: int = Form(...),
    transcript_id: Optional[str] = Form(None)
):
    """Submit interview response by referencing a stored transcript."""
    try:
        session = data_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Interview session not found")
        
        print(f"� Submitting response for session {session_id}, question {question_index}")
        
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
            raise HTTPException(status_code=400, detail=f"Transcript {transcript_id} not found")
        
        # Add response to session
        success = data_manager.add_session_response(session_id, question_index, transcript_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to add response to session")
        
        # Update session progress
        session = data_manager.get_session(session_id)  # Refresh session data
        current_question = question_index + 1
        updates = {"current_question": current_question}
        
        # Check if interview is complete
        if current_question >= len(session["questions"]):
            updates["status"] = "completed"
            print(f"✅ Interview completed!")
        
        data_manager.update_session(session_id, updates)
        
        return {
            "message": "Response submitted successfully",
            "transcript": transcript.get("transcript", ""),
            "transcript_id": transcript_id,
            "session_status": updates.get("status", session.get("status", "active")),
            "next_question_index": current_question
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit response: {str(e)}")


@app.get("/interview/{session_id}/results")
async def get_interview_results(session_id: str):
    """Get interview results and scoring."""
    session = data_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    # Debug logging
    print(f"🔍 Results request for session {session_id}:")
    print(f"   Status: {session.get('status', 'unknown')}")
    print(f"   Questions: {len(session.get('questions', []))}")
    print(f"   Current question: {session.get('current_question', 'unknown')}")
    
    if session["status"] != "completed":
        raise HTTPException(
            status_code=400, 
            detail=f"Interview not yet completed. Status: {session['status']}, Questions: {len(session.get('questions', []))}"
        )
    
    # Get responses with full transcript data
    responses_with_transcripts = data_manager.get_session_responses_with_transcripts(session_id)
    
    # Debug: Print all stored responses
    print(f"🔍 Debug - Stored responses for session {session_id}:")
    for idx, resp in enumerate(responses_with_transcripts):
        transcript_preview = resp.get('transcript', 'NO_TRANSCRIPT')[:100]
        print(f"   Response {idx}: question_index={resp.get('question_index')}, transcript='{transcript_preview}...'")
    
    # AI-powered HR evaluation and scoring
    total_score = 0
    scored_responses = []
    
    for i, response in enumerate(responses_with_transcripts):
        question_index = response.get("question_index", i)
        question = session["questions"][question_index] if question_index < len(session["questions"]) else "Unknown question"
        transcript = response.get("transcript", "[No transcript found]")
        
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
                
            else:
                # Fallback scoring if AI is unavailable
                score = min(10, max(1, len(transcript.split()) / 10))  # Word count based scoring
                feedback = f"Response evaluated based on length ({len(transcript.split())} words). AI evaluation unavailable."
                strengths = "Response provided within reasonable length."
                improvements = "Ensure AI evaluation system is available for detailed feedback."
                
        except Exception as e:
            print(f"Error in AI evaluation: {e}")
            # Fallback to improved basic scoring
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
            strengths = "Response provided with reasonable effort."
            improvements = "Consider providing more specific examples and technical details."
        
        scored_responses.append({
            **response,
            "score": round(score, 1),
            "feedback": feedback,
            "strengths": strengths,
            "areas_for_improvement": improvements,
            "question": question
        })
        
        total_score += score
    
    average_score = total_score / len(scored_responses) if scored_responses else 0
    _persist_completed_session(session_id, session, scored_responses, average_score)
    
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


def _persist_completed_session(session_id: str, session: Dict[str, Any], scored_responses: List[Dict[str, Any]], average_score: float) -> None:
    """Persist results so the admin dashboard can retrieve them later."""
    answers = []
    feedback = []
    for response in scored_responses:
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


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,  # Different port from main app
        reload=True
    )
