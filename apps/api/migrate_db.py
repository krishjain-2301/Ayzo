import sqlite3

def upgrade():
    # Connect to the database
    conn = sqlite3.connect('ayzo_demo.db')
    cursor = conn.cursor()
    
    try:
        # Add the hashed_password column to the users table
        cursor.execute('ALTER TABLE users ADD COLUMN hashed_password VARCHAR(255) NULL;')
        conn.commit()
        print("Migration successful: added hashed_password to users.")
    except sqlite3.OperationalError as e:
        print(f"Migration failed or already applied: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    upgrade()
