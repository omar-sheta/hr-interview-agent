"""Utility client for interacting with the HR Interview Agent API."""

from __future__ import annotations

import argparse
import io
import json
import os
from typing import Any, Dict, Optional

import requests


class HRInterviewClient:
  """Thin wrapper around the FastAPI endpoints used by the interview workspace."""

  def __init__(self, server_url: str = "http://localhost:8001") -> None:
    self.base_url = server_url.rstrip('/')
    self.session = requests.Session()

  # ------------------------------------------------------------------
  # Health & metadata
  # ------------------------------------------------------------------
  def health_check(self) -> Dict[str, Any]:
    response = self.session.get(self._url('/health'))
    response.raise_for_status()
    return response.json()

  def list_candidate_interviews(self, candidate_id: str) -> Dict[str, Any]:
    response = self.session.get(self._url('/api/candidate/interviews'), params={'candidate_id': candidate_id})
    response.raise_for_status()
    return response.json()

  # ------------------------------------------------------------------
  # Interview lifecycle
  # ------------------------------------------------------------------
  def start_candidate_interview(self, interview_id: str, candidate_id: str) -> Dict[str, Any]:
    response = self.session.post(
      self._url(f'/api/candidate/interviews/{interview_id}/start'),
      json={'candidate_id': candidate_id},
    )
    response.raise_for_status()
    return response.json()

  def start_ad_hoc_interview(self, candidate_name: Optional[str], job_role: Optional[str], num_questions: int = 3) -> Dict[str, Any]:
    response = self.session.post(
      self._url('/interview/start'),
      json={'candidate_name': candidate_name, 'job_role': job_role, 'num_questions': num_questions},
    )
    response.raise_for_status()
    return response.json()

  def get_interview_session(self, session_id: str) -> Dict[str, Any]:
    response = self.session.get(self._url(f'/interview/{session_id}'))
    response.raise_for_status()
    return response.json()

  def get_interview_results(self, session_id: str) -> Dict[str, Any]:
    response = self.session.get(self._url(f'/interview/{session_id}/results'))
    response.raise_for_status()
    return response.json()

  # ------------------------------------------------------------------
  # Audio / Transcript helpers
  # ------------------------------------------------------------------
  def transcribe_audio(self, audio_path: str, *, session_id: Optional[str] = None, question_index: Optional[int] = None) -> Dict[str, Any]:
    with open(audio_path, 'rb') as audio_file:
      files = {'audio': (os.path.basename(audio_path), audio_file, 'audio/wav')}
      data: Dict[str, Any] = {}
      if session_id is not None and question_index is not None:
        data.update({'session_id': session_id, 'question_index': question_index})
      response = self.session.post(self._url('/transcribe'), files=files, data=data)
      response.raise_for_status()
      return response.json()

  def transcribe_audio_bytes(self, audio_bytes: bytes, *, filename: str = 'audio.wav', session_id: Optional[str] = None, question_index: Optional[int] = None) -> Dict[str, Any]:
    files = {'audio': (filename, io.BytesIO(audio_bytes), 'audio/wav')}
    data: Dict[str, Any] = {}
    if session_id is not None and question_index is not None:
      data.update({'session_id': session_id, 'question_index': question_index})
    response = self.session.post(self._url('/transcribe'), files=files, data=data)
    response.raise_for_status()
    return response.json()

  def submit_transcript(self, session_id: str, question_index: int, transcript_id: Optional[str]) -> Dict[str, Any]:
    form = {'session_id': session_id, 'question_index': question_index}
    if transcript_id:
      form['transcript_id'] = transcript_id
    response = self.session.post(self._url('/interview/submit'), data=form)
    response.raise_for_status()
    return response.json()

  def submit_audio_answer(self, session_id: str, question_index: int, audio_path: str) -> Dict[str, Any]:
    transcription = self.transcribe_audio(audio_path, session_id=session_id, question_index=question_index)
    transcript_id = transcription.get('transcript_id')
    return {
      'transcription': transcription,
      'submission': self.submit_transcript(session_id, question_index, transcript_id),
    }

  # ------------------------------------------------------------------
  def _url(self, path: str) -> str:
    return f"{self.base_url}{path}" if path.startswith('/') else f"{self.base_url}/{path}"


# ----------------------------------------------------------------------
# CLI utilities
# ----------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
  parser = argparse.ArgumentParser(description='Debug client for the HR Interview Agent API')
  parser.add_argument('--api-host', default='127.0.0.1')
  parser.add_argument('--api-port', type=int, default=8001)
  subparsers = parser.add_subparsers(dest='command', required=True)

  start = subparsers.add_parser('start', help='Start an interview assignment for a candidate')
  start.add_argument('--candidate-id', required=True)
  start.add_argument('--interview-id', required=True)

  assignments = subparsers.add_parser('assignments', help='List interviews available to a candidate')
  assignments.add_argument('--candidate-id', required=True)

  session = subparsers.add_parser('session', help='Show session metadata and questions')
  session.add_argument('--session-id', required=True)

  submit = subparsers.add_parser('submit', help='Transcribe & submit an audio answer for a question')
  submit.add_argument('--session-id', required=True)
  submit.add_argument('--question-index', type=int, required=True)
  submit.add_argument('--audio', required=True, help='Path to the audio file to upload')

  results = subparsers.add_parser('results', help='Fetch scored results for a completed session')
  results.add_argument('--session-id', required=True)

  return parser


def pretty_print(payload: Dict[str, Any]) -> None:
  print(json.dumps(payload, indent=2, sort_keys=True))


def run_cli() -> None:
  parser = build_parser()
  args = parser.parse_args()
  base_url = f"http://{args.api_host}:{args.api_port}"
  client = HRInterviewClient(base_url)

  try:
    if args.command == 'start':
      data = client.start_candidate_interview(args.interview_id, args.candidate_id)
      pretty_print(data)
    elif args.command == 'assignments':
      data = client.list_candidate_interviews(args.candidate_id)
      pretty_print(data)
    elif args.command == 'session':
      data = client.get_interview_session(args.session_id)
      pretty_print(data)
    elif args.command == 'submit':
      data = client.submit_audio_answer(args.session_id, args.question_index, args.audio)
      pretty_print(data)
    elif args.command == 'results':
      data = client.get_interview_results(args.session_id)
      pretty_print(data)
    else:
      parser.error('Unknown command specified')
  except requests.HTTPError as err:
    print(f'API request failed: {err}')
    if err.response is not None:
      try:
        print('Response:', err.response.json())
      except Exception:
        print('Response text:', err.response.text)


if __name__ == '__main__':
  run_cli()
