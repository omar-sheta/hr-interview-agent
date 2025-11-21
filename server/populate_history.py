import random
import uuid
from datetime import datetime, timedelta
from .data_manager import data_manager

def populate_history():
    print("🚀 Starting history population...")
    
    users = data_manager.load_users()
    interviews = data_manager.load_interviews()
    candidates = [u for u in users if u.get("role") == "candidate"]
    
    if not candidates:
        print("❌ No candidates found. Please create some candidates first.")
        return

    if not interviews:
        print("❌ No interviews found. Please create some interviews first.")
        return

    results = data_manager.load_results()
    initial_count = len(results)
    
    print(f"ℹ️ Found {len(candidates)} candidates and {len(interviews)} interviews.")
    
    statuses = ["Accepted", "Rejected", "Pending"]
    
    for candidate in candidates:
        # Assign 1-3 random interviews to each candidate
        num_interviews = random.randint(1, 3)
        selected_interviews = random.sample(interviews, min(num_interviews, len(interviews)))
        
        for interview in selected_interviews:
            # Check if result already exists
            if any(r.get("candidate_id") == candidate["id"] and r.get("interview_id") == interview["id"] for r in results):
                continue
                
            # Create a result
            days_ago = random.randint(1, 30)
            created_at = (datetime.now() - timedelta(days=days_ago)).isoformat()
            
            overall_score = random.uniform(4.0, 9.5)
            status = "Pending"
            if overall_score >= 8.0:
                status = "Accepted"
            elif overall_score < 5.0:
                status = "Rejected"
            else:
                status = random.choice(statuses)
                
            result = {
                "session_id": str(uuid.uuid4()),
                "interview_id": interview["id"],
                "interview_title": interview["title"],
                "candidate_id": candidate["id"],
                "candidate_name": candidate["username"],
                "created_at": created_at,
                "completed_at": created_at, # Assumed completed same time
                "overall_score": round(overall_score, 1),
                "status": status,
                "transcript": "Simulated transcript...",
                "feedback": "Simulated feedback...",
                "answers": [] # We can leave empty for summary view
            }
            
            results.append(result)
            print(f"✅ Added result for {candidate['username']} in {interview['title']} ({status})")
            
            # Also ensure candidate is in allowed_ids for that interview
            if candidate["id"] not in interview.get("allowed_candidate_ids", []):
                interview.setdefault("allowed_candidate_ids", []).append(candidate["id"])

    data_manager.save_results(results)
    data_manager.save_interviews(interviews)
    
    print(f"🎉 Added {len(results) - initial_count} new results.")

if __name__ == "__main__":
    populate_history()
