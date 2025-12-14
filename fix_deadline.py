import sqlite3
from pathlib import Path

db_path = Path("server/data/hr_agent.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Finding 'HR manager for tech company' ---")
cursor.execute("SELECT id, title, deadline FROM interviews WHERE title LIKE '%HR manager%'")
rows = cursor.fetchall()

if not rows:
    print("Not found! Listing all:")
    cursor.execute("SELECT id, title, deadline FROM interviews")
    all_rows = cursor.fetchall()
    for row in all_rows:
        if row[2] is None:
            print(f"Updating deadline for {row[1]} ({row[0]})...")
            cursor.execute("UPDATE interviews SET deadline = '2025-11-22T12:00:00' WHERE id = ?", (row[0],))
            conn.commit()
            print("Updated!")
else:
    for row in rows:
        print(f"Found: {row}")
        if row[2] is None:
            print(f"Updating deadline for {row[0]}...")
            # Set a deadline for tomorrow
            cursor.execute("UPDATE interviews SET deadline = '2025-11-22T12:00:00' WHERE id = ?", (row[0],))
            conn.commit()
            print("Updated!")

conn.close()
