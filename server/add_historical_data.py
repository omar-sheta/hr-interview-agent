#!/usr/bin/env python3
"""
Add historical interview data to the database.
Creates completed interview sessions from the past week for realistic testing.
"""

import sys
import json
from datetime import datetime, timedelta
from pathlib import Path
import random

# Add server to path
sys.path.insert(0, str(Path(__file__).parent))

from server.database import get_db_connection
from server.data_manager import data_manager

def create_historical_results():
    """Create interview results from the past week."""
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all interviews and candidates
    cursor.execute("SELECT id, title FROM interviews LIMIT 3")
    interviews = cursor.fetchall()
    
    cursor.execute("SELECT id, username, email FROM users WHERE role='candidate' LIMIT 4")
    candidates = cursor.fetchall()
    
    print("\n" + "="*60)
    print("Creating Historical Interview Results")
    print("="*60)
    
    results_created = 0
    
    # Create results for the past 7 days
    for day_offset in range(7):
        date = datetime.now() - timedelta(days=day_offset)
        
        # Create 1-3 results per day
        num_results = random.randint(1, min(3, len(candidates)))
        
        for i in range(num_results):
            interview = random.choice(interviews)
            candidate = candidates[i % len(candidates)]
            
            session_id = f"session-hist-{date.strftime('%Y%m%d')}-{i}"
            
            # Create realistic scores
            scores = {
                "communication": round(random.uniform(6.0, 9.5), 1),
                "technical": round(random.uniform(5.5, 9.0), 1),
                "problem_solving": round(random.uniform(6.0, 9.5), 1),
                "overall": round(random.uniform(6.5, 9.0), 1)
            }
            
            # Create sample answers
            answers = [
                {"question": "Tell me about yourself", "answer": "Sample answer", "duration": 120},
                {"question": "What are your strengths?", "answer": "Sample answer", "duration": 90},
                {"question": "Why this role?", "answer": "Sample answer", "duration": 100}
            ]
            
            feedback = [
                {"aspect": "Communication", "comment": "Clear and articulate"},
                {"aspect": "Technical Skills", "comment": "Strong foundation"},
                {"aspect": "Problem Solving", "comment": "Good analytical approach"}
            ]
            
            # Insert result
            cursor.execute("""
                INSERT INTO results 
                (id, session_id, interview_id, candidate_id, candidate_username, 
                 interview_title, timestamp, answers, feedback, scores, summary, 
                 created_at, updated_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"result-{session_id}",
                session_id,
                interview['id'],
                candidate['id'],
                candidate['username'],
                interview['title'],
                date.isoformat(),
                json.dumps(answers),
                json.dumps(feedback),
                json.dumps(scores),
                f"Strong candidate with good communication and technical skills. Overall score: {scores['overall']}/10",
                date.isoformat(),
                date.isoformat(),
                "completed"
            ))
            
            results_created += 1
            print(f"✅ Created result for {candidate['username']} - {interview['title']} ({date.strftime('%Y-%m-%d')})")
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Created {results_created} historical interview results")
    print("="*60)

if __name__ == "__main__":
    create_historical_results()
