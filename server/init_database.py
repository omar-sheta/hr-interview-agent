#!/usr/bin/env python3
"""
Database initialization script for HR Interview Agent.
Drops existing database, recreates schema, and populates with test data.
"""

import os
import sys
import uuid
import json
import requests
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from server.database import get_db_connection, create_tables
from server.config import settings

def drop_all_tables():
    """Drop all existing tables."""
    print("🗑️  Dropping existing tables...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("DROP TABLE IF EXISTS results")
    cursor.execute("DROP TABLE IF EXISTS interviews")
    cursor.execute("DROP TABLE IF EXISTS users")
    
    conn.commit()
    conn.close()
    print("✅ Tables dropped")

def populate_users():
    """Create admin and test candidate users."""
    print("\n👥 Creating users...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    users = [
        {
            "id": f"usr-{uuid.uuid4()}",
            "username": "omar",
            "password": "admin123",
            "email": "omarwalaa50@gmail.com",
            "role": "admin",
            "avatar_url": None,
            "created_at": datetime.now().isoformat()
        },
        {
            "id": f"usr-{uuid.uuid4()}",
            "username": "john_doe",
            "password": "password123",
            "email": "john.doe@example.com",
            "role": "candidate",
            "avatar_url": "https://ui-avatars.com/api/?name=John+Doe&background=2196F3&color=fff",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": f"usr-{uuid.uuid4()}",
            "username": "jane_smith",
            "password": "password123",
            "email": "jane.smith@example.com",
            "role": "candidate",
            "avatar_url": "https://ui-avatars.com/api/?name=Jane+Smith&background=4CAF50&color=fff",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": f"usr-{uuid.uuid4()}",
            "username": "mike_johnson",
            "password": "password123",
            "email": "mike.johnson@example.com",
            "role": "candidate",
            "avatar_url": "https://ui-avatars.com/api/?name=Mike+Johnson&background=FF9800&color=fff",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": f"usr-{uuid.uuid4()}",
            "username": "sarah_williams",
            "password": "password123",
            "email": "sarah.williams@example.com",
            "role": "candidate",
            "avatar_url": "https://ui-avatars.com/api/?name=Sarah+Williams&background=9C27B0&color=fff",
            "created_at": datetime.now().isoformat()
        }
    ]
    
    for user in users:
        cursor.execute("""
            INSERT INTO users (id, username, password, email, role, avatar_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user["id"],
            user["username"],
            user["password"],
            user["email"],
            user["role"],
            user["avatar_url"],
            user["created_at"]
        ))
        print(f"   ✓ Created {user['role']}: {user['username']} ({user['email']})")
    
    conn.commit()
    conn.close()
    return users

def generate_questions_with_ai(job_role, job_description, num_questions=5):
    """Generate interview questions using Ollama."""
    print(f"\n🤖 Generating {num_questions} questions with AI for: {job_role}")
    
    try:
        # Check if Ollama is available
        try:
            requests.get(f"{settings.OLLAMA_BASE_URL}/api/version", timeout=5)
        except Exception:
            print("   ⚠️  Ollama not available, using fallback templates")
            return generate_fallback_questions(job_role, num_questions)
        
        prompt = f"""Generate exactly {num_questions} professional interview questions for this job.

Job Role: {job_role}
Job Description: {job_description}

Requirements:
- Return ONLY the questions
- One question per line
- No numbering, bullets, or explanations
- Each question must end with a question mark
- Focus on skills and experience relevant to the role

Questions:"""
        
        response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={
                "model": "gemma2:27b",
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0.7, "num_predict": 500}
            },
            timeout=60
        )
        
        if response.status_code == 200:
            content = response.json().get("message", {}).get("content", "")
            questions = []
            
            for line in content.splitlines():
                clean = line.strip()
                if not clean or len(clean) < 10:
                    continue
                    
                # Remove numbering and bullets
                import re
                clean = re.sub(r"^\d+[\).:\-]\s*", "", clean)
                clean = re.sub(r"^[\-\*]\s*", "", clean)
                
                if not clean.endswith("?"):
                    clean = clean.rstrip(".") + "?"
                
                if "?" in clean and len(clean.split()) >= 5:
                    questions.append(clean)
            
            if len(questions) >= num_questions:
                print(f"   ✅ Generated {len(questions[:num_questions])} AI questions")
                return questions[:num_questions]
        
        print("   ⚠️  AI generation failed, using fallback")
        return generate_fallback_questions(job_role, num_questions)
        
    except Exception as e:
        print(f"   ⚠️  AI generation error: {e}, using fallback")
        return generate_fallback_questions(job_role, num_questions)

def generate_fallback_questions(job_role, num_questions=5):
    """Generate template-based questions as fallback."""
    templates = [
        f"Can you describe your experience with {job_role} and what attracted you to this role?",
        f"What do you consider the most important skills for a successful {job_role}?",
        f"Tell me about a challenging project you've worked on as a {job_role}.",
        f"How do you stay current with best practices and new developments in {job_role}?",
        f"Describe a time when you had to solve a complex problem in your role as {job_role}.",
        f"What metrics do you use to measure success in {job_role}?",
        f"How do you prioritize tasks when working on multiple projects as a {job_role}?",
    ]
    return templates[:num_questions]

def populate_interviews(admin_user, candidate_users):
    """Create sample interview templates with AI-generated questions."""
    print("\n📝 Creating interview templates...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    interview_templates = [
        {
            "role": "Software Engineer",
            "description": "Technical interview for mid-level software engineering position. Focus on Python, React, and system design.",
            "num_questions": 5
        },
        {
            "role": "Product Manager",
            "description": "Behavioral and product strategy interview for PM role. Focus on stakeholder management and product vision.",
            "num_questions": 4
        },
        {
            "role": "Data Scientist",
            "description": "Technical interview for data science role. Focus on machine learning, statistics, and data analysis.",
            "num_questions": 5
        }
    ]
    
    interviews = []
    for template in interview_templates:
        questions = generate_questions_with_ai(
            template["role"],
            template["description"],
            template["num_questions"]
        )
        
        interview_id = f"int-{uuid.uuid4()}"
        config = {
            "questions": questions,
            "time_limit_minutes": 30,
            "max_retakes": 2
        }
        
        # Assign first 2 candidates to each interview
        assigned_candidates = [c["id"] for c in candidate_users[:2]]
        
        interview = {
            "id": interview_id,
            "title": f"{template['role']} Interview",
            "description": template["description"],
            "config": json.dumps(config),
            "allowed_candidate_ids": json.dumps(assigned_candidates),
            "deadline": None,
            "active": True
        }
        
        cursor.execute("""
            INSERT INTO interviews (id, title, description, config, allowed_candidate_ids, deadline, active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            interview["id"],
            interview["title"],
            interview["description"],
            interview["config"],
            interview["allowed_candidate_ids"],
            interview["deadline"],
            interview["active"]
        ))
        
        interviews.append(interview)
        print(f"   ✓ Created: {interview['title']}")
        print(f"     - {len(questions)} questions")
        print(f"     - Assigned to: {len(assigned_candidates)} candidates")
    
    conn.commit()
    conn.close()
    return interviews

def main():
    """Main initialization function."""
    print("=" * 60)
    print("HR Interview Agent - Database Initialization")
    print("=" * 60)
    
    # Step 1: Drop and recreate tables
    drop_all_tables()
    create_tables()
    print("\n✅ Database schema created")
    
    # Step 2: Create users
    users = populate_users()
    admin_user = [u for u in users if u["role"] == "admin"][0]
    candidate_users = [u for u in users if u["role"] == "candidate"]
    
    # Step 3: Create interviews with AI-generated questions
    interviews = populate_interviews(admin_user, candidate_users)
    
    print("\n" + "=" * 60)
    print("✅ Database initialized successfully!")
    print("=" * 60)
    print(f"\n📊 Summary:")
    print(f"   - Users created: {len(users)}")
    print(f"   - Admin: {admin_user['username']} ({admin_user['email']})")
    print(f"   - Candidates: {len(candidate_users)}")
    print(f"   - Interviews: {len(interviews)}")
    print(f"\n🔑 Login credentials:")
    print(f"   Admin: omar / admin123")
    print(f"   Candidates: <username> / password123")
    print("\n✨ Ready to start the server!")
    print("=" * 60)

if __name__ == "__main__":
    main()
