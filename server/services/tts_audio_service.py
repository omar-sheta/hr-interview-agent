"""
TTS service wrapper for generating and caching audio files.
"""
from pathlib import Path
import logging
from typing import Optional
from .tts import (
    get_piper_voice,
    _prepare_text,
    _synthesize_to_wav_bytes,
    TTS_AVAILABLE
)

logger = logging.getLogger("hr_interview_agent.tts_service")

# Audio storage directory
AUDIO_DIR = Path("server/data/audio/questions")
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def generate_question_audio(interview_id: str, question_index: int, question_text: str) -> Optional[str]:
    """
    Generate TTS audio for a question and save it to disk.
    
    Args:
        interview_id: ID of the interview
        question_index: Index of the question (0-based)
        question_text: Text of the question to speak
        
    Returns:
        Filename of the generated audio file, or None if TTS unavailable
    """
    if not TTS_AVAILABLE:
        logger.warning("⚠️ TTS not available, skipping audio generation")
        return None
    
    try:
        # Create filename
        filename = f"{interview_id}_q{question_index}.wav"
        filepath = AUDIO_DIR / filename
        
        # Skip if already exists
        if filepath.exists():
            logger.info(f"♻️ Audio file already exists: {filename}")
            return filename
        
        # Generate audio
        logger.info(f"🎤 Generating TTS for question {question_index}: {question_text[:50]}...")
        voice = get_piper_voice()
        prepared_text = _prepare_text(question_text)
        audio_bytes = _synthesize_to_wav_bytes(voice, prepared_text)
        
        # Save to file
        with open(filepath, 'wb') as f:
            f.write(audio_bytes)
        
        logger.info(f"✅ Generated audio file: {filename} ({len(audio_bytes)} bytes)")
        return filename
        
    except Exception as e:
        logger.error(f"❌ Failed to generate audio for question {question_index}: {e}")
        return None


def generate_interview_audio(interview_id: str, questions: list[str]) -> list[str]:
    """
    Generate TTS audio for all questions in an interview.
    
    Args:
        interview_id: ID of the interview
        questions: List of question texts
        
    Returns:
        List of audio filenames (may contain None for failed generations)
    """
    audio_files = []
    for i, question in enumerate(questions):
        filename = generate_question_audio(interview_id, i, question)
        audio_files.append(filename)
    
    return audio_files


def get_audio_path(interview_id: str, question_index: int) -> Optional[Path]:
    """
    Get the path to a pre-generated audio file.
    
    Args:
        interview_id: ID of the interview
        question_index: Index of the question (0-based)
        
    Returns:
        Path to the audio file if it exists, None otherwise
    """
    filename = f"{interview_id}_q{question_index}.wav"
    filepath = AUDIO_DIR / filename
    
    if filepath.exists():
        return filepath
    
    return None
