import smtplib
import logging
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
from pathlib import Path
from datetime import datetime
import base64
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request

logger = logging.getLogger("hr_interview_agent.email_service")

class EmailService:
    def __init__(self):
        # Resolve paths relative to this file's location
        # This file is in server/services/email_service.py
        # We want server/data/token.json
        base_dir = Path(__file__).resolve().parent.parent
        self.token_path = base_dir / "data" / "token.json"
        self.mock_log_path = base_dir / "data" / "mock_emails.log"
        
        self.oauth_enabled = self.token_path.exists()
        
        # Check for SMTP config
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_port = int(os.getenv("SMTP_PORT", 587))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_pass = os.getenv("SMTP_PASS")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@hr-agent.com")
        
        self.smtp_enabled = all([self.smtp_host, self.smtp_user, self.smtp_pass])
        
        self.enabled = self.oauth_enabled or self.smtp_enabled
        
        # Log initialization status
        print(f"EmailService initialized. OAuth: {self.oauth_enabled} (Path: {self.token_path}), SMTP: {self.smtp_enabled}")

    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Send an email using the best available method.
        Returns True if sent (or mocked), False if failed.
        """
        if self.oauth_enabled:
            return self._send_via_gmail_api(to_email, subject, html_content)
            
        if self.smtp_enabled:
            return self._send_via_smtp(to_email, subject, html_content)

        self._log_mock_email(to_email, subject, html_content)
        return True

    def _send_via_gmail_api(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email using Gmail API."""
        try:
            creds = Credentials.from_authorized_user_file(str(self.token_path), ['https://www.googleapis.com/auth/gmail.send'])
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                # Save refreshed token
                with open(self.token_path, 'w') as token:
                    token.write(creds.to_json())

            service = build('gmail', 'v1', credentials=creds)
            
            message = MIMEMultipart()
            message['to'] = to_email
            message['subject'] = subject
            message.attach(MIMEText(html_content, 'html'))
            
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            body = {'raw': raw_message}
            
            service.users().messages().send(userId='me', body=body).execute()
            logger.info(f"Email sent via Gmail API to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via Gmail API to {to_email}: {e}")
            # Fallback to mock logging if API fails
            self._log_mock_email(to_email, subject, html_content)
            return False

    def _send_via_smtp(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email via SMTP."""
        try:
            msg = MIMEMultipart()
            msg["From"] = self.from_email
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_pass)
                server.send_message(msg)
            
            logger.info(f"Email sent via SMTP to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP to {to_email}: {e}")
            return False

    def _log_mock_email(self, to_email: str, subject: str, html_content: str):
        """Log email content to console and file for development/testing."""
        log_message = (
            f"\n{'='*50}\n"
            f"MOCK EMAIL TO: {to_email}\n"
            f"SUBJECT: {subject}\n"
            f"{'-'*20}\n"
            f"CONTENT: {html_content}\n"
            f"{'='*50}\n"
        )
        
        # Log to console
        logger.info(log_message)
        print(f"📧 [MOCK] Email logged for {to_email}")
        
        # Log to file
        try:
            self.mock_log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.mock_log_path, "a") as f:
                f.write(f"[{datetime.now().isoformat()}] {log_message}")
        except Exception as e:
            logger.error(f"Failed to write to mock email log: {e}")

email_service = EmailService()
