import sqlite3
import time

DB_PATH = "data/embeddings/metadata.db"

def normalize_database():
    print(f"Connecting to database at {DB_PATH}...")
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # --- 1. Add new 'lookup_title' column ---
        print("Checking for 'lookup_title' column...")
        try:
            cursor.execute("ALTER TABLE articles ADD COLUMN lookup_title TEXT")
            print("Added 'lookup_title' column.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("Column 'lookup_title' already exists. Skipping.")
            else:
                raise e

        # --- 2. Populate the new column ---
        print("Fetching all titles to normalize...")
        cursor.execute("SELECT article_id, title FROM articles WHERE lookup_title IS NULL")
        rows = cursor.fetchall()
        
        if not rows:
            print("Database is already normalized. No rows to update.")
        else:
            print(f"Found {len(rows)} articles to normalize. This may take a moment...")
            start_time = time.time()
            count = 0
            
            updates = []
            for row in rows:
                article_id, title = row
                if title: # Ensure title is not None
                    lookup_title = title.lower()
                    updates.append((lookup_title, article_id))
            
            # Use executemany for a massive speed improvement
            print("Updating database in a single transaction...")
            cursor.executemany("UPDATE articles SET lookup_title = ? WHERE article_id = ?", updates)
            conn.commit()
            
            end_time = time.time()
            print(f"Successfully normalized {len(updates)} articles in {end_time - start_time:.2f} seconds.")

        # --- 3. Create an index for fast lookups ---
        print("Creating index on 'lookup_title' for fast lookups...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_lookup_title ON articles(lookup_title)")
        print("Index 'idx_lookup_title' created or already exists.")

        print("\nDatabase normalization complete.")

    except Exception as e:
        print(f"\nAn error occurred: {e}")
        if conn:
            conn.rollback() # Roll back any changes on error
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    normalize_database()