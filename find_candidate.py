import sqlite3

DB_PATH = "server/data/hr_agent.db"

def get_candidate():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT username, role FROM users WHERE role='candidate' LIMIT 1")
    user = cursor.fetchone()
    
    if user:
        print(f"Found candidate: {user['username']}")
    else:
        print("No candidate found.")
    
    conn.close()

if __name__ == "__main__":
    get_candidate()
