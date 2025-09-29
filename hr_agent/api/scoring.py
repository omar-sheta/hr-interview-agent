"""
HR Interview Scoring API using Gemma model
"""
import logging
import json
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests

router = APIRouter()
logger = logging.getLogger(__name__)

class ScoringRequest(BaseModel):
    transcript: str
    question: str

class ScoringResponse(BaseModel):
    linguistic_score: float
    behavioral_score: float
    final_score: float
    detailed_scores: Dict[str, Any]
    summary: str

OLLAMA_URL = "http://localhost:11434/api/generate"
SCORING_PROMPT_TEMPLATE = """You are an HR evaluation assistant. Your task is to analyze an interview transcript and provide scores on a rubric. Evaluate both linguistic and behavioral dimensions. Give each category a score out of 10 and include a short justification. Provide a final weighted score out of 10.

Rubric:
1. Linguistic Competence (50%)
- Clarity & Structure (0–10): Are responses well-structured, clear, and easy to follow?
- Grammar & Vocabulary (0–10): Is the candidate's language professional, correct, and varied?
- Conciseness & Relevance (0–10): Does the candidate avoid filler words and stay on point?
Overall Linguistic Score = Average of the three above.

2. Behavioral Competence (50%)
- Professionalism (0–10): Politeness, tone, and ability to maintain professionalism.
- Confidence & Delivery (0–10): Does the candidate project confidence and self-assurance?
- Engagement & Adaptability (0–10): Does the candidate answer thoughtfully, adapt to questions, and show enthusiasm?
Overall Behavioral Score = Average of the three above.

Scoring:
Final Score (out of 10) = (Linguistic Score × 0.5) + (Behavioral Score × 0.5).

Provide category breakdowns + a summary paragraph of strengths and improvement areas.

Example Output Format:
Linguistic:
Clarity & Structure: 8/10 – Clear answers but sometimes meandering.
Grammar & Vocabulary: 9/10 – Strong command of language.
Conciseness: 7/10 – Could reduce filler words.
Linguistic Avg: 8.0/10

Behavioral:
Professionalism: 9/10 – Polite and respectful tone.
Confidence: 7/10 – Slight hesitation noted in complex answers.
Engagement: 8/10 – Good adaptability and enthusiasm.
Behavioral Avg: 8.0/10

Final Score: 8.0/10

Summary: Candidate communicates clearly with strong professionalism. Needs to reduce filler words and maintain steadier confidence in technical discussions.

QUESTION: {question}

TRANSCRIPT TO EVALUATE:
{transcript}

EVALUATION:"""

def call_ollama_gemma(prompt: str) -> str:
    """Call Ollama with Gemma model to get evaluation"""
    try:
        payload = {
            "model": "gemma3:27b",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,  # Lower temperature for consistent scoring
                "top_p": 0.9,
                "max_tokens": 1000
            }
        }
        
        logger.info("🤖 Calling Gemma model for scoring...")
        response = requests.post(OLLAMA_URL, json=payload, timeout=180)  # 3 minutes for Gemma
        response.raise_for_status()
        
        result = response.json()
        evaluation_text = result.get("response", "").strip()
        
        logger.info(f"✅ Gemma evaluation received: {len(evaluation_text)} characters")
        return evaluation_text
        
    except requests.exceptions.Timeout:
        logger.error("❌ Ollama request timed out")
        raise HTTPException(status_code=504, detail="Scoring service timed out")
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Ollama request failed: {e}")
        raise HTTPException(status_code=503, detail="Scoring service unavailable")
    except Exception as e:
        logger.error(f"❌ Unexpected error calling Gemma: {e}")
        raise HTTPException(status_code=500, detail="Internal scoring error")

def parse_evaluation_scores(evaluation_text: str) -> Dict[str, Any]:
    """Parse the evaluation text to extract numerical scores"""
    scores = {
        "clarity_structure": 0.0,
        "grammar_vocabulary": 0.0,
        "conciseness_relevance": 0.0,
        "professionalism": 0.0,
        "confidence_delivery": 0.0,
        "engagement_adaptability": 0.0,
        "linguistic_avg": 0.0,
        "behavioral_avg": 0.0,
        "final_score": 0.0
    }
    
    # Simple parsing - extract numbers after score patterns
    lines = evaluation_text.split('\n')
    
    for line in lines:
        line = line.strip()
        if "Clarity & Structure:" in line:
            scores["clarity_structure"] = extract_score(line)
        elif "Grammar & Vocabulary:" in line:
            scores["grammar_vocabulary"] = extract_score(line)
        elif "Conciseness" in line:
            scores["conciseness_relevance"] = extract_score(line)
        elif "Professionalism:" in line:
            scores["professionalism"] = extract_score(line)
        elif "Confidence:" in line:
            scores["confidence_delivery"] = extract_score(line)
        elif "Engagement:" in line:
            scores["engagement_adaptability"] = extract_score(line)
        elif "Linguistic Avg:" in line:
            scores["linguistic_avg"] = extract_score(line)
        elif "Behavioral Avg:" in line:
            scores["behavioral_avg"] = extract_score(line)
        elif "Final Score:" in line:
            scores["final_score"] = extract_score(line)
    
    # Calculate averages if not provided
    if scores["linguistic_avg"] == 0.0:
        scores["linguistic_avg"] = (scores["clarity_structure"] + 
                                   scores["grammar_vocabulary"] + 
                                   scores["conciseness_relevance"]) / 3
    
    if scores["behavioral_avg"] == 0.0:
        scores["behavioral_avg"] = (scores["professionalism"] + 
                                   scores["confidence_delivery"] + 
                                   scores["engagement_adaptability"]) / 3
    
    if scores["final_score"] == 0.0:
        scores["final_score"] = (scores["linguistic_avg"] * 0.5) + (scores["behavioral_avg"] * 0.5)
    
    return scores

def extract_score(line: str) -> float:
    """Extract numerical score from a line like 'Category: 8/10 – description'"""
    try:
        # Look for pattern like "8/10" or "8.5/10"
        import re
        match = re.search(r'(\d+\.?\d*)/10', line)
        if match:
            return float(match.group(1))
        
        # Look for standalone numbers at the beginning
        match = re.search(r'^.*?(\d+\.?\d*)', line)
        if match:
            score = float(match.group(1))
            if 0 <= score <= 10:
                return score
    except (ValueError, AttributeError):
        pass
    
    return 0.0

@router.post("/score", response_model=ScoringResponse)
async def score_interview_response(request: ScoringRequest):
    """Score an interview response using Gemma model"""
    logger.info(f"📊 Scoring request: question_length={len(request.question)}, transcript_length={len(request.transcript)}")
    
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")
    
    if len(request.transcript) < 10:
        raise HTTPException(status_code=400, detail="Transcript too short for meaningful evaluation")
    
    try:
        # Format the prompt
        prompt = SCORING_PROMPT_TEMPLATE.format(
            question=request.question,
            transcript=request.transcript
        )
        
        # Get evaluation from Gemma
        evaluation_text = call_ollama_gemma(prompt)
        
        # Parse scores
        detailed_scores = parse_evaluation_scores(evaluation_text)
        
        # Extract summary (last paragraph usually)
        summary_lines = [line.strip() for line in evaluation_text.split('\n') if line.strip()]
        summary = ""
        for line in reversed(summary_lines):
            if "Summary:" in line:
                summary = line.replace("Summary:", "").strip()
                break
        
        if not summary:
            # If no explicit summary found, use the last substantial line
            for line in reversed(summary_lines):
                if len(line) > 50 and not any(keyword in line.lower() for keyword in ["score", "avg", "/"]):
                    summary = line
                    break
        
        if not summary:
            summary = "Evaluation completed. Review detailed scores above."
        
        response = ScoringResponse(
            linguistic_score=detailed_scores["linguistic_avg"],
            behavioral_score=detailed_scores["behavioral_avg"],
            final_score=detailed_scores["final_score"],
            detailed_scores=detailed_scores,
            summary=summary
        )
        
        logger.info(f"✅ Scoring completed: final_score={response.final_score:.1f}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Scoring failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check for scoring service"""
    try:
        # Test Ollama connection
        test_payload = {
            "model": "gemma3:27b",
            "prompt": "Test",
            "stream": False,
            "options": {"max_tokens": 1}
        }
        response = requests.post(OLLAMA_URL, json=test_payload, timeout=10)
        if response.status_code == 200:
            return {"status": "healthy", "gemma_model": "available"}
        else:
            return {"status": "degraded", "error": "Gemma model not responding"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}