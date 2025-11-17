"""
HR Interview Agent - Python Client

A simple Python client to interact with the HR Interview Agent server.
Provides a clean API for client applications.
"""

import requests
import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
import io


class HRInterviewClient:
    """Python client for HR Interview Agent server."""
    
    def __init__(self, server_url: str = "http://localhost:8001"):
        """Initialize client with server URL."""
        self.base_url = server_url.rstrip("/")
        self.session = requests.Session()
    
    def health_check(self) -> Dict[str, Any]:
        """Check server health status."""
        try:
            response = self.session.get(f"{self.base_url}/health")
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"status": "error", "message": str(e)}
    
    def transcribe_audio(self, audio_file_path: str, detailed: bool = False) -> Dict[str, Any]:
        """Transcribe audio file to text."""
        try:
            with open(audio_file_path, 'rb') as audio_file:
                files = {'audio': (os.path.basename(audio_file_path), audio_file, 'audio/wav')}
                data = {'detailed': detailed}
                
                response = self.session.post(
                    f"{self.base_url}/transcribe",
                    files=files,
                    data=data
                )
                response.raise_for_status()
                return response.json()
        except (requests.RequestException, FileNotFoundError) as e:
            return {"error": str(e)}
    
    def transcribe_audio_bytes(self, audio_bytes: bytes, filename: str = "audio.wav", detailed: bool = False) -> Dict[str, Any]:
        """Transcribe audio bytes to text."""
        try:
            files = {'audio': (filename, io.BytesIO(audio_bytes), 'audio/wav')}
            data = {'detailed': detailed}
            
            response = self.session.post(
                f"{self.base_url}/transcribe",
                files=files,
                data=data
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"error": str(e)}
    
    def synthesize_speech(self, text: str, voice: str = "en_US-amy-medium") -> bytes:
        """Synthesize text to speech and return audio bytes."""
        try:
            response = self.session.post(
                f"{self.base_url}/synthesize",
                json={"text": text, "voice": voice}
            )
            response.raise_for_status()
            return response.content
        except requests.RequestException as e:
            raise Exception(f"Speech synthesis failed: {e}")
    
    def generate_text(
        self,
        messages: List[Dict[str, str]],
        model: str = "gemma3:27b",
        temperature: float = 0.7,
        max_tokens: int = 1000,
        prompt: Optional[str] = None,
        job_description: Optional[str] = None,
        job_role: Optional[str] = None,
        num_questions: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generate text/questions using LLM with optional job context."""
        try:
            payload: Dict[str, Any] = {
                "messages": messages,
                "model": model,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            if prompt:
                payload["prompt"] = prompt
            if job_description:
                payload["job_description"] = job_description
            if job_role:
                payload["job_role"] = job_role
            if num_questions is not None:
                payload["num_questions"] = num_questions

            response = self.session.post(
                f"{self.base_url}/generate",
                json=payload
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"error": str(e)}
    
    def start_interview(self, candidate_name: Optional[str] = None, 
                       job_role: Optional[str] = None, num_questions: int = 3) -> Dict[str, Any]:
        """Start a new interview session."""
        try:
            response = self.session.post(
                f"{self.base_url}/interview/start",
                json={
                    "candidate_name": candidate_name,
                    "job_role": job_role,
                    "num_questions": num_questions
                }
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"error": str(e)}
    
    def get_interview_session(self, session_id: str) -> Dict[str, Any]:
        """Get interview session details."""
        try:
            response = self.session.get(f"{self.base_url}/interview/{session_id}")
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"error": str(e)}
    
    def submit_response(self, session_id: str, question_index: int, audio_file_path: str) -> Dict[str, Any]:
        """Submit interview response with audio file."""
        try:
            with open(audio_file_path, 'rb') as audio_file:
                files = {'audio': (os.path.basename(audio_file_path), audio_file, 'audio/wav')}
                data = {
                    'session_id': session_id,
                    'question_index': question_index
                }
                
                response = self.session.post(
                    f"{self.base_url}/interview/submit",
                    files=files,
                    data=data
                )
                response.raise_for_status()
                return response.json()
        except (requests.RequestException, FileNotFoundError) as e:
            return {"error": str(e)}
    
    def submit_response_bytes(self, session_id: str, question_index: int, 
                            audio_bytes: bytes, filename: str = "response.wav") -> Dict[str, Any]:
        """Submit interview response with audio bytes."""
        try:
            files = {'audio': (filename, io.BytesIO(audio_bytes), 'audio/wav')}
            data = {
                'session_id': session_id,
                'question_index': question_index
            }
            
            response = self.session.post(
                f"{self.base_url}/interview/submit",
                files=files,
                data=data
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"error": str(e)}
    
    def get_interview_results(self, session_id: str) -> Dict[str, Any]:
        """Get interview results and scoring."""
        try:
            response = self.session.get(f"{self.base_url}/interview/{session_id}/results")
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"error": str(e)}


# Convenience functions for quick usage
def quick_transcribe(audio_file_path: str, server_url: str = "http://localhost:8001") -> str:
    """Quick transcription of an audio file."""
    client = HRInterviewClient(server_url)
    result = client.transcribe_audio(audio_file_path)
    return result.get("transcript", "")


def quick_synthesize(text: str, output_file: str, server_url: str = "http://localhost:8001"):
    """Quick synthesis of text to audio file."""
    client = HRInterviewClient(server_url)
    audio_bytes = client.synthesize_speech(text)
    with open(output_file, 'wb') as f:
        f.write(audio_bytes)


def quick_chat(message: str, server_url: str = "http://localhost:8001") -> str:
    """Quick chat with the LLM."""
    client = HRInterviewClient(server_url)
    result = client.generate_text([{"role": "user", "content": message}])
    return result.get("content", "")


# Example usage
if __name__ == "__main__":
    # Initialize client
    client = HRInterviewClient()
    
    # Check server health
    health = client.health_check()
    print("Server Health:", health)
    
    # Example: Start an interview
    interview = client.start_interview(
        candidate_name="John Doe",
        job_role="Python Developer",
        num_questions=2
    )
    
    if "session_id" in interview:
        print(f"Interview started: {interview['session_id']}")
        print("Questions:")
        for i, question in enumerate(interview['questions']):
            print(f"{i+1}. {question}")
    else:
        print("Failed to start interview:", interview.get("error"))
    
    # Example: Generate some text
    chat_result = client.generate_text([
        {"role": "user", "content": "What makes a good software developer?"}
    ])
    
    if "content" in chat_result:
        print("\nLLM Response:", chat_result["content"])
    else:
        print("LLM failed:", chat_result.get("error"))