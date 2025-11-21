"""
Question generation service.

Handles question generation using LLM (Ollama) with template-based fallback.
"""

import logging
import re
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..config import settings
from ..models.schemas import GenerateRequest
from ..utils.helpers import check_ollama_available

logger = logging.getLogger("hr_interview_agent.question_service")

# Stop words to filter from keyword extraction
STOP_WORDS = {
    "the", "and", "with", "from", "this", "that", "have", "will", "your",
    "about", "using", "experience", "skills", "team", "work", "role",
    "responsibilities", "ability", "strong", "knowledge", "prior", "must",
    "should", "high", "level", "for", "collaborate", "understanding", "tools",
    "software", "across", "years", "such", "including", "support", "business",
    "drive", "create", "range", "excellent", "communication", "solve",
    "build", "focus", "design", "deliver", "manage", "ensure",
}

# Additional stop words for job postings
EXTENDED_STOP_WORDS = {
    'are', 'is', 'am', 'be', 'being', 'been', 'a', 'an', 'the', 'in', 'on', 'at', 'by', 'for', 'to',
    'of', 'with', 'we', 'you', 'they', 'job', 'position', 'looking', 'seeking', 'candidate', 'role',
    'hire', 'hiring', 'apply', 'applicant', 'your', 'our', 'this', 'that', "we're", "we've"
}

STOP_WORDS.update(EXTENDED_STOP_WORDS)

# Question templates using keywords
TEMPLATES_KEYWORD = [
    "Can you walk me through a recent project where you applied {keyword}?",
    "How do you stay current with best practices around {keyword}?",
    "Describe a complex challenge involving {keyword} and how you solved it.",
    "How would you leverage {keyword} to deliver value as a {role}?",
    "Tell me about a time you led a team while focusing on {keyword}.",
    "What metrics do you track to measure success when working with {keyword}?",
    "How do you mentor teammates who are newer to {keyword}?",
]

# General question templates
TEMPLATES_GENERAL = [
    "What excites you most about contributing as a {role}?",
    "How do you prioritize competing deadlines in a fast-paced environment?",
    "Describe how you ensure communication stays clear across cross-functional partners.",
    "Walk me through your approach to planning the first 90 days in this {role} role.",
    "How do you evaluate whether a solution truly solved the original problem?",
]


def extract_keywords(text: Optional[str], max_keywords: int = 8) -> List[str]:
    """Extract relevant keywords from text, filtering stop words."""
    if not text:
        return []
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9+\-#]*", text.lower())
    keywords: List[str] = []
    for token in tokens:
        if len(token) < 3 or token in STOP_WORDS:
            continue
        if token not in keywords:
            keywords.append(token)
        if len(keywords) >= max_keywords:
            break
    return keywords


def extract_questions_from_text(content: str, max_questions: int) -> List[str]:
    """Parse LLM-generated text to extract clean questions."""
    lines: List[str] = []
    
    # Split by lines and process each
    for line in content.splitlines():
        clean = line.strip()
        if not clean:
            continue
            
        # Skip lines that are obviously not questions
        if any(clean.lower().startswith(skip) for skip in ['**', 'why it', 'what you', 'ideal answer', 'good answer', 'red flags', 'difficulty:']):
            continue
            
        # Remove numbering, bullets, and markdown
        clean = re.sub(r"^\*+\s*", "", clean)  # Remove markdown asterisks
        clean = re.sub(r"^\d+[\).\-]\s*", "", clean)  # Remove numbering
        clean = re.sub(r"^[\-\*]\s*", "", clean)  # Remove bullets
        clean = re.sub(r"^\*\*.*?\*\*:?\s*", "", clean)  # Remove bold markdown
        
        # Skip if it's still not a proper question after cleaning
        if len(clean) < 10:
            continue
            
        # Ensure it ends with a question mark
        if not clean.endswith("?"):
            clean = clean.rstrip(".")
            clean = clean + "?"
            
        # Only keep lines that look like actual questions
        if "?" in clean and len(clean.split()) >= 5:
            lines.append(clean)

    # If we didn't get enough questions from line splitting, try different approach
    if len(lines) < max_questions:
        # Split by question marks and clean up
        chunks = [chunk.strip() for chunk in re.split(r"\?\s*", content) if chunk.strip()]
        for chunk in chunks[:max_questions]:
            if len(chunk) > 10 and len(chunk.split()) >= 5:
                question = chunk + "?"
                # Clean up any remaining formatting
                question = re.sub(r"^\*+\s*", "", question)
                question = re.sub(r"^\d+[\).\-]\s*", "", question)
                if question not in lines:
                    lines.append(question)

    return lines[:max_questions]


def generate_questions_locally(
    job_description: Optional[str],
    num_questions: int,
    job_role: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Generate interview questions using template-based approach (fallback)."""
    role_phrase = job_role or "this role"
    keywords = extract_keywords(job_description)
    if not keywords and job_role:
        keywords = extract_keywords(job_role)
    if not keywords:
        keywords = ["problem solving", "stakeholder communication", "continuous improvement"]

    questions: List[Dict[str, Any]] = []
    
    # Generate mix of technical and behavioral questions
    # Technical templates (keyword-based)
    for template in TEMPLATES_KEYWORD:
        if len(questions) >= num_questions:
            break
        keyword = keywords[len(questions) % len(keywords)]
        questions.append({
            "question": template.format(role=role_phrase, keyword=keyword),
            "index": len(questions),
            "type": "technical",
            "scoring_criteria": "Evaluate based on clarity, depth, and relevance"
        })

    # Behavioral templates (general)
    for template in TEMPLATES_GENERAL:
        if len(questions) >= num_questions:
            break
        questions.append({
            "question": template.format(role=role_phrase),
            "index": len(questions),
            "type": "behavioral",
            "scoring_criteria": "Evaluate based on clarity, depth, and relevance"
        })

    # Fill remaining with technical questions
    while len(questions) < num_questions:
        keyword = keywords[len(questions) % len(keywords)]
        questions.append({
            "question": f"What best practices have you developed around {keyword}?",
            "index": len(questions),
            "type": "technical",
            "scoring_criteria": "Evaluate based on clarity, depth, and relevance"
        })

    return questions[:num_questions]


def infer_job_description(prompt: Optional[str], messages: List[Dict[str, str]]) -> Optional[str]:
    """Extract job description from prompt or messages."""
    text_blocks = []
    if prompt:
        text_blocks.append(prompt)
    text_blocks.extend([msg.get("content", "") for msg in messages])
    combined = "\n".join(text_blocks)
    if not combined:
        return None

    lowered = combined.lower()
    marker = "job description"
    if marker in lowered:
        idx = lowered.find(marker)
        snippet = combined[idx + len(marker):]
        snippet = snippet.split("Provide only", 1)[0]
        return snippet.strip(" :\n") or combined.strip()

    return combined.strip()


def build_questions_payload(request: GenerateRequest) -> Dict[str, Any]:
    """
    Build interview questions using LLM or template fallback.
    
    Args:
        request: GenerateRequest with job info and parameters
        
    Returns:
        Dict with questions, source, and metadata
    """
    messages = request.formatted_messages()
    job_description = request.job_description or infer_job_description(request.prompt, messages)
    num_questions = request.desired_question_count()
    job_role = request.job_role

    if num_questions <= 0:
        raise ValueError("Number of questions must be greater than zero")
    
    # If no job description or role provided, require either messages or prompt
    if not job_description and not job_role and not messages and not request.prompt:
        raise ValueError("Either messages/prompt or job_description/job_role must be provided")

    try:
        # Check Ollama/LLM availability and prefer local fallback if not reachable
        try:
            ok, reason = check_ollama_available(
                settings.OLLAMA_BASE_URL,
                timeout=settings.OLLAMA_PROBE_TIMEOUT,
                retries=settings.OLLAMA_PROBE_RETRIES,
                backoff=settings.OLLAMA_PROBE_BACKOFF
            )
            if not ok:
                raise RuntimeError(reason)
        except Exception as e:
            # If LLM is unavailable, we fall back to local templates by raising
            raise RuntimeError(f"LLM endpoint is not available: {e}")

        # Create a more focused prompt for cleaner question generation with types
        focused_prompt = f"""Generate exactly {num_questions} professional interview questions for this job.

Job Role: {job_role or 'Not specified'}
Job Description: {job_description or 'General position'}

Requirements:
- Return a JSON array of question objects
- Each question must have: "text" (the question), "type" (either "technical" or "behavioral")
- Mix of technical and behavioral questions (roughly 60% technical, 40% behavioral)
- Technical questions: assess skills, knowledge, problem-solving related to the job
- Behavioral questions: assess past experiences, teamwork, communication, leadership
- Each question must be relevant to the role

Return ONLY valid JSON in this exact format:
[
  {{"text": "Question text here?", "type": "technical"}},
  {{"text": "Another question?", "type": "behavioral"}}
]

JSON:"""

        focused_messages = [{"role": "user", "content": focused_prompt}]
        
        # If Ollama is not available at the configured host:port, raise early so we hit fallback
        try:
            requests.get(f"{settings.OLLAMA_BASE_URL}/api/version", timeout=30)
        except Exception as e:
            raise RuntimeError("LLM endpoint is not available: " + str(e))

        ollama_response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={
                "model": request.model,
                "messages": focused_messages,
                "stream": False,
                "options": {
                    "temperature": request.temperature,
                    "num_predict": min(request.max_tokens, 500)  # Limit tokens for cleaner output
                }
            },
            timeout=60,
        )

        if ollama_response.status_code == 200:
            result = ollama_response.json()
            content = result.get("message", {}).get("content", "")
            
            # Try to parse as JSON first
            questions_with_types = []
            try:
                import json
                # Extract JSON from markdown code blocks if present
                json_content = content
                if "```json" in content:
                    json_content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    json_content = content.split("```")[1].split("```")[0].strip()
                
                parsed = json.loads(json_content)
                if isinstance(parsed, list):
                    for idx, item in enumerate(parsed[:num_questions]):
                        if isinstance(item, dict) and "text" in item:
                            question_type = item.get("type", "technical").lower()
                            if question_type not in ["technical", "behavioral"]:
                                question_type = "technical"
                            questions_with_types.append({
                                "question": item["text"],
                                "index": idx,
                                "type": question_type,
                                "scoring_criteria": "Evaluate based on clarity, depth, and relevance"
                            })
            except (json.JSONDecodeError, KeyError, IndexError) as e:
                logger.warning(f"Failed to parse JSON response: {e}, falling back to text parsing")
                # Fall back to text parsing
                questions = extract_questions_from_text(content, num_questions)
                # Assign types based on keywords (simple heuristic)
                for idx, q in enumerate(questions):
                    q_lower = q.lower()
                    is_behavioral = any(keyword in q_lower for keyword in [
                        "tell me about a time", "describe a situation", "give an example",
                        "how did you handle", "experience with", "worked with a team"
                    ])
                    questions_with_types.append({
                        "question": q,
                        "index": idx,
                        "type": "behavioral" if is_behavioral else "technical",
                        "scoring_criteria": "Evaluate based on clarity, depth, and relevance"
                    })
            
            if not questions_with_types:
                raise ValueError("LLM returned no parseable questions")
                
            return {
                "questions": questions_with_types,
                "source": "ollama",
                "model": request.model,
                "content": "\n".join([q["question"] for q in questions_with_types]),
                "raw": content,
                "timestamp": datetime.now().isoformat(),
                "used_fallback": False,
            }

        detail = ollama_response.text or "LLM generation failed"
        raise RuntimeError(f"LLM generation failed ({ollama_response.status_code}): {detail}")

    except Exception as error:
        if job_description is None and job_role is None:
            raise ValueError("Job description or job role is required to generate questions") from error
        fallback_questions = generate_questions_locally(job_description, num_questions, job_role)
        logger.warning("Falling back to rule-based questions: %s", error)
        return {
            "questions": fallback_questions,
            "source": "fallback",
            "model": request.model,
            "content": "\n".join([q["question"] for q in fallback_questions]),
            "raw": job_description or job_role or "",
            "timestamp": datetime.now().isoformat(),
            "used_fallback": True,
            "fallback_reason": str(error),
        }
