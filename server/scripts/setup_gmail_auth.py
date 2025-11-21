"""
Script to setup Gmail OAuth using a client secret file.
This script performs the initial OAuth flow to generate the token.json file.
"""
import os
import sys
import json
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# Define scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def setup_gmail_auth(client_secret_path):
    """
    Performs OAuth flow to generate token.json
    """
    print(f"🚀 Starting Gmail OAuth setup...")
    print(f"📂 Client Secret: {client_secret_path}")
    
    if not os.path.exists(client_secret_path):
        print(f"❌ Error: Client secret file not found at {client_secret_path}")
        return False
        
    # Define token path
    base_dir = Path(__file__).resolve().parent.parent
    token_path = base_dir / "data" / "token.json"
    
    print(f"💾 Token will be saved to: {token_path}")
    
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists(token_path):
        try:
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
            print("ℹ️  Found existing token.json")
        except Exception as e:
            print(f"⚠️  Existing token invalid: {e}")

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Refreshing expired token...")
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"❌ Failed to refresh token: {e}")
                creds = None
                
        if not creds:
            print("🌐 Launching browser for authentication...")
            try:
                flow = InstalledAppFlow.from_client_secrets_file(
                    client_secret_path, SCOPES)
                # Use a fixed port to avoid redirect URI mismatch issues if configured that way
                # But usually 0 (random) works for desktop apps
                creds = flow.run_local_server(port=0)
            except Exception as e:
                print(f"❌ OAuth flow failed: {e}")
                return False
                
        # Save the credentials for the next run
        print("💾 Saving new credentials...")
        os.makedirs(os.path.dirname(token_path), exist_ok=True)
        with open(token_path, 'w') as token:
            token.write(creds.to_json())
            
    print("✅ Authentication successful!")
    print(f"✨ Token saved to {token_path}")
    print("📧 Email service should now work correctly.")
    return True

if __name__ == "__main__":
    # Path provided by user
    CLIENT_SECRET_PATH = "/Users/Omar/Desktop/hr_agent/email/client_secret_827283758900-uba8orvuqcmumdfmuq8a9g4eid0qftqd.apps.googleusercontent.com.json"
    
    setup_gmail_auth(CLIENT_SECRET_PATH)
