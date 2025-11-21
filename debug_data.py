import sqlite3
import json

def inspect_result(session_id):
    conn = sqlite3.connect('./server/data/hr_agent.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM results WHERE session_id = ?", (session_id,))
    row = cursor.fetchone()
    
    if row:
        result = dict(row)
        print(f"--- Result for {session_id} ---")
        print("KEYS:", result.keys())
        
        answers = result.get('answers')
        if answers:
            try:
                parsed_answers = json.loads(answers)
                print(f"\nANSWERS ({len(parsed_answers)}):")
                for i, a in enumerate(parsed_answers):
                    print(f"  [{i}] keys: {a.keys()}")
                    if 'feedback' in a:
                        print(f"      feedback: {a['feedback']}")
            except:
                print(f"\nANSWERS (raw): {answers}")
        else:
            print("\nANSWERS: None")

        feedback = result.get('feedback')
        if feedback:
            try:
                parsed_feedback = json.loads(feedback)
                print(f"\nFEEDBACK ({len(parsed_feedback)}):")
                print(json.dumps(parsed_feedback, indent=2))
            except:
                print(f"\nFEEDBACK (raw): {feedback}")
        else:
            print("\nFEEDBACK: None")
            
    else:
        print(f"No result found for {session_id}")
    
    conn.close()

if __name__ == "__main__":
    inspect_result("bc27beac-17a8-49c0-be73-2257a56b7df7")
