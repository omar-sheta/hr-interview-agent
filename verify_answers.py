
import sys
import os
import json
import time

# Add root directory to path
sys.path.append(os.getcwd())

from server.data_manager import data_manager

def test_answer_saving():
    print("🧪 Starting Answer Saving Verification...")
    
    # 1. Create a dummy session
    session_data = {
        "candidate_name": "Test Candidate",
        "job_role": "Tester",
        "questions": ["Q1", "Q2"],
        "status": "active",
        "responses": []
    }
    
    session_id = data_manager.create_session(session_data)
    print(f"✅ Created session: {session_id}")
    
    # 2. Create a dummy transcript
    transcript_data = {
        "transcript": "This is a test answer.",
        "confidence": 0.95
    }
    transcript_id = data_manager.store_transcript(session_id, 0, transcript_data)
    print(f"✅ Created transcript: {transcript_id}")
    
    # 3. Add response to session (simulating submit_interview_response logic)
    print("🔄 Adding response to session...")
    success = data_manager.add_session_response(session_id, 0, transcript_id)
    
    if not success:
        print("❌ Failed to add response!")
        return
        
    print("✅ Response added result: Success")
    
    # 4. Verify persistence by reloading from disk
    print("🔄 Reloading session from disk...")
    loaded_session = data_manager.get_session(session_id)
    
    responses = loaded_session.get('responses', [])
    print(f"📊 Loaded responses count: {len(responses)}")
    
    if len(responses) == 1:
        r = responses[0]
        if r.get('transcript_id') == transcript_id and r.get('question_index') == 0:
            print("✅ VERIFICATION SUCCESS: Answer saved and persisted correctly!")
        else:
            print(f"❌ VERIFICATION FAILED: Data mismatch. Got: {r}")
    else:
        print(f"❌ VERIFICATION FAILED: Expected 1 response, got {len(responses)}")

    # Cleanup
    data_manager.delete_session(session_id)
    print("🧹 Cleanup complete")

if __name__ == "__main__":
    test_answer_saving()
