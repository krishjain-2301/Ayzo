import sqlite3

conn = sqlite3.connect('ayzo_demo.db')
cursor = conn.cursor()

try:
    cursor.execute("SELECT eval_reasoning, COUNT(*) FROM test_results WHERE result='error' GROUP BY eval_reasoning;")
    print("Errors in DB:")
    for row in cursor.fetchall():
        print(f"  {row[1]} errors: {row[0]}")
except Exception as e:
    print(f"Failed to query test_results: {e}")
