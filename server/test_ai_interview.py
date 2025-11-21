#!/usr/bin/env python3
"""
Test script for AI interview functionality.
Tests interview creation with AI, question refinement, and reordering.
"""

import requests
import json
import sys

BASE_URL = "https://localhost:8002"
ADMIN_ID = "usr-e448c2f3-eb74-4942-9ea5-b9264a5e03d2"  # Omar's ID

def test_ai_interview_creation():
    """Test creating an interview with AI-generated questions."""
    print("\n" + "="*60)
    print("TEST 1: AI Interview Creation")
    print("="*60)
    
    payload = {
        "admin_id": ADMIN_ID,
        "title": "Frontend Developer Interview - AI Generated",
        "description": "Technical interview for frontend developer position",
        "job_role": "Frontend Developer",
        "job_description": "Build modern web applications using React, TypeScript, and Next.js. Focus on performance, accessibility, and user experience.",
        "use_ai_generation": True,
        "num_questions": 5,
        "allowed_candidate_ids": [],
        "active": True
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/interviews",
            json=payload,
            verify=False
        )
        
        if response.status_code == 200:
            result = response.json()
            interview = result.get("interview")
            questions = interview.get("config", {}).get("questions", [])
            
            print(f"✅ Success! Created interview: {interview.get('id')}")
            print(f"\nGenerated {len(questions)} questions:")
            for i, q in enumerate(questions, 1):
                print(f"   {i}. {q}")
            
            return interview.get("id"), questions
        else:
            print(f"❌ Failed: {response.status_code}")
            print(response.text)
            return None, []
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None, []

def test_question_refinement(interview_id):
    """Test refining a question with AI."""
    print("\n" + "="*60)
    print("TEST 2: Question Refinement")
    print("="*60)
    
    payload = {
        "admin_id": ADMIN_ID,
        "question_index": 0,
        "refinement_instruction": "Make this question more focused on React hooks and state management"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/interviews/{interview_id}/refine-question",
            json=payload,
            verify=False
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success!")
            print(f"\nOriginal: {result.get('original_question')}")
            print(f"Refined:  {result.get('refined_question')}")
            return True
        else:
            print(f"❌ Failed: {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_question_reordering(interview_id, num_questions):
    """Test reordering questions."""
    print("\n" + "="*60)
    print("TEST 3: Question Reordering")
    print("="*60)
    
    # Reverse the order
    new_order = list(range(num_questions-1, -1, -1))
    
    payload = {
        "admin_id": ADMIN_ID,
        "new_order": new_order
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/interviews/{interview_id}/reorder-questions",
            json=payload,
            verify=False
        )
        
        if response.status_code == 200:
            result = response.json()
            questions = result.get("questions", [])
            print(f"✅ Success! Reordered to: {new_order}")
            print(f"\nNew question order:")
            for i, q in enumerate(questions, 1):
                print(f"   {i}. {q[:80]}...")
            return True
        else:
            print(f"❌ Failed: {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_admin_endpoints():
    """Test admin dashboard endpoints."""
    print("\n" + "="*60)
    print("TEST 4: Admin Dashboard Endpoints")
    print("="*60)
    
    endpoints = [
        f"/api/admin/interviews?admin_id={ADMIN_ID}",
        f"/api/admin/candidates?admin_id={ADMIN_ID}",
        f"/api/admin/analytics?admin_id={ADMIN_ID}",
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", verify=False)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ {endpoint}: OK")
                
                if "interviews" in data:
                    print(f"   - Interviews: {len(data['interviews'])}")
                elif "candidates" in data:
                    print(f"   - Candidates: {len(data['candidates'])}")
                elif "metrics" in data:
                    print(f"   - Metrics: {len(data['metrics'])}")
            else:
                print(f"❌ {endpoint}: {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint}: Error - {e}")

def main():
    """Run all tests."""
    # Disable SSL warnings
    requests.packages.urllib3.disable_warnings()
    
    print("🧪 Testing AI Interview Functionality")
    print(f"Base URL: {BASE_URL}")
    print(f"Admin ID: {ADMIN_ID}")
    
    # Test 1: Create interview with AI
    interview_id, questions = test_ai_interview_creation()
    
    if not interview_id:
        print("\n❌ Test 1 failed, stopping tests")
        return 1
    
    # Test 2: Refine question
    test_question_refinement(interview_id)
    
    # Test 3: Reorder questions
    test_question_reordering(interview_id, len(questions))
    
    # Test 4: Admin endpoints
    test_admin_endpoints()
    
    print("\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60)
    return 0

if __name__ == "__main__":
    sys.exit(main())
