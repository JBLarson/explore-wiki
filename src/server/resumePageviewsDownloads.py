import time
import requests
import sys
import os
from datetime import datetime, timedelta

# --- CONFIG ---
YEAR_MONTH = "2025-10" 
DOWNLOAD_DIR = "data/pageviews" # Directory to save files
# ----------------

# We need the year and month separately for the URL
try:
    YEAR, MONTH = YEAR_MONTH.split('-')
except ValueError:
    print(f"Error: YEAR_MONTH format is invalid. Must be 'YYYY-MM'.")
    sys.exit(1)

BASE_URL = f"https://dumps.wikimedia.org/other/pageview_complete/{YEAR}/{YEAR_MONTH}"
MAX_RETRIES = 5
RETRY_DELAY = 10 # Seconds to wait after a 503 error

# Use a session for connection pooling
SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'WikiExplorer-ETL/1.0 (Data download script)'
})

def get_day_urls(year, month):
    """Generates the list of daily 'user.bz2' URLs for the month."""
    urls = []
    month_int = int(month)
    year_int = int(year)
    
    if month_int == 12:
        last_day = 31
    else:
        last_day = (datetime(year_int, month_int + 1, 1) - timedelta(days=1)).day
        
    print(f"Generating URLs for {YEAR_MONTH} ({last_day} days)...")
    
    for day in range(1, last_day + 1):
        filename = f"pageviews-{year}{month}{day:02d}-user.bz2"
        urls.append((f"{BASE_URL}/{filename}", filename))
    return urls

def download_file(url, local_path):
    """
    Downloads a single file with retries and atomic writes.
    """
    
    # --- THIS IS THE RESUME LOGIC ---
    if os.path.exists(local_path):
        print(f"  [SKIP] File already exists: {os.path.basename(local_path)}")
        return True
    
    # --- THIS IS THE ATOMIC/PARTIAL FILE FIX ---
    tmp_path = local_path + ".tmp"
        
    print(f"  [GET] Downloading {url} -> {os.path.basename(tmp_path)}")
    
    for i in range(MAX_RETRIES):
        try:
            with SESSION.get(url, stream=True, timeout=60) as res:
                if res.status_code >= 500:
                    wait_time = RETRY_DELAY * (i + 1)
                    print(f"  [WARN] Server error ({res.status_code}). Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue

                res.raise_for_status()
                
                # Download to .tmp file
                with open(tmp_path, 'wb') as f:
                    for chunk in res.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                # --- DOWNLOAD IS COMPLETE ---
                # Rename .tmp to final path
                os.rename(tmp_path, local_path)
                print(f"  [OK] Saved {os.path.basename(local_path)}")
                return True
                
        except requests.RequestException as e:
            wait_time = RETRY_DELAY * (i + 1)
            print(f"  [WARN] Network error: {e}. Retrying in {wait_time}s...")
            time.sleep(wait_time)
        except KeyboardInterrupt:
            print("\n  [CANCEL] Download cancelled by user. Cleaning up .tmp file...")
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise # Re-raise the interrupt to stop the script
            
    print(f"  [FAIL] Max retries exceeded for {url}.")
    # Clean up tmp file on failure
    if os.path.exists(tmp_path):
        os.remove(tmp_path)
    return False

def main():
    print(f"Starting pageview downloader for {YEAR_MONTH}")
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    
    urls_to_fetch = get_day_urls(YEAR, MONTH)
    
    try:
        for url, filename in urls_to_fetch:
            local_path = os.path.join(DOWNLOAD_DIR, filename)
            download_file(url, local_path)
            
    except KeyboardInterrupt:
        print("\n[STOP] Script interrupted. Run again to resume.")
        sys.exit(0)
        
    print("\nDownload process complete.")

if __name__ == "__main__":
    main()