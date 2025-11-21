"""
Quick script to create candidate user Omar Sheta.
"""
from server.data_manager import data_manager

# Create Omar candidate
omar = data_manager.create_user(
    username="omar",
    password="password123",
    role="candidate",
    email="omarwalaa50@gmail.com",
    first_name="Omar",
    last_name="Sheta"
)

if omar:
    print(f"✅ Created candidate: {omar['first_name']} {omar['last_name']}")
    print(f"   Username: {omar['username']}")
    print(f"   Email: {omar['email']}")
    print(f"   User ID: {omar['id']}")
else:
    print("❌ User already exists or creation failed")
