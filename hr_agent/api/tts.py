from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from piper import voice, download_voices
import tempfile
import os
import pathlib
import json
import wave
import hashlib
import threading
import time
from typing import Optional, Dict, Tuple, List

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice: str = "en_US-lessac-high"  # Default high-quality Piper voice
    ensure_punctuation: bool = True   # Append period if missing to avoid premature truncation
    length_scale: Optional[float] = None  # Speaking rate adjustment (values <1 faster, >1 slower)
    noise_scale: Optional[float] = None   # Voice variance
    noise_w: Optional[float] = None       # Prosody variation
    cache: bool = True                   # Allow caching identical synthesis

# Global variable to store the loaded Piper model
_piper_voice = None
_current_voice_name = None

# Simple in-process LRU cache for synthesized audio to avoid recomputing identical prompts
_tts_cache_lock = threading.Lock()
_tts_cache: Dict[str, Tuple[bytes, float]] = {}
_TTS_CACHE_MAX = 32  # entries


def _cache_get(key: str) -> Optional[bytes]:
    with _tts_cache_lock:
        item = _tts_cache.get(key)
        if not item:
            return None
        audio, _ = item
        # refresh timestamp
        _tts_cache[key] = (audio, time.time())
        return audio


def _cache_put(key: str, audio: bytes):
    with _tts_cache_lock:
        _tts_cache[key] = (audio, time.time())
        # prune if oversized
        if len(_tts_cache) > _TTS_CACHE_MAX:
            # drop oldest
            oldest_key = min(_tts_cache.items(), key=lambda kv: kv[1][1])[0]
            _tts_cache.pop(oldest_key, None)

def get_piper_voice(voice_name: str = "en_US-lessac-high"):
    """Load Piper voice lazily"""
    global _piper_voice, _current_voice_name
    
    if _piper_voice is None or _current_voice_name != voice_name:
        try:
            # Set download directory
            download_dir = pathlib.Path("./piper_voices")
            download_dir.mkdir(exist_ok=True)
            
            # Download voice if needed
            print(f"Loading Piper voice: {voice_name}")
            download_voices.download_voice(voice_name, download_dir)
            
            # Load the voice
            voice_path = download_dir / voice_name
            onnx_path = voice_path.with_suffix(".onnx")
            
            if not onnx_path.exists():
                # Try common file patterns
                for possible_file in download_dir.glob(f"{voice_name}*"):
                    if possible_file.suffix == ".onnx":
                        onnx_path = possible_file
                        break
            
            if not onnx_path.exists():
                raise HTTPException(status_code=500, detail=f"Voice model file not found for {voice_name}")
            
            _piper_voice = voice.PiperVoice.load(onnx_path)
            _current_voice_name = voice_name
            print(f"Piper voice {voice_name} loaded successfully")
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load Piper voice {voice_name}: {str(e)}")
    
    return _piper_voice

def _prepare_text(s: str, ensure_punctuation: bool) -> str:
    s = s.strip()
    if not s:
        return s
    if ensure_punctuation and s[-1] not in ".!?":
        s += "."
    return s


def _load_voice_metadata(voice_name: str) -> Dict:
    meta_path = pathlib.Path("./piper_voices") / f"{voice_name}.onnx.json"
    if meta_path.exists():
        try:
            return json.loads(meta_path.read_text())
        except Exception:
            return {}
    return {}


def _synthesize_to_wav_bytes(piper_voice, text: str, *, sample_rate: int, length_scale: Optional[float], noise_scale: Optional[float], noise_w: Optional[float]) -> bytes:
    """Fully consume Piper generator and write a proper WAV header in-memory."""
    import io as _io
    pcm_chunks: List[bytes] = []
    synth_kwargs = {}
    if length_scale is not None:
        synth_kwargs["length_scale"] = float(length_scale)
    if noise_scale is not None:
        synth_kwargs["noise_scale"] = float(noise_scale)
    if noise_w is not None:
        synth_kwargs["noise_w"] = float(noise_w)

    for chunk in piper_voice.synthesize(text, **synth_kwargs):
        # Each chunk is AudioChunk
        if hasattr(chunk, "audio_int16_bytes"):
            pcm_chunks.append(chunk.audio_int16_bytes)
    if not pcm_chunks:
        return b""
    raw_pcm = b"".join(pcm_chunks)

    buffer = _io.BytesIO()
    with wave.open(buffer, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(raw_pcm)
    return buffer.getvalue()


@router.post("/speak")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech using Piper TTS with improved reliability.

    Improvements:
    - Ensures sentence-ending punctuation (prevents final word truncation)
    - Direct WAV construction (no raw intermediate file heuristic)
    - Optional speed/variation controls (length_scale, noise params)
    - Response caching for identical prompts to speed up repeated playback
    - Metadata-driven sample rate
    """
    try:
        clean_text = _prepare_text(request.text, request.ensure_punctuation)
        if not clean_text:
            raise HTTPException(status_code=400, detail="Text is empty")

        pv = get_piper_voice(request.voice)
        meta = _load_voice_metadata(request.voice)
        sample_rate = int(meta.get("audio", {}).get("sample_rate", 22050))

        cache_key = None
        if request.cache:
            h = hashlib.sha256()
            h.update(clean_text.encode("utf-8"))
            h.update(request.voice.encode("utf-8"))
            if request.length_scale is not None:
                h.update(str(request.length_scale).encode())
            if request.noise_scale is not None:
                h.update(str(request.noise_scale).encode())
            if request.noise_w is not None:
                h.update(str(request.noise_w).encode())
            cache_key = h.hexdigest()
            cached = _cache_get(cache_key) if cache_key else None
            if cached:
                return Response(
                    content=cached,
                    media_type="audio/wav",
                    headers={
                        "X-TTS-Cache": "HIT",
                        "Content-Length": str(len(cached)),
                        "Cache-Control": "no-store",
                    },
                )

        start = time.time()
        wav_bytes = _synthesize_to_wav_bytes(
            pv,
            clean_text,
            sample_rate=sample_rate,
            length_scale=request.length_scale,
            noise_scale=request.noise_scale,
            noise_w=request.noise_w,
        )
        elapsed = time.time() - start

        if not wav_bytes or len(wav_bytes) <= 44:
            raise HTTPException(status_code=500, detail="TTS synthesis produced no audio")

        if cache_key:
            _cache_put(cache_key, wav_bytes)

        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "X-TTS-Cache": "MISS" if cache_key else "DISABLED",
                "X-TTS-Duration": f"{elapsed:.2f}s",
                "X-TTS-Sample-Rate": str(sample_rate),
                "Content-Length": str(len(wav_bytes)),
                "Cache-Control": "no-store",
                "Content-Disposition": "inline; filename=tts.wav",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {e}")


@router.post("/diagnose")
async def diagnose_tts(request: TTSRequest):
    """Return metadata diagnostics for a synthesis without caching (for debugging truncation issues)."""
    try:
        clean_text = _prepare_text(request.text, request.ensure_punctuation)
        pv = get_piper_voice(request.voice)
        meta = _load_voice_metadata(request.voice)
        sample_rate = int(meta.get("audio", {}).get("sample_rate", 22050))
        wav_bytes = _synthesize_to_wav_bytes(
            pv,
            clean_text,
            sample_rate=sample_rate,
            length_scale=request.length_scale,
            noise_scale=request.noise_scale,
            noise_w=request.noise_w,
        )
        duration_sec = 0.0
        if len(wav_bytes) > 44:  # header size
            pcm_bytes = len(wav_bytes) - 44
            samples = pcm_bytes // 2  # 16-bit samples
            duration_sec = samples / sample_rate
        # Very rough expected duration (approx 150 wpm => 2.5 wps)
        word_count = len(clean_text.split())
        expected_duration = word_count / 2.5
        return {
            "input_text": clean_text,
            "voice": request.voice,
            "sample_rate": sample_rate,
            "bytes": len(wav_bytes),
            "approx_duration_sec": round(duration_sec, 2),
            "estimated_words": word_count,
            "expected_duration_sec": round(expected_duration, 2),
            "length_scale": request.length_scale,
            "noise_scale": request.noise_scale,
            "noise_w": request.noise_w,
            "truncation_suspected": duration_sec < (0.6 * expected_duration) if expected_duration > 1 else False,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS diagnostics failed: {e}")

@router.get("/voices")
async def get_available_voices():
    """
    Get list of available Piper voices
    """
    try:
        # Prefer voices present in the local piper_voices directory; fall back to a short curated list
        download_dir = pathlib.Path("./piper_voices")
        options = []
        if download_dir.exists():
            for f in download_dir.glob("*.onnx"):
                name = f.stem  # e.g., en_US-amy-medium
                options.append({"name": name, "language": "English", "quality": name.split("-")[-1]})
        if not options:
            options = [
                {"name": "en_US-lessac-high", "language": "English (US)", "quality": "high"},
                {"name": "en_US-ryan-high", "language": "English (US)", "quality": "high"},
                {"name": "en_US-joe-high", "language": "English (US)", "quality": "high"},
                {"name": "en_US-bryce-high", "language": "English (US)", "quality": "high"},
                {"name": "en_US-amy-medium", "language": "English (US)", "quality": "medium"},
            ]
        return {"voices": options}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get voices: {str(e)}")

@router.get("/health")
async def tts_health(voice_name: str | None = None):
    """
    Check if Piper TTS is working
    """
    try:
        get_piper_voice(voice_name or "en_US-lessac-high")
        return {"status": "ok", "tts_engine": "piper", "voice": _current_voice_name}
    except Exception as e:
        return {"status": "error", "error": str(e)}
