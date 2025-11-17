from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import requests
from datetime import datetime

from hr_agent_trial.config import settings

router = APIRouter()

class QuestionGenerationRequest(BaseModel):
    job_description: str
    num_questions: int = 2  # Default to 2 questions

class QuestionModificationRequest(BaseModel):
    question: str
    modification_request: str
    job_description: str

class QuestionApprovalRequest(BaseModel):
    questions: List[str]
    approved_indices: List[int]
    job_description: str

@router.post("/generate")
async def generate_questions(request: QuestionGenerationRequest):
    """
    Generate interview questions from a job description.
    """
    try:
        prompt = f"""Generate exactly {request.num_questions} interview questions for the following job description. 

Job Description:
{request.job_description}

Instructions:
- Generate ONLY the questions, one per line
- Each question should be clear, professional, and directly related to the job
- No numbering, no extra text, no explanations
- Just the plain question text
- Make questions specific to the role and skills mentioned

Example format:
Tell me about your experience with [specific technology/skill mentioned].
How would you handle [specific scenario related to the job]?
What is your approach to [relevant work process]?

Questions:"""

        response = ollama.generate(model=settings.OLLAMA_MODEL, prompt=prompt)
        
        # Clean and parse the response
        response_text = response['response'].strip()
        
        # Split by lines and clean up
        lines = [line.strip() for line in response_text.split('\n') if line.strip()]
        
        # Remove any numbering, bullets, or prefixes
        questions = []
        for line in lines:
            # Remove common prefixes like "1.", "Q:", "Question:", etc.
            cleaned = line
            # Remove numbering like "1. ", "2. ", etc.
            if cleaned and cleaned[0].isdigit():
                cleaned = cleaned.split('.', 1)[-1].strip()
            # Remove Q: or Question: prefixes
            if cleaned.lower().startswith('q:'):
                cleaned = cleaned[2:].strip()
            if cleaned.lower().startswith('question:'):
                cleaned = cleaned[9:].strip()
            # Remove bullet points
            if cleaned.startswith('- '):
                cleaned = cleaned[2:].strip()
            if cleaned.startswith('* '):
                cleaned = cleaned[2:].strip()
            
            if cleaned and cleaned.endswith('?'):
                questions.append(cleaned)
        
        # Ensure we have the requested number of questions
        if len(questions) < request.num_questions:
            # If we don't have enough, generate more
            additional_needed = request.num_questions - len(questions)
            fallback_questions = [
                "Tell me about yourself and your relevant experience.",
                "What interests you most about this position?",
                "Describe a challenging project you've worked on.",
                "How do you handle working under pressure?",
                "Where do you see yourself in five years?"
            ]
            questions.extend(fallback_questions[:additional_needed])
        
        # Take only the requested number
        questions = questions[:request.num_questions]
        
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/modify")
async def modify_question(request: QuestionModificationRequest):
    """Modify a question based on HR feedback using AI"""
    try:
        prompt = f"""You are an expert HR interviewer. Please modify the following interview question based on the specific feedback provided.

Job Description Context:
{request.job_description}

Original Question:
{request.question}

Modification Request:
{request.modification_request}

Please provide a single, improved question that addresses the feedback while maintaining professional interview standards. Return only the modified question, nothing else."""

        response = ollama.generate(model=settings.OLLAMA_MODEL, prompt=prompt)
        
        modified_question = response['response'].strip()
        
        # Clean up the response to get just the question
        lines = modified_question.split('\n')
        for line in lines:
            line = line.strip()
            if line and '?' in line:
                return {"modified_question": line}
        
        return {"modified_question": modified_question}
        
    except Exception as e:
        print(f"Error modifying question: {e}")
        raise HTTPException(status_code=500, detail=f"Error modifying question: {str(e)}")

@router.post("/approve")
async def approve_questions(request: QuestionApprovalRequest):
    """Approve final set of questions for interview"""
    try:
        approved_questions = []
        for i in request.approved_indices:
            if 0 <= i < len(request.questions):
                approved_questions.append(request.questions[i])
        
        return {
            "approved_questions": approved_questions,
            "count": len(approved_questions),
            "message": f"Successfully approved {len(approved_questions)} questions for interview"
        }
        
    except Exception as e:
        print(f"Error approving questions: {e}")
        raise HTTPException(status_code=500, detail=f"Error approving questions: {str(e)}")
