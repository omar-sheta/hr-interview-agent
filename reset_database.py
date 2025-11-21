"""
Reset and populate database with proper sample data.

This script clears the database and creates:
- 1 admin user
- 3 candidate users
- 3 interviews with proper questions
- 10+ results with per-question feedback and general feedback
"""

import sqlite3
import json
import uuid
from datetime import datetime, timedelta
import random

DB_PATH = "./server/data/hr_agent.db"

def clear_tables():
    """Clear all data from tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("🧹 Clearing tables...")
    cursor.execute("DELETE FROM results")
    cursor.execute("DELETE FROM interviews")
    cursor.execute("DELETE FROM users")
    
    conn.commit()
    conn.close()
    print("✅ Tables cleared")

def create_users():
    """Create admin and candidate users."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("👤 Creating users...")
    
    # Admin user
    admin_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO users (id, username, password, email, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (admin_id, "admin", "admin123", "admin@company.com", "admin", datetime.now().isoformat())
    )
    
    # Candidate users
    candidates = [
        {"username": "john_doe", "password": "john123", "email": "john@example.com"},
        {"username": "jane_smith", "password": "jane123", "email": "jane@example.com"},
        {"username": "mike_johnson", "password": "mike123", "email": "mike@example.com"},
    ]
    
    candidate_ids = []
    for candidate in candidates:
        cand_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO users (id, username, password, email, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (cand_id, candidate["username"], candidate["password"], candidate["email"], "candidate", datetime.now().isoformat())
        )
        candidate_ids.append(cand_id)
    
    conn.commit()
    conn.close()
    
    print(f"✅ Created 1 admin and {len(candidates)} candidates")
    return admin_id, candidate_ids

def create_interviews(candidate_ids):
    """Create sample interviews."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("📋 Creating interviews...")
    
    interviews = [
        {
            "title": "Software Engineer Interview",
            "description": "Technical interview for software engineering position",
            "questions": [
                "Tell me about yourself and your background",
                "Describe a challenging project you worked on",
                "How do you handle tight deadlines?",
                "Explain a complex technical concept to a non-technical person",
                "Where do you see yourself in 5 years?"
            ]
        },
        {
            "title": "Product Manager Interview",
            "description": "Assessment for product management role",
            "questions": [
                "What interests you about product management?",
                "How do you prioritize features?",
                "Describe a time you had to make a difficult decision",
                "How do you work with engineering teams?",
                "What's your approach to user research?"
            ]
        },
        {
            "title": "Data Scientist Interview",
            "description": "Technical assessment for data science position",
            "questions": [
                "Explain your experience with machine learning",
                "How do you handle missing data?",
                "Describe a data analysis project you're proud of",
                "What statistical methods do you use most often?",
                "How do you communicate insights to stakeholders?"
            ]
        }
    ]
    
    interview_ids = []
    for interview in interviews:
        interview_id = str(uuid.uuid4())
        config = {
            "questions": interview["questions"],
            "duration_minutes": 30,
            "total_questions": len(interview["questions"])
        }
        
        cursor.execute(
            """INSERT INTO interviews (id, title, description, config, allowed_candidate_ids, deadline, active) 
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                interview_id,
                interview["title"],
                interview["description"],
                json.dumps(config),
                json.dumps(candidate_ids),
                (datetime.now() + timedelta(days=30)).isoformat(),
                True
            )
        )
        interview_ids.append({
            "id": interview_id,
            "title": interview["title"],
            "questions": interview["questions"]
        })
    
    conn.commit()
    conn.close()
    
    print(f"✅ Created {len(interviews)} interviews")
    return interview_ids

def create_results(candidate_ids, interviews):
    """Create sample results with proper structure."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("📊 Creating results...")
    
    statuses = ["accepted", "rejected", "pending", "completed"]
    
    sample_answers_pool = [
        "I have 5 years of experience in software development, specializing in full-stack web applications using React and Node.js.",
        "In my previous role, I led a team of 3 developers to build a customer portal that reduced support tickets by 40%.",
        "I prioritize tasks based on business impact and use agile methodologies to manage my time effectively.",
        "I believe in clear communication and regular check-ins to ensure everyone is aligned on project goals.",
        "I'm passionate about building products that solve real user problems and make a positive impact."
    ]
    
    result_count = 0
    for candidate_id in candidate_ids:
        # Each candidate completes 3-4 interviews
        num_interviews = random.randint(3, 4)
        selected_interviews = random.sample(interviews, min(num_interviews, len(interviews)))
        
        for interview in selected_interviews:
            session_id = f"session-{str(uuid.uuid4())[:8]}"
            
            # Generate answers with per-question feedback
            answers = []
            for i, question in enumerate(interview["questions"]):
                tech_score = random.uniform(6.0, 10.0)
                comm_score = random.uniform(6.0, 10.0)
                depth_score = random.uniform(5.0, 9.5)
                q_overall = round((tech_score + comm_score + depth_score) / 3, 1)
                
                answers.append({
                    "question": question,
                    "answer": random.choice(sample_answers_pool),
                    "duration": random.randint(60, 180),
                    "feedback": {
                        "technical": round(tech_score, 1),
                        "communication": round(comm_score, 1),
                        "depth": round(depth_score, 1),
                        "overall": q_overall,
                        "comment": f"Good response with clear examples. {'Strong technical knowledge.' if tech_score > 8 else 'Could improve technical depth.'}"
                    }
                })
            
            # Calculate overall scores
            avg_tech = round(sum(a["feedback"]["technical"] for a in answers) / len(answers), 1)
            avg_comm = round(sum(a["feedback"]["communication"] for a in answers) / len(answers), 1)
            avg_depth = round(sum(a["feedback"]["depth"] for a in answers) / len(answers), 1)
            overall_score = round((avg_tech + avg_comm + avg_depth) / 3, 1)
            
            scores = {
                "technical": avg_tech,
                "communication": avg_comm,
                "problem_solving": avg_depth,
                "overall": overall_score
            }
            
            # General feedback
            feedback = {
                "overall_comment": f"Overall strong performance with score of {overall_score}/10. {'Excellent technical skills and communication.' if overall_score > 8 else 'Good effort, room for improvement in depth.'}",
                "strengths": ["Clear communication", "Good examples", "Technical knowledge"] if overall_score > 7 else ["Understood questions", "Attempted all answers"],
                "areas_for_improvement": ["More specific examples", "Deeper technical details"] if overall_score < 8 else ["None significant"]
            }
            
            # Determine status
            if overall_score >= 8.5:
                status = "accepted"
            elif overall_score < 6.0:
                status = "rejected"
            else:
                status = random.choice(["pending", "completed"])
            
            # Get candidate username
            cursor.execute("SELECT username FROM users WHERE id = ?", (candidate_id,))
            candidate_username = cursor.fetchone()[0]
            
            # Insert result
            created_at = (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()
            
            cursor.execute(
                """INSERT INTO results (id, session_id, interview_id, candidate_id, candidate_username, 
                   interview_title, timestamp, answers, feedback, scores, summary, created_at, updated_at, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(uuid.uuid4()),
                    session_id,
                    interview["id"],
                    candidate_id,
                    candidate_username,
                    interview["title"],
                    created_at,
                    json.dumps(answers),
                    json.dumps(feedback),
                    json.dumps(scores),
                    f"Interview completed with overall score: {overall_score}/10",
                    created_at,
                    created_at,
                    status
                )
            )
            result_count += 1
    
    conn.commit()
    conn.close()
    
    print(f"✅ Created {result_count} results")

def main():
    print("\n" + "="*50)
    print("DATABASE SETUP - Creating Sample Data")
    print("="*50 + "\n")
    
    clear_tables()
    admin_id, candidate_ids = create_users()
    interviews = create_interviews(candidate_ids)
    create_results(candidate_ids, interviews)
    
    print("\n" + "="*50)
    print("✅ DATABASE SETUP COMPLETE!")
    print("="*50)
    print("\n📝 Credentials:")
    print("   Admin: username='admin', password='admin123'")
    print("   Candidates: john_doe/john123, jane_smith/jane123, mike_johnson/mike123")
    print("\n")

if __name__ == "__main__":
    main()
