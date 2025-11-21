import sqlite3
import json
import os

DB_PATH = "server/data/hr_agent.db"

def check_interview():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("--- Checking Interviews ---")
    cursor.execute("SELECT id, title, config, active FROM interviews")
    rows = cursor.fetchall()
    
    for row in rows:
        print(f"ID: {row['id']}")
        print(f"Title: {row['title']}")
        print(f"Active: {row['active']}")
        config = json.loads(row['config']) if row['config'] else {}
        questions = config.get('questions', [])
        print(f"Questions Count: {len(questions)}")
        if len(questions) > 0:
            print(f"First Question: {questions[0]}")
        else:
            print("WARNING: No questions found!")
        print("-" * 20)

    conn.close()

if __name__ == "__main__":
    check_interview()
