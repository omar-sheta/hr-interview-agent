"""
Pydantic models for request/response validation.

All data models used across the HR Interview Agent API.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


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


class SignUpRequest(BaseModel):
    username: str
    password: str
    email: str


class CandidateInterviewStartRequest(BaseModel):
    candidate_id: str


class AdminInterviewCreateRequest(BaseModel):
    admin_id: str
    title: str
    description: Optional[str] = None
    config: Dict[str, Any] = {}
    allowed_candidate_ids: List[str] = []
    deadline: Optional[str] = None
    active: bool = True


class AdminInterviewUpdateRequest(BaseModel):
    admin_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    allowed_candidate_ids: Optional[List[str]] = None
    deadline: Optional[str] = None
    active: Optional[bool] = None
