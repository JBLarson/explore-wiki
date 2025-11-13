import sqlite3
import gzip
import re
import time
from collections import defaultdict
import os

# --- CONFIG ---
DB_PATH = "data/embeddings/metadata.db"
# Updated paths to look in the 'data' directory
PAGE_SQL_PATH = "data/enwiki-latest-page.sql.gz" 
PAGELINKS_SQL_PATH = "data/enwiki-latest-pagelinks.sql.gz"
# ----------------

# Regex to find (id, namespace, title) from page.sql
page_regex = re.compile(r"\((\d+),(\d+),'(.*?)',.*?\)")
# Regex to find (source_id, namespace, target_title) from pagelinks.sql
pagelinks_regex = re.compile(r"\((\d+),(\d+),'(.*?)',(\d+)\)")

def process_backlinks():
    print("Starting backlink processor...")
    total_start_time = time.time()
    
    conn = None
    try:
        # --- Step 1: Build title -> id map from page.sql.gz ---
        print(f"Reading {PAGE_SQL_PATH} to build title->id map...")
        start_time = time.time()
        
        title_to_id = {}
        with gzip.open(PAGE_SQL_PATH, 'rt', encoding='utf-8', errors='ignore') as f:
            for line in f:
                if not line.startswith("INSERT INTO"):
                    continue
                
                for match in page_regex.finditer(line):
                    page_id, namespace, title = match.groups()
                    if namespace == '0':
                        lookup_title = title.replace(' ', '_').lower()
                        title_to_id[lookup_title] = int(page_id)
        
        print(f"Built map for {len(title_to_id)} articles in {time.time() - start_time:.2f}s")
        
        # --- Step 2: Stream pagelinks.sql.gz and count backlinks ---
        backlink_counts = defaultdict(int)
        print(f"Reading {PAGELINKS_SQL_PATH} to count backlinks...")
        print("This will take a few hours...")
        start_time = time.time()
        
        with gzip.open(PAGELINKS_SQL_PATH, 'rt', encoding='utf-8', errors='ignore') as f:
            for line_num, line in enumerate(f):
                if not line.startswith("INSERT INTO"):
                    continue
                    
                for match in pagelinks_regex.finditer(line):
                    source_id, target_namespace, target_title, _ = match.groups()
                    
                    if target_namespace == '0':
                        lookup_title = target_title.replace(' ', '_').lower()
                        target_id = title_to_id.get(lookup_title)
                        
                        if target_id:
                            backlink_counts[target_id] += 1
                
                if line_num % 1000 == 0:
                    print(f"  ...processed {line_num:,} lines of pagelinks", end='\r')
                    
        print(f"\nFinished counting backlinks in {time.time() - start_time:.2f}s.")
        print(f"Found links to {len(backlink_counts):,} unique articles.")
        
        # --- Step 3: Update our metadata.db with counts ---
        print(f"Connecting to {DB_PATH} to update backlink counts...")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        updates = [
            (count, page_id) 
            for page_id, count in backlink_counts.items()
        ]

        print(f"Updating {len(updates):,} articles with their backlink counts...")
        start_time = time.time()
        
        print("Resetting all backlinks to 0...")
        cursor.execute("UPDATE articles SET backlinks = 0")
        
        print("Applying new backlink counts...")
        cursor.executemany("""
            UPDATE articles 
            SET backlinks = ? 
            WHERE article_id = ?
        """, updates)
        
        conn.commit()
        print(f"Database update complete in {time.time() - start_time:.2f}s.")
        
        print(f"\nTotal backlink processing complete in {time.time() - total_start_time:.2f}s")

    except FileNotFoundError as e:
        print(f"\n[ERROR] File not found: {e.filename}", file=sys.stderr)
        print("Please make sure 'enwiki-latest-page.sql.gz' and 'enwiki-latest-pagelinks.sql.gz' are in the 'data/' directory.", file=sys.stderr)
    except Exception as e:
        print(f"\nAn error occurred: {e}", file=sys.stderr)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    process_backlinks()