"""Test creating an interview with AI-generated questions that have types and indices."""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_ai_interview_with_types():
    print("🧪 Testing AI Interview Creation with Question Types\n")
    print("=" * 70)
    
    # Login as admin
    print("\n1️⃣  Logging in as admin...")
    login_response = requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "admin", "password": "admin123"}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    admin_data = login_response.json()
    admin_id = admin_data["user_id"]
    print(f"✅ Logged in as admin (ID: {admin_id})")
    
    # Create AI-generated interview
    print("\n2️⃣  Creating interview with AI generation...")
    interview_data = {
        "admin_id": admin_id,
        "title": "Test Interview with Question Types",
        "description": "Testing question type classification",
        "use_ai_generation": True,
        "job_role": "Senior Backend Developer",
        "job_description": "Looking for an experienced backend developer with Python, FastAPI, and database expertise. Must have strong problem-solving skills and experience with microservices.",
        "num_questions": 6,
        "active": True
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/admin/interviews",
        json=interview_data
    )
    
    if create_response.status_code != 201:
        print(f"❌ Interview creation failed: {create_response.text}")
        return
    
    interview = create_response.json()
    print(f"✅ Created interview: {interview['title']}")
    print(f"   ID: {interview['id']}")
    
    # Analyze questions
    config = interview.get("config", {})
    questions = config.get("questions", [])
    
    print(f"\n3️⃣  Analyzing generated questions...")
    print(f"   Total questions: {len(questions)}")
    print(f"   Source: {config.get('source', 'unknown')}")
    print(f"   AI generated: {config.get('ai_generated', False)}")
    
    if not questions:
        print("❌ No questions generated!")
        return
    
    print(f"\n📝 Question Details:\n")
    
    technical_count = 0
    behavioral_count = 0
    
    for q in questions:
        # Check for new structure
        if isinstance(q, dict):
            qtype = q.get("type", "unknown")
            index = q.get("index", "?")
            question_text = q.get("question", "")
            scoring = q.get("scoring_criteria", "N/A")
            
            if qtype == "technical":
                technical_count += 1
                icon = "💻"
            elif qtype == "behavioral":
                behavioral_count += 1
                icon = "👥"
            else:
                icon = "❓"
            
            print(f"{icon} Question {index + 1} [{qtype.upper()}]")
            print(f"   Text: {question_text}")
            print(f"   Criteria: {scoring}")
            print()
        else:
            # Old string format
            print(f"⚠️  Old format (string): {q}\n")
    
    print(f"{'='*70}")
    print(f"📊 Summary:")
    print(f"   💻 Technical questions: {technical_count}")
    print(f"   👥 Behavioral questions: {behavioral_count}")
    print(f"   📝 Total questions: {len(questions)}")
    
    # Verify structure
    print(f"\n🔍 Validating question structure...")
    all_valid = True
    for idx, q in enumerate(questions):
        if not isinstance(q, dict):
            print(f"   ❌ Question {idx} is not a dictionary")
            all_valid = False
            continue
            
        required_fields = ["question", "index", "type", "scoring_criteria"]
        missing_fields = [f for f in required_fields if f not in q]
        
        if missing_fields:
            print(f"   ❌ Question {idx} missing fields: {missing_fields}")
            all_valid = False
        elif q["index"] != idx:
            print(f"   ❌ Question {idx} has incorrect index: {q['index']}")
            all_valid = False
        elif q["type"] not in ["technical", "behavioral"]:
            print(f"   ❌ Question {idx} has invalid type: {q['type']}")
            all_valid = False
    
    if all_valid:
        print(f"   ✅ All questions have valid structure!")
    
    print(f"\n{'='*70}")
    print("✅ Test completed!")

if __name__ == "__main__":
    test_ai_interview_with_types()
