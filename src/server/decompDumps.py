import gzip
import shutil
import os
import time
import sys

# --- CONFIG ---
DATA_DIR = "data"
FILES_TO_DECOMPRESS = [
    "enwiki-latest-page.sql.gz",
    "enwiki-latest-pagelinks.sql.gz"
]
# ----------------

def decompress_file(gz_path):
    """Stream-decompresses a .gz file, printing progress."""
    
    # Define output path (e.g., "data/enwiki-latest-page.sql")
    sql_path = gz_path[:-3] # Remove the .gz
    
    if os.path.exists(sql_path):
        print(f"[SKIP] Decompressed file already exists: {sql_path}")
        return

    if not os.path.exists(gz_path):
        print(f"[ERROR] Source file not found: {gz_path}")
        return

    print(f"[START] Decompressing {gz_path} -> {sql_path}")
    print("  This will take a long time and use a lot of disk space...")
    
    start_time = time.time()
    
    try:
        with gzip.open(gz_path, 'rb') as f_in:
            with open(sql_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out, length=16*1024*1024) # 16MB buffer
        
        end_time = time.time()
        
        gz_size = os.path.getsize(gz_path) / (1024**3) # in GB
        sql_size = os.path.getsize(sql_path) / (1024**3) # in GB
        
        print(f"[DONE] Finished in {end_time - start_time:.2f}s")
        print(f"  {gz_path} ({gz_size:.2f} GB) -> {sql_path} ({sql_size:.2f} GB)")
        
    except Exception as e:
        print(f"\n[ERROR] Failed to decompress {gz_path}: {e}", file=sys.stderr)
        # Clean up partial file on error
        if os.path.exists(sql_path):
            os.remove(sql_path)

def main():
    print("Starting dump file decompress script...")
    
    for filename in FILES_TO_DECOMPRESS:
        gz_path = os.path.join(DATA_DIR, filename)
        decompress_file(gz_path)
        print("-" * 20)
        
    print("All files decompressed.")

if __name__ == "__main__":
    main()