"""
Data Manager for HR Interview Agent Server

Handles persistent storage of sessions, transcripts, and audio files.
"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import shutil

from .database import create_tables, get_db_connection


class DataManager:
    """Manages persistent storage for interview sessions and transcripts."""
    
    def __init__(self, base_path: str = "./data"):
        self.base_path = Path(base_path)
        self.sessions_path = self.base_path / "sessions"
        self.transcripts_path = self.base_path / "transcripts"  
        self.audio_path = self.base_path / "audio"
        
        # Initialize database
        create_tables()
        
        # Ensure directories for file-based storage exist
        for path in [self.sessions_path, self.transcripts_path, self.audio_path]:
            path.mkdir(parents=True, exist_ok=True)

    # Users ----------------------------------------------------------------
    def load_users(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users")
        users = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return users

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        conn.close()
        return dict(user) if user else None

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        username = username.lower()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE lower(username) = ?", (username,))
        user = cursor.fetchone()
        conn.close()
        return dict(user) if user else None

    def create_user(self, username: str, password: str, role: str = "candidate") -> Optional[Dict[str, Any]]:
        """Create a new user and save to the database. Returns the new user or None if username exists."""
        if self.get_user_by_username(username):
            return None  # Username already exists

        new_user = {
            "id": str(uuid.uuid4()),
            "username": username,
            "password": password,  # Storing as plain text for now, consider hashing in production
            "role": role,
            "created_at": datetime.now().isoformat(),
        }

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (new_user["id"], new_user["username"], new_user["password"], new_user["role"], new_user["created_at"]),
        )
        conn.commit()
        conn.close()

        print(f"➕ Created new user: {username} with role {role}")
        return new_user

    # Interviews ------------------------------------------------------------
    def load_interviews(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM interviews")
        interviews = []
        for row in cursor.fetchall():
            interview = dict(row)
            interview['config'] = json.loads(interview['config']) if interview['config'] else {}
            interview['allowed_candidate_ids'] = json.loads(interview['allowed_candidate_ids']) if interview['allowed_candidate_ids'] else []
            interviews.append(interview)
        conn.close()
        return interviews

    def save_interviews(self, interviews: List[Dict[str, Any]]) -> None:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM interviews")
        for interview in interviews:
            cursor.execute(
                "INSERT INTO interviews (id, title, description, config, allowed_candidate_ids, active) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    interview["id"],
                    interview["title"],
                    interview.get("description"),
                    json.dumps(interview.get("config", {})),
                    json.dumps(interview.get("allowed_candidate_ids", [])),
                    interview.get("active", True),
                ),
            )
        conn.commit()
        conn.close()

    def get_interview(self, interview_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM interviews WHERE id = ?", (interview_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        interview = dict(row)
        interview['config'] = json.loads(interview['config']) if interview['config'] else {}
        interview['allowed_candidate_ids'] = json.loads(interview['allowed_candidate_ids']) if interview['allowed_candidate_ids'] else []
        return interview

    # Results ---------------------------------------------------------------
    def load_results(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM results")
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    def upsert_result(self, session_id: str, record: Dict[str, Any]) -> Dict[str, Any]]:
        """Insert or update a result record keyed by session_id."""
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if a result with the given session_id already exists
        cursor.execute("SELECT * FROM results WHERE session_id = ?", (session_id,))
        existing_result = cursor.fetchone()

        if existing_result:
            # Update existing record
            update_data = {**dict(existing_result), **record}
            update_data['updated_at'] = datetime.now().isoformat()

            cursor.execute(
                """
                UPDATE results
                SET interview_id = ?, candidate_id = ?, summary = ?, feedback = ?, score = ?, updated_at = ?, status = ?
                WHERE session_id = ?
                """,
                (
                    update_data.get("interview_id"),
                    update_data.get("candidate_id"),
                    update_data.get("summary"),
                    update_data.get("feedback"),
                    update_data.get("score"),
                    update_data["updated_at"],
                    update_data.get("status"),
                    session_id,
                ),
            )
        else:
            # Insert new record
            record.setdefault("id", str(uuid.uuid4()))
            record.setdefault("status", "pending")
            record["session_id"] = session_id
            record["created_at"] = datetime.now().isoformat()
            record["updated_at"] = record["created_at"]

            cursor.execute(
                """
                INSERT INTO results (id, session_id, interview_id, candidate_id, summary, feedback, score, created_at, updated_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["session_id"],
                    record.get("interview_id"),
                    record.get("candidate_id"),
                    record.get("summary"),
                    record.get("feedback"),
                    record.get("score"),
                    record["created_at"],
                    record["updated_at"],
                    record["status"],
                ),
            )

        conn.commit()
        conn.close()
        return record
    
    # Session Management
    def create_session(self, session_data: Dict[str, Any]) -> str:
        """Create a new interview session and return session_id."""
        session_id = str(uuid.uuid4())
        session_data['session_id'] = session_id
        session_data['created_at'] = datetime.now().isoformat()
        session_data['updated_at'] = datetime.now().isoformat()
        
        session_file = self.sessions_path / f"{session_id}.json"
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        print(f"💾 Created session {session_id}")
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session data by ID."""
        session_file = self.sessions_path / f"{session_id}.json"
        if not session_file.exists():
            return None
        
        try:
            with open(session_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"❌ Error loading session {session_id}: {e}")
            return None
    
    def update_session(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update session data."""
        session = self.get_session(session_id)
        if not session:
            return False
        
        session.update(updates)
        session['updated_at'] = datetime.now().isoformat()
        
        session_file = self.sessions_path / f"{session_id}.json"
        try:
            with open(session_file, 'w') as f:
                json.dump(session, f, indent=2)
            return True
        except IOError as e:
            print(f"❌ Error updating session {session_id}: {e}")
            return False
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session and all associated data."""
        session_file = self.sessions_path / f"{session_id}.json"
        if session_file.exists():
            try:
                session_file.unlink()
                # Also clean up associated transcripts and audio
                self._cleanup_session_files(session_id)
                print(f"🗑️  Deleted session {session_id}")
                return True
            except IOError as e:
                print(f"❌ Error deleting session {session_id}: {e}")
                return False
        return False
    
    # Transcript Management
    def store_transcript(self, session_id: str, question_index: int, transcript_data: Dict[str, Any]) -> str:
        """Store transcript and return transcript_id."""
        transcript_id = f"{session_id}_{question_index}_{int(datetime.now().timestamp())}"
        transcript_data['transcript_id'] = transcript_id
        transcript_data['session_id'] = session_id
        transcript_data['question_index'] = question_index
        transcript_data['created_at'] = datetime.now().isoformat()
        
        transcript_file = self.transcripts_path / f"{transcript_id}.json"
        try:
            with open(transcript_file, 'w') as f:
                json.dump(transcript_data, f, indent=2)
            print(f"💾 Stored transcript {transcript_id}")
            return transcript_id
        except IOError as e:
            print(f"❌ Error storing transcript {transcript_id}: {e}")
            return None
    
    def get_transcript(self, transcript_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve transcript by ID."""
        transcript_file = self.transcripts_path / f"{transcript_id}.json"
        if not transcript_file.exists():
            return None
        
        try:
            with open(transcript_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"❌ Error loading transcript {transcript_id}: {e}")
            return None
    
    def get_session_transcripts(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all transcripts for a session, ordered by question_index."""
        transcripts = []
        for transcript_file in self.transcripts_path.glob(f"{session_id}_*.json"):
            try:
                with open(transcript_file, 'r') as f:
                    transcript = json.load(f)
                    transcripts.append(transcript)
            except (json.JSONDecodeError, IOError) as e:
                print(f"❌ Error loading transcript {transcript_file}: {e}")
                continue
        
        # Sort by question_index
        transcripts.sort(key=lambda x: x.get('question_index', 0))
        return transcripts
    
    # Audio File Management
    def store_audio_file(self, session_id: str, question_index: int, audio_content: bytes, filename: str) -> str:
        """Store audio file and return stored file path."""
        file_extension = Path(filename).suffix or '.bin'
        stored_filename = f"{session_id}_{question_index}_{int(datetime.now().timestamp())}{file_extension}"
        stored_path = self.audio_path / stored_filename
        
        try:
            with open(stored_path, 'wb') as f:
                f.write(audio_content)
            print(f"💾 Stored audio file {stored_filename}")
            return str(stored_path)
        except IOError as e:
            print(f"❌ Error storing audio file {stored_filename}: {e}")
            return None
    
    def get_audio_file_path(self, stored_filename: str) -> Optional[str]:
        """Get full path to stored audio file."""
        audio_file = self.audio_path / stored_filename
        return str(audio_file) if audio_file.exists() else None
    
    # Response Management  
    def add_session_response(self, session_id: str, question_index: int, transcript_id: str) -> bool:
        """Add a response to a session by linking to a transcript."""
        session = self.get_session(session_id)
        if not session:
            return False
        
        if 'responses' not in session:
            session['responses'] = []
        
        # Check for existing response for this question
        existing_index = None
        for i, resp in enumerate(session['responses']):
            if resp.get('question_index') == question_index:
                existing_index = i
                break
        
        response_data = {
            'question_index': question_index,
            'transcript_id': transcript_id,
            'submitted_at': datetime.now().isoformat()
        }
        
        if existing_index is not None:
            session['responses'][existing_index] = response_data
            print(f"🔄 Updated response for question {question_index} in session {session_id}")
        else:
            session['responses'].append(response_data)
            print(f"➕ Added response for question {question_index} in session {session_id}")
        
        return self.update_session(session_id, session)
    
    def get_session_responses_with_transcripts(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all responses for a session with full transcript data."""
        session = self.get_session(session_id)
        if not session or 'responses' not in session:
            return []
        
        responses_with_transcripts = []
        for response in session['responses']:
            transcript_id = response.get('transcript_id')
            if transcript_id:
                transcript = self.get_transcript(transcript_id)
                if transcript:
                    combined = {**response, **transcript}
                    responses_with_transcripts.append(combined)
                else:
                    # Transcript not found, add placeholder
                    placeholder = {
                        **response,
                        'transcript': '[Transcript not found]',
                        'transcript_id': transcript_id
                    }
                    responses_with_transcripts.append(placeholder)
        
        # Sort by question_index
        responses_with_transcripts.sort(key=lambda x: x.get('question_index', 0))
        return responses_with_transcripts
    
    # Cleanup
    def _cleanup_session_files(self, session_id: str):
        """Clean up all files associated with a session."""
        # Remove transcripts
        for transcript_file in self.transcripts_path.glob(f"{session_id}_*.json"):
            try:
                transcript_file.unlink()
            except IOError:
                pass
        
        # Remove audio files
        for audio_file in self.audio_path.glob(f"{session_id}_*"):
            try:
                audio_file.unlink()
            except IOError:
                pass
    
    def cleanup_old_sessions(self, days_old: int = 7):
        """Remove sessions older than specified days."""
        cutoff_time = datetime.now().timestamp() - (days_old * 24 * 60 * 60)
        
        for session_file in self.sessions_path.glob("*.json"):
            try:
                if session_file.stat().st_mtime < cutoff_time:
                    session_id = session_file.stem
                    self.delete_session(session_id)
            except (IOError, OSError):
                continue


# Global instance
data_manager = DataManager()
