"""
Model management for pre-loaded MLX-Whisper models at startup (GPU optimized, no regular Whisper)
"""
import logging

logger = logging.getLogger(__name__)

# Global model storage
_mlx_whisper_model = None

def load_models():
    """Pre-load MLX-Whisper models at startup (Apple Silicon GPU optimized)"""
    global _mlx_whisper_model
    
    logger.info("Loading MLX-Whisper models...")
    
    # Load MLX-Whisper only (no regular Whisper to avoid downloads)
    try:
        import mlx_whisper
        logger.info("Loading MLX-Whisper large model (GPU-accelerated)...")
        _mlx_whisper_model = "mlx-community/whisper-large-v3-mlx"
        logger.info("✅ MLX-Whisper model loaded successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to load MLX-Whisper: {e}")
        _mlx_whisper_model = None
        return False

def get_mlx_model():
    """Get the pre-loaded MLX-Whisper model"""
    return _mlx_whisper_model

def transcribe_with_mlx(audio_path: str) -> str:
    """Transcribe audio using MLX-Whisper"""
    if _mlx_whisper_model is None:
        raise RuntimeError("MLX-Whisper model not loaded")
    
    import mlx_whisper
    import os
    import tempfile
    import subprocess
    
    # Convert WebM/MP4/M4A to WAV if needed for better compatibility
    converted_path = audio_path
    lower = audio_path.lower()
    if lower.endswith('.webm') or lower.endswith('.mp4') or lower.endswith('.m4a') or lower.endswith('.mov'):
        print(f"🔄 Converting to 16kHz mono WAV for better compatibility...")
        temp_wav = tempfile.mktemp(suffix='.wav')
        conversion_success = False
        
        try:
            # First attempt: standard conversion with extra parsing help
            cmd = [
                'ffmpeg',
                '-hide_banner', '-loglevel', 'error',
                '-y',
                '-fflags', '+genpts',
                '-probesize', '10M',
                '-analyzeduration', '10M',
                '-i', audio_path,
                '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
                temp_wav
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                converted_path = temp_wav
                conversion_success = True
                print(f"✅ Converted to: {temp_wav}")
            else:
                print(f"⚠️ Conversion failed, retrying with different flags: {result.stderr}")
                
                # Second attempt: more tolerant flags for corrupted containers
                cmd2 = [
                    'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    '-fflags', '+discardcorrupt+igndts',
                    '-probesize', '50M', '-analyzeduration', '50M',
                    '-err_detect', 'ignore_err',
                    '-i', audio_path,
                    '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
                    temp_wav
                ]
                result2 = subprocess.run(cmd2, capture_output=True, text=True)
                if result2.returncode == 0:
                    converted_path = temp_wav
                    conversion_success = True
                    print(f"✅ Converted on retry to: {temp_wav}")
                else:
                    print(f"⚠️ Second conversion attempt failed: {result2.stderr}")
                    
                    # Third attempt: try to extract raw audio data using different approach
                    cmd3 = [
                        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                        '-f', 'mov,mp4,m4a,3gp,3g2,mj2' if lower.endswith('.mp4') else 'matroska,webm',
                        '-fflags', '+discardcorrupt+igndts+ignidx',
                        '-err_detect', 'ignore_err',
                        '-i', audio_path,
                        '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
                        '-f', 'wav',
                        temp_wav
                    ]
                    result3 = subprocess.run(cmd3, capture_output=True, text=True)
                    if result3.returncode == 0:
                        converted_path = temp_wav
                        conversion_success = True
                        print(f"✅ Converted on third attempt to: {temp_wav}")
                    else:
                        print(f"⚠️ All conversion attempts failed, using original: {result3.stderr}")
                        # Check if the file is completely corrupted by trying to get basic info
                        try:
                            cmd_info = ['ffprobe', '-hide_banner', '-loglevel', 'error', '-i', audio_path]
                            info_result = subprocess.run(cmd_info, capture_output=True, text=True)
                            if info_result.returncode != 0 and "Invalid data found when processing input" in info_result.stderr:
                                raise RuntimeError(f"Audio file appears to be corrupted and cannot be processed: {audio_path}")
                        except Exception:
                            pass  # If ffprobe fails, we'll still try to process the original
                        
        except Exception as e:
            print(f"⚠️ Conversion error, using original: {e}")
    
    print(f"🎤 MLX-Whisper transcribing: {converted_path}")
    result = mlx_whisper.transcribe(converted_path, path_or_hf_repo=_mlx_whisper_model)
    text = result["text"].strip()
    segments = result.get("segments", [])
    language = result.get("language", "unknown")
    
    print(f"📝 MLX Result: text='{text}', segments={len(segments)}, language={language}")
    
    # If no text but there are segments, try extracting from segments
    if not text and segments:
        segment_texts = [seg.get("text", "").strip() for seg in segments]
        text = " ".join(segment_texts).strip()
        print(f"📋 Extracted from segments: '{text}'")
    
    # Clean up temporary file
    if converted_path != audio_path and os.path.exists(converted_path):
        try:
            os.unlink(converted_path)
        except:
            pass
    
    return text

def transcribe_audio(audio_path: str) -> str:
    """Main transcription function - use only MLX-Whisper"""
    try:
        return transcribe_with_mlx(audio_path)
    except Exception as e:
        logger.error(f"MLX transcription failed: {e}")
        try:
            import os
            size = os.path.getsize(audio_path) if os.path.exists(audio_path) else 'N/A'
            print(f"❌ MLX transcription failed for '{audio_path}' size={size}: {e}")
        except Exception:
            pass
        # Return a more informative reason to the user/UI
        return "[Transcription failed - please try again]"

def get_model_status():
    """Check if models are loaded"""
    return {
        "mlx_whisper": _mlx_whisper_model is not None,
        "regular_whisper": False  # We're not using regular whisper
    }