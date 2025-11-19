"""
AI services router.

Endpoints for LLM generation, TTS synthesis, and question editing.
"""

import logging
import requests
from datetime import datetime
from fastapi import APIRouter, HTTPException, Response

from ..config import settings
from ..models.schemas import SynthesizeRequest, GenerateRequest, EditQuestionRequest
from ..services.question_service import build_questions_payload
from ..services import tts as tts_service
from ..services import stt as stt_service
from ..utils.helpers import check_ollama_available

router = APIRouter()
logger = logging.getLogger("hr_interview_agent.ai_router")

# Import TTS functions
get_piper_voice = tts_service.get_piper_voice
_prepare_text = tts_service._prepare_text
_load_voice_metadata = tts_service._load_voice_metadata
_synthesize_to_wav_bytes = tts_service._synthesize_to_wav_bytes
stt_available = stt_service.STT_AVAILABLE
tts_available = tts_service.TTS_AVAILABLE


@router.get("/health")
async def health_check():
    """Server health status."""
    llm_status = {
        "llm": "unknown",
        "llm_reason": None
    }
    ok, reason = check_ollama_available(
        settings.OLLAMA_BASE_URL,
        timeout=settings.OLLAMA_PROBE_TIMEOUT,
        retries=settings.OLLAMA_PROBE_RETRIES,
        backoff=settings.OLLAMA_PROBE_BACKOFF
    )
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


@router.post("/synthesize")
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


@router.post("/generate")
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


@router.post("/questions/edit")
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
