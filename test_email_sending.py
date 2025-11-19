import sys
import os
from pathlib import Path

# Add the current directory to sys.path to allow imports
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

from server.services.email_service import EmailService

def main():
    print("=== Email Sending Test Script ===")
    print("This script tests the EmailService configuration (OAuth2/SMTP).")
    
    # Initialize service
    try:
        service = EmailService()
        print(f"Service initialized.")
        print(f"OAuth Enabled: {service.oauth_enabled}")
        print(f"SMTP Enabled: {service.smtp_enabled}")
        print(f"Token Path: {service.token_path.absolute()}")
        
        if not service.enabled:
            print("\n❌ No email sending method is enabled (neither OAuth2 nor SMTP).")
            print("Please check your configuration.")
            return
            
    except Exception as e:
        print(f"\n❌ Failed to initialize EmailService: {e}")
        return

    # Get target email
    to_email = input("\nEnter recipient email address: ").strip()
    if not to_email:
        print("No email provided. Exiting.")
        return

    print(f"\nAttempting to send test email to: {to_email}...")
    
    try:
        success = service.send_email(
            to_email=to_email,
            subject="Test Email from HR Agent Script",
            html_content="<h1>It Works!</h1><p>This is a test email sent from the standalone verification script.</p>"
        )
        
        if success:
            print("\n✅ Email sent successfully! (Check your inbox)")
        else:
            print("\n❌ Email sending returned False. Check server logs for details.")
            
    except Exception as e:
        print(f"\n❌ Exception occurred while sending: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
