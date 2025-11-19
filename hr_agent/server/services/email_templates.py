import base64
from pathlib import Path

def _get_logo_base64():
    """Get base64 encoded logo for email embedding."""
    try:
        logo_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "assets" / "hive-logo.png"
        with open(logo_path, "rb") as f:
            logo_data = base64.b64encode(f.read()).decode('utf-8')
            return f"data:image/png;base64,{logo_data}"
    except Exception:
        # Fallback if logo not found - return empty string
        return ""

def get_invite_email(candidate_name: str, interview_title: str, interview_link: str, deadline: str = None) -> str:
    logo_src = _get_logo_base64()
    logo_html = f'<img src="{logo_src}" alt="Hive Logo" style="width: 120px; margin-top: 20px;">' if logo_src else ""
    deadline_text = f"<p><strong>Deadline:</strong> {deadline}</p>" if deadline else ""
    return f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #2c3e50;">Interview Invitation</h2>
                <p>Hello {candidate_name},</p>
                <p>You have been invited to complete the following interview:</p>
                <h3 style="color: #3498db;">{interview_title}</h3>
                {deadline_text}
                <p>Please log in to your dashboard to start the interview.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{interview_link}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Go to Dashboard</a>
                </div>
                <p style="font-size: 12px; color: #7f8c8d;">Best regards,<br>HR Team</p>
                {logo_html}
            </div>
        </body>
    </html>
    """

def get_completion_email_admin(candidate_name: str, interview_title: str, score: float, summary: str) -> str:
    logo_src = _get_logo_base64()
    logo_html = f'<img src="{logo_src}" alt="Hive Logo" style="width: 120px; margin-top: 20px;">' if logo_src else ""
    return f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #2c3e50;">Interview Completed</h2>
                <p>Candidate <strong>{candidate_name}</strong> has completed the interview:</p>
                <h3 style="color: #3498db;">{interview_title}</h3>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
                    <p><strong>Average Score:</strong> {score}/10</p>
                    <p><strong>Summary:</strong> {summary}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:5173/admin/results" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Full Results</a>
                </div>
                {logo_html}
            </div>
        </body>
    </html>
    """

def get_status_update_email(candidate_name: str, interview_title: str, status: str, score: float = None) -> str:
    """Email template for when admin updates a candidate's interview status."""
    logo_src = _get_logo_base64()
    logo_html = f'<img src="{logo_src}" alt="Hive Logo" style="width: 120px; margin-top: 20px;">' if logo_src else ""
    
    if status == "accepted":
        color = "#27ae60"
        title = "Congratulations!"
        message = f"We are pleased to inform you that you have been <strong>accepted</strong> based on your performance in the interview: <strong>{interview_title}</strong>."
        next_steps = "<p>Our team will contact you soon with next steps.</p>"
    elif status == "rejected":
        color = "#e74c3c"
        title = "Interview Update"
        message = f"Thank you for your time and effort in completing the interview: <strong>{interview_title}</strong>. After careful review, we have decided not to move forward at this time."
        next_steps = "<p>We encourage you to apply for other opportunities in the future.</p>"
    else:  # pending or other
        color = "#f39c12"
        title = "Status Update"
        message = f"The status of your interview <strong>{interview_title}</strong> has been updated to: <strong>{status}</strong>."
        next_steps = "<p>We will notify you once a final decision has been made.</p>"
    
    score_section = f'<p><strong>Your Score:</strong> {score}/10</p>' if score is not None else ""
    
    return f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: {color};">{title}</h2>
                <p>Hello {candidate_name},</p>
                <p>{message}</p>
                {score_section}
                {next_steps}
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:5173/candidate" style="background-color: {color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Your Dashboard</a>
                </div>
                <p style="font-size: 12px; color: #7f8c8d;">Best regards,<br>HR Team</p>
                {logo_html}
            </div>
        </body>
    </html>
    """


