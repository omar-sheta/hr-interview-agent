from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import mlx_whisper
import tempfile
import os
import time
import subprocess
import shutil
from typing import Optional, List, Dict, Any
from hr_agent.config import settings
import math

router = APIRouter()

# Global variable to store the loaded MLX-Whisper model
_mlx_whisper_model_name = "mlx-community/whisper-large-v3-mlx"  # GPU-optimized large model (best accuracy)
_available_models = {
    "tiny": "mlx-community/whisper-tiny-mlx",
    "base": "mlx-community/whisper-base-mlx", 
    "small": "mlx-community/whisper-small-mlx",
    "medium": "mlx-community/whisper-medium-mlx",
    "large": "mlx-community/whisper-large-v3-mlx",
}

def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def _convert_to_wav16k(src_path: str) -> str:
    """Convert arbitrary audio container to 16kHz mono 16-bit PCM WAV for stable transcription.

    Returns path to converted file (may equal src_path if conversion skipped).
    """
    if not _ffmpeg_available():
        # Best effort: return original
        print("⚠️ ffmpeg not found on PATH; skipping normalization. Install via 'brew install ffmpeg' for better accuracy.")
        return src_path
    try:
        dst_fd, dst_path = tempfile.mkstemp(suffix="_norm.wav")
        os.close(dst_fd)
        # Loudness normalization + resample mono 16k
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", src_path,
            "-ac", "1",            # mono
            "-ar", "16000",         # 16 kHz
            "-vn",                  # no video
            "-c:a", "pcm_s16le",    # 16-bit PCM
            dst_path
        ]
        subprocess.run(cmd, check=True)
        return dst_path
    except Exception as e:
        print(f"⚠️ Audio conversion failed, using original file: {e}")
        try:
            if os.path.exists(dst_path):
                os.unlink(dst_path)
        except Exception:
            pass
        return src_path


def _format_time(seconds: float) -> str:
    m, s = divmod(seconds, 60)
    return f"{int(m):02d}:{s:05.2f}"


async def transcribe_audio_mlx(file_path: str, *, detailed: bool = False) -> str:
    """Transcribe audio from file path using MLX-Whisper (for internal use).

    If detailed=True returns a JSON string with segments & word timestamps for diagnostics.
    """
    norm_path = None
    try:
        print(f"🎵 MLX-Whisper transcribing: {file_path}")
        norm_path = _convert_to_wav16k(file_path)
        if norm_path != file_path:
            print(f"🔄 Normalized audio -> {norm_path}")

        # Optimized decoding options for MLX-Whisper to reduce dropped words
        options = {
            "temperature": 0.0,  # Deterministic output
            "word_timestamps": True,  # request word-level timing if supported
            "condition_on_previous_text": True,
        }
        start = time.time()
        result = mlx_whisper.transcribe(
            norm_path,
            path_or_hf_repo=_mlx_whisper_model_name,
            **options,
        )
        elapsed = time.time() - start
        transcript = result.get("text", "").strip()
        if not transcript:
            print("⚠️ Empty transcript returned")
        print(f"✅ MLX-Whisper result ({elapsed:.2f}s, chars={len(transcript)}): {transcript[:120]}...")

        if detailed:
            # Build diagnostic structure
            segments = []
            raw_segments = result.get("segments", [])
            for s in raw_segments:
                seg = {
                    "start": s.get("start"),
                    "end": s.get("end"),
                    "dur": round((s.get("end", 0) - s.get("start", 0)), 2),
                    "text": s.get("text", "").strip(),
                }
                if "words" in s:
                    seg["words"] = [
                        {"word": w.get("word"), "start": w.get("start"), "end": w.get("end")}
                        for w in s.get("words", [])
                        if w.get("word")
                    ]
                segments.append(seg)
            diagnostic = {
                "transcript": transcript,
                "duration_reported": result.get("duration"),
                "elapsed_processing_sec": round(elapsed, 2),
                "num_segments": len(segments),
                "segments": segments,
            }
            import json as _json
            return _json.dumps(diagnostic)
        return transcript
    except Exception as e:
        print(f"❌ MLX-Whisper transcription failed: {e}")
        return f"[Transcription error: {e}]"
    finally:
        # Cleanup normalized file if created
        if norm_path and norm_path != file_path:
            try:
                os.unlink(norm_path)
            except Exception:
                pass

class TranscriptionOptions(BaseModel):
    detailed: bool = False
    diagnostics: bool = False


@router.post("/transcribe")
async def transcribe_audio(audio_file: UploadFile = File(...), options: TranscriptionOptions = TranscriptionOptions()):
    """Transcribe audio using MLX-Whisper (GPU-accelerated for Apple Silicon).

    Enhancements:
    - Normalizes audio to 16kHz mono WAV (if ffmpeg available)
    - Uses temperature=0 for deterministic output to reduce random deletions
    - Optionally returns detailed segment & word timing diagnostics
    """
    try:
        if not audio_file.content_type or not audio_file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be an audio file")

        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as temp_file:
            temp_path = temp_file.name
            content = await audio_file.read()
            temp_file.write(content)

        try:
            detailed_flag = options.detailed or options.diagnostics
            raw = await transcribe_audio_mlx(temp_path, detailed=detailed_flag)

            if detailed_flag and raw.startswith('{'):
                import json as _json
                diag = _json.loads(raw)
                return {
                    "text": diag.get("transcript", ""),
                    "diagnostics": diag,
                    "engine": "mlx-whisper-gpu",
                    "model": _mlx_whisper_model_name.split('/')[-1],
                    "normalized": _ffmpeg_available(),
                }
            else:
                return {
                    "text": raw.strip(),
                    "engine": "mlx-whisper-gpu",
                    "model": _mlx_whisper_model_name.split('/')[-1],
                    "normalized": _ffmpeg_available(),
                }
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MLX-Whisper transcription failed: {str(e)}")


@router.post("/diagnose")
async def diagnose_transcription(audio_file: UploadFile = File(...)):
    """Return a rich diagnostic report to investigate word dropping issues."""
    try:
        if not audio_file.content_type or not audio_file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be an audio file")
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as temp_file:
            temp_path = temp_file.name
            content = await audio_file.read()
            temp_file.write(content)
        try:
            raw = await transcribe_audio_mlx(temp_path, detailed=True)
            import json as _json
            if raw.startswith('{'):
                diag = _json.loads(raw)
                # Compute simple coverage metrics
                segs = diag.get("segments", [])
                total_seg_time = 0.0
                for s in segs:
                    try:
                        total_seg_time += (s.get("end", 0) - s.get("start", 0))
                    except Exception:
                        pass
                diag["aggregate_segment_duration"] = round(total_seg_time, 2)
                return diag
            return {"raw": raw}
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagnostics failed: {e}")

@router.get("/models")
async def get_available_models():
    """
    Get list of available MLX-Whisper models
    """
    models = [
        {"name": "tiny", "hf_repo": "mlx-community/whisper-tiny-mlx", "size": "~74 MB", "speed": "Very Fast", "accuracy": "Basic"},
        {"name": "base", "hf_repo": "mlx-community/whisper-base-mlx", "size": "~144 MB", "speed": "Fast", "accuracy": "Good"},
        {"name": "small", "hf_repo": "mlx-community/whisper-small-mlx", "size": "~488 MB", "speed": "Medium", "accuracy": "Better"},
        {"name": "medium", "hf_repo": "mlx-community/whisper-medium-mlx", "size": "~1.5 GB", "speed": "Slow", "accuracy": "Very Good"},
    ]
    current_model = _mlx_whisper_model_name.split('/')[-1].replace('whisper-', '').replace('-mlx', '')
    return {"models": models, "current": current_model, "engine": "mlx-whisper-gpu"}

@router.post("/switch_model")
async def switch_model(model_name: str):
    """
    Switch to a different MLX-Whisper model
    """
    global _mlx_whisper_model_name
    
    if model_name not in _available_models:
        raise HTTPException(status_code=400, detail=f"Invalid model. Must be one of: {list(_available_models.keys())}")
    
    try:
        # Update the model
        _mlx_whisper_model_name = _available_models[model_name]
        
        return {
            "message": f"Successfully switched to {model_name} model (GPU-accelerated)", 
            "model": model_name,
            "hf_repo": _mlx_whisper_model_name,
            "engine": "mlx-whisper-gpu"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to switch model: {str(e)}")

@router.get("/health")
async def stt_health():
    """
    Check if MLX-Whisper STT is working
    """
    try:
        current_model = _mlx_whisper_model_name.split('/')[-1].replace('whisper-', '').replace('-mlx', '')
        return {
            "status": "ok", 
            "stt_engine": "mlx-whisper-gpu",
            "model": current_model,
            "hf_repo": _mlx_whisper_model_name,
            "device": "Apple Silicon GPU (MLX)",
            "device_info": "Running on Apple Silicon GPU via MLX framework"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

@router.get("/benchmark")
async def benchmark_models():
    """
    Benchmark different MLX-Whisper models
    """
    try:
        # Create a short test audio
        import numpy as np
        import wave
        
        # Generate 3 seconds of test audio
        sample_rate = 16000
        duration = 3
        frequency = 440
        
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        audio_data = np.sin(frequency * 2 * np.pi * t)
        
        # Save as temporary WAV file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            temp_path = f.name
            with wave.open(temp_path, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes((audio_data * 32767).astype(np.int16).tobytes())
        
        try:
            results = []
            for model_name, hf_repo in _available_models.items():
                try:
                    start_time = time.time()
                    result = mlx_whisper.transcribe(temp_path, path_or_hf_repo=hf_repo)
                    end_time = time.time()
                    
                    results.append({
                        "model": model_name,
                        "time": round(end_time - start_time, 2),
                        "text": result["text"].strip(),
                        "status": "success"
                    })
                except Exception as e:
                    results.append({
                        "model": model_name,
                        "time": None,
                        "text": None,
                        "status": f"error: {str(e)}"
                    })
            
            return {"benchmark_results": results, "audio_duration": duration}
        
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Benchmark failed: {str(e)}")
