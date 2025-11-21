"""
Test script for admin features: analytics, accept/reject functionality
"""

import requests
import json
from datetime import datetime

# Disable SSL warnings for local development
requests.packages.urllib3.disable_warnings()

BASE_URL = "http://localhost:8000"

def test_analytics():
    """Test analytics endpoint returns last 7 days data"""
    print("\n" + "="*60)
    print("Testing Analytics Endpoint")
    print("="*60)
    
    # Login as admin
    login_response = requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "admin", "password": "admin123"}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    admin_id = login_response.json()["user_id"]
    print(f"✅ Logged in as admin (ID: {admin_id})")
    
    # Get analytics
    analytics_response = requests.get(
        f"{BASE_URL}/api/admin/analytics",
        params={"admin_id": admin_id}
    )
    
    if analytics_response.status_code != 200:
        print(f"❌ Analytics request failed: {analytics_response.text}")
        return
    
    analytics = analytics_response.json()
    
    # Check metrics
    print("\n📊 Metrics:")
    for metric in analytics.get("metrics", []):
        print(f"  - {metric['label']}: {metric['value']}")
    
    # Check completion_over_time
    print("\n📈 Completion Over Time (Last 7 Days):")
    completion_data = analytics.get("completion_over_time", [])
    
    if len(completion_data) != 7:
        print(f"❌ Expected 7 days, got {len(completion_data)}")
    else:
        print(f"✅ Got 7 days of data")
    
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for day_data in completion_data:
        day_name = day_data.get("name")
        value = day_data.get("value", 0)
        
        if day_name not in day_names:
            print(f"❌ Invalid day name: {day_name}")
        else:
            print(f"  {day_name}: {value} completions")
    
    print("\n✅ Analytics test completed!")


def test_dashboard_stats():
    """Test dashboard stats endpoint"""
    print("\n" + "="*60)
    print("Testing Dashboard Stats Endpoint")
    print("="*60)

    # Login as admin
    login_response = requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "admin", "password": "admin123"}
    )

    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return

    admin_id = login_response.json()["user_id"]
    print(f"✅ Logged in as admin (ID: {admin_id})")

    # Get dashboard stats
    stats_response = requests.get(
        f"{BASE_URL}/api/admin/dashboard-stats",
        params={"admin_id": admin_id}
    )

    if stats_response.status_code != 200:
        print(f"❌ Dashboard stats request failed: {stats_response.text}")
        return

    stats = stats_response.json()
    print(f"📊 Stats received: {stats}")

    # Check for expected keys
    expected_keys = ["total_interviews", "completed_interviews", "total_candidates"]
    for key in expected_keys:
        if key not in stats:
            print(f"❌ Missing key in response: {key}")
            return

    print("✅ All expected keys found in dashboard stats.")
    print("\n✅ Dashboard stats test completed!")

def test_accept_reject():
    """Test accept/reject endpoints with email notifications"""
    print("\n" + "="*60)
    print("Testing Accept/Reject Endpoints")
    print("="*60)
    
    # Login as admin
    login_response = requests.post(
        f"{BASE_URL}/api/login",
        json={"username": "admin", "password": "admin123"}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    admin_id = login_response.json()["user_id"]
    print(f"✅ Logged in as admin (ID: {admin_id})")
    
    # Get all results
    results_response = requests.get(
        f"{BASE_URL}/api/admin/results",
        params={"admin_id": admin_id}
    )
    
    if results_response.status_code != 200:
        print(f"❌ Failed to get results: {results_response.text}")
        return
    
    results = results_response.json().get("results", [])
    print(f"\n📋 Found {len(results)} results")
    
    if len(results) == 0:
        print("⚠️  No results to test with")
        return
    
    # Find a pending result
    pending_result = None
    for result in results:
        if result.get("status") == "pending":
            pending_result = result
            break
    
    if not pending_result:
        # Use the first result and reset it to pending first
        pending_result = results[0]
        print(f"\n🔄 Resetting result {pending_result['session_id']} to pending...")
        
        reset_response = requests.put(
            f"{BASE_URL}/api/admin/results/{pending_result['session_id']}",
            params={"admin_id": admin_id, "status": "pending"}
        )
        
        if reset_response.status_code != 200:
            print(f"❌ Failed to reset status: {reset_response.text}")
            return
    
    session_id = pending_result["session_id"]
    candidate_username = pending_result.get("candidate_username", "Unknown")
    interview_title = pending_result.get("interview_title", "Unknown")
    
    print(f"\n📝 Testing with:")
    print(f"  Session ID: {session_id}")
    print(f"  Candidate: {candidate_username}")
    print(f"  Interview: {interview_title}")
    
    # Test Accept
    print("\n✅ Testing ACCEPT endpoint...")
    accept_response = requests.post(
        f"{BASE_URL}/api/admin/results/{session_id}/accept",
        params={"admin_id": admin_id}
    )
    
    if accept_response.status_code != 200:
        print(f"❌ Accept failed: {accept_response.text}")
    else:
        accept_data = accept_response.json()
        print(f"✅ Accept successful!")
        print(f"  Status: {accept_data.get('status')}")
        print(f"  Email sent: {accept_data.get('email_sent')}")
    
    # Reset to pending
    print("\n🔄 Resetting to pending...")
    requests.put(
        f"{BASE_URL}/api/admin/results/{session_id}",
        params={"admin_id": admin_id, "status": "pending"}
    )
    
    # Test Reject
    print("\n❌ Testing REJECT endpoint...")
    reject_response = requests.post(
        f"{BASE_URL}/api/admin/results/{session_id}/reject",
        params={"admin_id": admin_id}
    )
    
    if reject_response.status_code != 200:
        print(f"❌ Reject failed: {reject_response.text}")
    else:
        reject_data = reject_response.json()
        print(f"✅ Reject successful!")
        print(f"  Status: {reject_data.get('status')}")
        print(f"  Email sent: {reject_data.get('email_sent')}")
    
    print("\n✅ Accept/Reject test completed!")


def main():
    """Run all tests"""
    print("\n" + "🧪 "*20)
    print("ADMIN FEATURES TEST SUITE")
    print("🧪 "*20)
    
    try:
        test_dashboard_stats()
        test_analytics()
        test_accept_reject()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETED!")
        print("="*60)
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()