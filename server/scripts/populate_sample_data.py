#!/usr/bin/env python3
"""
Populate sample users, interviews, and results in the SQLite database via the DataManager.
Run from the server folder:

    cd hr_agent/server
    python scripts/populate_sample_data.py

This script is safe to rerun and will avoid creating duplicated usernames/interviews.
"""
import sys
import os
from pathlib import Path
import uuid
from datetime import datetime

# Ensure server folder is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Import DataManager
from server.data_manager import data_manager


def ensure_user(username: str, password: str, role: str = 'candidate', email: str | None = None):
    existing = data_manager.get_user_by_username(username)
    if existing:
        return existing
    return data_manager.create_user(username, password, role=role, email=email)


def ensure_interview(interview_id: str, interview_payload: dict):
    existing = data_manager.get_interview(interview_id)
    if existing:
        return existing
    data_manager.save_interviews([interview_payload] + data_manager.load_interviews())
    return data_manager.get_interview(interview_id)


def make_sample_result(session_id: str, interview, candidate, answers, average_score: float = 6.5):
    record = {
        'id': str(uuid.uuid4()),
        'session_id': session_id,
        'interview_id': interview['id'],
        'candidate_id': candidate['id'],
        'candidate_username': candidate['username'],
        'interview_title': interview['title'],
        'timestamp': datetime.now().isoformat(),
        'answers': answers,
        'feedback': [
            {
                'question_index': a['question_index'],
                'feedback': 'Sample feedback',
                'strengths': 'Good structure',
                'areas_for_improvement': 'Be more specific',
                'score': 7.0
            } for a in answers
        ],
        'scores': {'average': float(average_score), 'details': [{'question_index': a['question_index'], 'score': 7.0} for a in answers]},
        'summary': f'Sample interview completed with average {average_score:.1f}',
        'status': 'pending',
    }
    data_manager.upsert_result(session_id, record)
    return record


def main():
    print('📋 Populating sample users, interviews, and results...')

    # Create admin and sample candidates
    admin = ensure_user('admin', 'admin123', role='admin')
    omar = ensure_user('omar', 'omar', role='candidate', email='omarwalaa50@gmail.com')
    alice = ensure_user('alice', 'alice', role='candidate', email='alice@example.com')
    bob = ensure_user('bob', 'bob', role='candidate', email='bob@example.com')

    print('Users created/verified: ', [u for u in [admin, omar, alice, bob] if u])

    # Create sample interviews (id 'int-software-engineer-001' and 'int-data-scientist-001')
    interview1 = {
        'id': 'int-software-engineer-001',
        'title': 'Software Engineer Interview',
        'description': 'Standard software engineering interview',
        'config': {
            'job_role': 'Software Engineer',
            'num_questions': 5,
            'questions': [
                'Tell me about yourself and your background in software development.',
                'What is your experience with full-stack development?',
                'How do you approach debugging a complex issue?',
                'Describe a challenging project you worked on.',
                'What technologies are you most excited about and why?'
            ]
        },
        'allowed_candidate_ids': [omar['id'], alice['id']],
        'active': True
    }

    interview2 = {
        'id': 'int-data-scientist-001',
        'title': 'Data Scientist Interview',
        'description': 'Introductory data scientist role questions',
        'config': {
            'job_role': 'Data Scientist',
            'num_questions': 4,
            'questions': [
                'Describe a machine learning project you built.',
                'How do you evaluate model performance?',
                'How have you handled data quality issues?',
                'Explain how you would deploy a model to production.'
            ]
        },
        'allowed_candidate_ids': [bob['id'], alice['id']],
        'active': True
    }

    iv1 = ensure_interview(interview1['id'], interview1)
    iv2 = ensure_interview(interview2['id'], interview2)

    print('Interviews created/verified: ', [iv1['id'], iv2['id']])

    # Create a couple of sample results (completed sessions)
    # Session for omar and interview1
    answers_omar = [
        {'question_index': 0, 'question': interview1['config']['questions'][0], 'transcript': 'I am Omar...'},
        {'question_index': 1, 'question': interview1['config']['questions'][1], 'transcript': 'I have experience with React...'},
        {'question_index': 2, 'question': interview1['config']['questions'][2], 'transcript': 'I debug by...'},
        {'question_index': 3, 'question': interview1['config']['questions'][3], 'transcript': 'A recent challenge was...'},
        {'question_index': 4, 'question': interview1['config']['questions'][4], 'transcript': 'I like Rust and Go...'},
    ]
    session_id_omar = f'sess-{uuid.uuid4()}'
    make_sample_result(session_id_omar, iv1, omar, answers_omar, average_score=7.2)

    # Session for alice and interview2
    answers_alice = [
        {'question_index': 0, 'question': interview2['config']['questions'][0], 'transcript': 'I built a churn model...'},
        {'question_index': 1, 'question': interview2['config']['questions'][1], 'transcript': 'I use cross validation...'},
        {'question_index': 2, 'question': interview2['config']['questions'][2], 'transcript': 'I clean data by...'},
        {'question_index': 3, 'question': interview2['config']['questions'][3], 'transcript': 'I would wrap in a REST API...'},
    ]
    session_id_alice = f'sess-{uuid.uuid4()}'
    make_sample_result(session_id_alice, iv2, alice, answers_alice, average_score=8.1)

    print('✅ Sample data populated successfully.')


if __name__ == '__main__':
    main()
