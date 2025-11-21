"""
Test script to check email service.
"""
import sys
sys.path.insert(0, '/Users/Omar/Desktop/hr_agent')

from server.services.email_service import email_service
from server.utils.helpers import get_local_ip

# Test email
result = email_service.send_email(
    to_email="omarwalaa50@gmail.com",
    subject="Test Email - HR Interview Agent",
    html_content="<h1>Test Email</h1><p>This is a test email from the HR Interview Agent</p>"
)

print(f"Email send result: {result}")
print(f"Local IP: {get_local_ip()}")
