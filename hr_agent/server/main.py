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

from hr_agent_trial.api.stt_mlx import transcribe_audio_mlx
from hr_agent_trial.api.tts import (
    get_piper_voice,
    _prepare_text,
    _load_voice_metadata,
    _synthesize_to_wav_bytes,
)
from hr_agent_trial.config import settings
from data_manager import data_manager

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

# Use persistent data manager instead of in-memory storage
# interview_sessions: Dict[str, Dict[str, Any]] = {}  # Replaced with data_manager

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
    detailed: bool = Form(False),
    session_id: Optional[str] = Form(None),
    question_index: Optional[int] = Form(None)
):
    """Transcribe audio to text using MLX-Whisper and optionally store result."""
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
            
            transcript_id = None
            # If session info provided, store the transcript persistently
            if session_id and question_index is not None:
                # Store audio file (use the content we already read)
                stored_audio_path = data_manager.store_audio_file(
                    session_id, question_index, content, audio.filename or "audio.tmp"
                )
                
                # Store transcript
                transcript_data = {
                    "transcript": transcript,
                    "audio_filename": audio.filename,
                    "stored_audio_path": stored_audio_path,
                    "detailed": detailed,
                    "processing_timestamp": datetime.now().isoformat()
                }
                
                transcript_id = data_manager.store_transcript(session_id, question_index, transcript_data)
                print(f"💾 Stored transcript {transcript_id} for session {session_id}, question {question_index}")
            
            return {
                "transcript": transcript,
                "transcript_id": transcript_id,
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
