from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import whisper
import tempfile
import os
import torch
from hr_agent_trial.config import settings

router = APIRouter()

# Global variable to store the loaded Whisper model
_whisper_model = None
_model_size = "medium"  # Can be: tiny, base, small, medium, large

# Determine the best device for inference
def get_device():
    """Get the best available device for Whisper inference"""
    # Note: As of 2025, Whisper has compatibility issues with MPS backend
    # Using CPU for reliability until MPS support is more stable
    if torch.cuda.is_available():
        return "cuda"  # NVIDIA GPU
    else:
        return "cpu"   # CPU fallback (most reliable for Whisper)
    
    # Uncomment below to try MPS when compatibility improves
    # if torch.backends.mps.is_available():
    #     return "mps"  # Apple Silicon GPU

def get_whisper_model():
    """Load Whisper model lazily"""
    global _whisper_model
    if _whisper_model is None:
        try:
            device = get_device()
            print(f"Loading Whisper {_model_size} model on {device}... (this may take a while the first time)")
            _whisper_model = whisper.load_model(_model_size, device=device)
            print(f"Whisper {_model_size} model loaded successfully on {device}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load Whisper model: {str(e)}")
    return _whisper_model

@router.post("/transcribe")
async def transcribe_audio(audio_file: UploadFile = File(...)):
    """
    Transcribe audio using Whisper
    """
    try:
        # Validate file type
        if not audio_file.content_type or not audio_file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be an audio file")
        
        # Get the Whisper model
        model = get_whisper_model()
        
        # Create a temporary file for the uploaded audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as temp_file:
            temp_path = temp_file.name
            # Write uploaded file to temporary file
            content = await audio_file.read()
            temp_file.write(content)
        
        try:
            # Transcribe the audio
            result = model.transcribe(temp_path)
            
            return {
                "text": result["text"].strip(),
                "language": result.get("language", "unknown"),
                "segments": [
                    {
                        "start": segment["start"],
                        "end": segment["end"],
                        "text": segment["text"].strip()
                    }
                    for segment in result.get("segments", [])
                ]
            }
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@router.get("/models")
async def get_available_models():
    """
    Get list of available Whisper models
    """
    models = [
        {"name": "tiny", "size": "~39 MB", "speed": "Very Fast", "accuracy": "Basic"},
        {"name": "base", "size": "~74 MB", "speed": "Fast", "accuracy": "Good"},
        {"name": "small", "size": "~244 MB", "speed": "Medium", "accuracy": "Better"},
        {"name": "medium", "size": "~769 MB", "speed": "Slow", "accuracy": "Very Good"},
        {"name": "large", "size": "~1550 MB", "speed": "Very Slow", "accuracy": "Best"},
    ]
    return {"models": models, "current": _model_size}

@router.post("/switch_model")
async def switch_model(model_name: str):
    """
    Switch to a different Whisper model
    """
    global _whisper_model, _model_size
    valid_models = ["tiny", "base", "small", "medium", "large"]
    
    if model_name not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model. Must be one of: {valid_models}")
    
    try:
        # Clear the current model
        _whisper_model = None
        _model_size = model_name
        
        # Load the new model
        model = get_whisper_model()
        device = get_device()
        
        return {
            "message": f"Successfully switched to {model_name} model on {device.upper()}", 
            "model": model_name,
            "device": device
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to switch model: {str(e)}")

@router.get("/health")
async def stt_health():
    """
    Check if Whisper STT is working
    """
    try:
        model = get_whisper_model()
        device = get_device()
        return {
            "status": "ok", 
            "stt_engine": "whisper", 
            "model": _model_size,
            "device": device,
            "device_info": f"Running on {device.upper()}"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
