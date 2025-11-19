from __future__ import annotations
import math
import os
import shutil
import struct
import subprocess
import tempfile
import time
import wave
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ValidationError

from ..data_manager import data_manager
from ..services import stt as stt_service

router = APIRouter(tags=["Speech-to-Text"])

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


class TranscriptionOptions(BaseModel):
    detailed: bool = False
    diagnostics: bool = False


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def _convert_to_wav16k(src_path: str) -> str:
    """Normalize arbitrary audio into 16kHz mono 16-bit PCM WAV."""
    if not _ffmpeg_available():
        return src_path

    dst_fd, dst_path = tempfile.mkstemp(suffix="_norm.wav")
    os.close(dst_fd)
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        src_path,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-vn",
        "-c:a",
        "pcm_s16le",
        dst_path,
    ]
    try:
        subprocess.run(cmd, check=True)
        return dst_path
    except Exception:
        try:
            os.unlink(dst_path)
        except FileNotFoundError:
            pass
        return src_path


def _infer_extension(filename: Optional[str], content_type: Optional[str]) -> str:
    if filename:
        ext = os.path.splitext(filename)[1]
        if ext:
            return ext
    if content_type:
        return CONTENT_TYPE_EXTENSION_MAP.get(content_type.lower(), ".tmp")
    return ".tmp"


def _build_segments(raw_segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    segments: List[Dict[str, Any]] = []
    for seg in raw_segments:
        cleaned = {
            "start": seg.get("start"),
            "end": seg.get("end"),
            "dur": round((seg.get("end", 0) - seg.get("start", 0)), 2)
            if seg.get("end") is not None and seg.get("start") is not None
            else None,
            "text": (seg.get("text") or "").strip(),
        }
        if "words" in seg:
            cleaned["words"] = [
                {
                    "word": word.get("word"),
                    "start": word.get("start"),
                    "end": word.get("end"),
                }
                for word in seg.get("words", [])
                if word.get("word")
            ]
        segments.append(cleaned)
    return segments


def _build_diagnostics(raw_result: Dict[str, Any], elapsed: float, transcript: str) -> Dict[str, Any]:
    segments = _build_segments(raw_result.get("segments", []))
    total_seg_time = 0.0
    for seg in segments:
        start = seg.get("start") or 0.0
        end = seg.get("end") or start
        total_seg_time += max(0.0, end - start)
    return {
        "transcript": transcript,
        "diagnostics_ready": True,
        "duration_reported": raw_result.get("duration"),
        "elapsed_processing_sec": round(elapsed, 2),
        "num_segments": len(segments),
        "segments": segments,
        "aggregate_segment_duration": round(total_seg_time, 2),
    }


def _store_transcript(
    session_id: Optional[str],
    question_index: Optional[int],
    transcript: str,
    audio_bytes: bytes,
    original_filename: Optional[str],
    detailed: bool,
    normalized: bool,
) -> Optional[str]:
    if not session_id or question_index is None:
        return None
    stored_audio_path = data_manager.store_audio_file(
        session_id,
        question_index,
        audio_bytes,
        original_filename or "audio.tmp",
    )
    transcript_data = {
        "transcript": transcript,
        "audio_filename": original_filename,
        "stored_audio_path": stored_audio_path,
        "detailed": detailed,
        "normalized": normalized,
        "processing_timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    return data_manager.store_transcript(session_id, question_index, transcript_data)


def _load_options(options_json: Optional[str], fallback: TranscriptionOptions) -> TranscriptionOptions:
    if not options_json:
        return fallback
    try:
        return TranscriptionOptions.model_validate_json(options_json)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid options payload: {exc}") from exc


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(..., description="The audio file to be transcribed."),
    session_id: Optional[str] = Form(None, description="The active session ID for the interview."),
    question_index: Optional[int] = Form(None, description="The index of the current question."),
    options: Optional[str] = Form(None, description="JSON string with advanced transcription options."),
):
    # The 'detailed' and 'diagnostics' flags are now expected inside the 'options' JSON.
    # This simplifies the endpoint signature.
    base_options = TranscriptionOptions()
    if options:
        try:
            parsed_options = TranscriptionOptions.model_validate_json(options)
            base_options.detailed = parsed_options.detailed
            base_options.diagnostics = parsed_options.diagnostics
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid options JSON: {exc}")

    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    content = await audio.read()
    suffix = _infer_extension(audio.filename, audio.content_type)
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(content)
        temp_path = temp_file.name

    normalized_path: Optional[str] = None
    transcript_id: Optional[str] = None
    try:
        normalized_path = _convert_to_wav16k(temp_path)
        target_path = normalized_path or temp_path
        normalized = target_path != temp_path

        start = time.time()
        raw = await stt_service.transcribe_audio_mlx(
            target_path,
            detailed=base_options.detailed or base_options.diagnostics,
        )
        elapsed = time.time() - start

        if isinstance(raw, str):
            transcript_text = raw.strip()
            diagnostic_payload: Optional[Dict[str, Any]] = None
        else:
            transcript_text = (raw.get("text") or "").strip()
            diagnostic_payload = (
                _build_diagnostics(raw, elapsed, transcript_text)
                if base_options.diagnostics
                else None
            )

        if not transcript_text:
            raise HTTPException(status_code=500, detail="MLX-Whisper returned an empty transcript")

        transcript_id = _store_transcript(
            session_id,
            question_index,
            transcript_text,
            content,
            audio.filename,
            base_options.detailed,
            normalized,
        )

        model_info = stt_service.get_active_model_info()
        response: Dict[str, Any] = {
            "text": transcript_text,
            "transcript": transcript_text, # Add alias for client compatibility
            "engine": "mlx-whisper-gpu",
            "model": model_info.get("name"),
            "hf_repo": model_info.get("hf_repo"),
            "normalized": normalized,
            "transcript_id": transcript_id,
            "filename": audio.filename,
            "elapsed_sec": round(elapsed, 2),
        }
        if diagnostic_payload:
            response["diagnostics"] = diagnostic_payload
        return response
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"MLX-Whisper transcription failed: {exc}") from exc
    finally:
        if normalized_path and normalized_path != temp_path:
            try:
                os.unlink(normalized_path)
            except FileNotFoundError:
                pass
        try:
            os.unlink(temp_path)
        except FileNotFoundError:
            pass


@router.post("/diagnose")
async def diagnose_transcription(audio_file: UploadFile = File(...)):
    if not audio_file.content_type or not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    content = await audio_file.read()
    suffix = _infer_extension(audio_file.filename, audio_file.content_type)
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(content)
        temp_path = temp_file.name

    normalized_path: Optional[str] = None
    try:
        normalized_path = _convert_to_wav16k(temp_path)
        target_path = normalized_path or temp_path

        raw = await stt_service.transcribe_audio_mlx(target_path, detailed=True)
        if not isinstance(raw, dict):
            raise HTTPException(status_code=500, detail="Diagnostics require detailed transcription output")

        transcript_text = (raw.get("text") or "").strip()
        diagnostics_payload = _build_diagnostics(raw, 0.0, transcript_text)
        return diagnostics_payload
    finally:
        if normalized_path and normalized_path != temp_path:
            try:
                os.unlink(normalized_path)
            except FileNotFoundError:
                pass
        try:
            os.unlink(temp_path)
        except FileNotFoundError:
            pass


@router.get("/models")
async def get_available_models():
    return {
        "models": stt_service.list_available_models(),
        "current": stt_service.get_active_model_info(),
        "engine": "mlx-whisper-gpu",
    }


@router.post("/switch_model")
async def switch_model(model_name: str):
    try:
        info = stt_service.switch_model(model_name)
        return {
            "message": f"Switched to {model_name} model",
            "model": info,
            "engine": "mlx-whisper-gpu",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to switch model: {exc}") from exc


@router.get("/stt_health")
async def stt_health():
    return stt_service.stt_health_report()


def _generate_test_tone(path: str, duration: int = 3, sample_rate: int = 16000, frequency: int = 440) -> None:
    num_samples = duration * sample_rate
    amplitude = 32767
    with wave.open(path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        frames = bytearray()
        for i in range(num_samples):
            sample = int(amplitude * math.sin(2 * math.pi * frequency * (i / sample_rate)))
            frames.extend(struct.pack("<h", sample))
        wav_file.writeframes(frames)


@router.get("/benchmark")
async def benchmark_models():
    if not stt_service.STT_AVAILABLE or getattr(stt_service, "mlx_whisper", None) is None:
        raise HTTPException(status_code=503, detail="mlx-whisper is not available on this system")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
        temp_path = temp_file.name
    try:
        _generate_test_tone(temp_path)
        results = []
        for model in stt_service.list_available_models():
            repo = model["hf_repo"]
            model_name = model["name"]
            start = time.time()
            try:
                output = stt_service.mlx_whisper.transcribe(temp_path, path_or_hf_repo=repo)
                elapsed = time.time() - start
                results.append(
                    {
                        "model": model_name,
                        "hf_repo": repo,
                        "time_sec": round(elapsed, 2),
                        "text": (output.get("text") or "").strip(),
                        "status": "success",
                    }
                )
            except Exception as exc:  # pragma: no cover - benchmark best effort
                results.append(
                    {
                        "model": model_name,
                        "hf_repo": repo,
                        "time_sec": None,
                        "text": None,
                        "status": f"error: {exc}",
                    }
                )
        return {"benchmark_results": results, "audio_duration": 3}
    finally:
        try:
            os.unlink(temp_path)
        except FileNotFoundError:
            pass
