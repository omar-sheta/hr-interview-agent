import os
import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def main():
    """Shows basic usage of the Gmail API.
    Lists the user's Gmail labels.
    """
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    token_path = 'server/data/token.json'
    
    # Check for client secret in the email folder
    client_secret_path = 'email/client_secret_827283758900-uba8orvuqcmumdfmuq8a9g4eid0qftqd.apps.googleusercontent.com.json'
    
    if not os.path.exists(client_secret_path):
        # Try to find any json file in email folder that starts with client_secret
        import glob
        secrets = glob.glob('email/client_secret*.json')
        if secrets:
            client_secret_path = secrets[0]
        else:
            print("Error: Client secret file not found in email/ folder.")
            return

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                client_secret_path, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save the credentials for the next run
        os.makedirs(os.path.dirname(token_path), exist_ok=True)
        with open(token_path, 'w') as token:
            token.write(creds.to_json())
            
    print(f"Successfully authorized! Token saved to {token_path}")

if __name__ == '__main__':
    main()
