import sqlite3
from pathlib import Path

db_path = Path("server/data/hr_agent.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Table Info: interviews ---")
cursor.execute("PRAGMA table_info(interviews)")
columns = cursor.fetchall()
for col in columns:
    print(col)

print("\n--- Content of interviews ---")
cursor.execute("SELECT id, title, deadline FROM interviews")
rows = cursor.fetchall()
for row in rows:
    print(row)

conn.close()
