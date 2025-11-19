#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(__file__))

from data_manager import data_manager

def main():
    # Recreate admin user
    admin = data_manager.create_user('admin', 'admin123', role='admin')
    print(f'Created admin user: {admin["username"]}')

    # Recreate omar user with email
    omar = data_manager.create_user('omar', 'omar', role='candidate', email='omarwalaa50@gmail.com')
    print(f'Created omar user: {omar["username"]}')

    # Recreate sample interview
    interview = {
        'id': 'int-software-engineer-001',
        'title': 'Software Engineer Interview',
        'description': 'Standard software engineering interview questions',
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
        'allowed_candidate_ids': [omar['id']],
        'active': True
    }

    # Save interview
    data_manager.save_interviews([interview])
    print(f'Created interview: {interview["title"]}')

if __name__ == "__main__":
    main()
