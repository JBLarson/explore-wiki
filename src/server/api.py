from flask import Flask, jsonify, request
from flask_cors import CORS
import faiss
import sqlite3
import math
from sentence_transformers import SentenceTransformer
import os

# --- 1. CRITICAL FIX for macOS ---
os.environ["TOKENIZERS_PARALLELISM"] = "false"

app = Flask(__name__)
CORS(app)

# --- Scoring Weights ---
# We can tune these. 70% semantic, 30% popularity.
WEIGHT_SEMANTIC = 0.70
WEIGHT_POPULARITY = 0.30
CANDIDATE_POOL_SIZE = 50 # Get 50, re-rank to 7
RESULTS_TO_RETURN = 7

# --- Load once at startup ---

print("Loading FAISS index...")
index = faiss.read_index("../data/embeddings/index.faiss")

try:
    ivf_index = faiss.downcast_index(index.index) 
    print("Enabling direct map for reconstruct()...")
    ivf_index.make_direct_map(True)
    ivf_index.nprobe = 16 
    print(f"Index is IndexIDMap(IVF). Set nprobe = {ivf_index.nprobe}")
except Exception as e:
    print(f"Index is likely Flat. nprobe/direct_map not applicable. Error: {e}")

print("Connecting to metadata database...")
db = sqlite3.connect("../data/embeddings/metadata.db", check_same_thread=False)
db.row_factory = sqlite3.Row # Allows accessing columns by name

print("Loading sentence transformer model...")
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

print("Flask server ready.")

# --- Helper Functions ---

def normalize_popularity(pageviews):
    """Normalize pageviews using log10 for a smoother score."""
    if pageviews is None or pageviews <= 0:
        return 0.0
    # Log10(1) = 0. Log10(1,000,000) = 6.
    # We'll cap the max score at 7 (10M views) to prevent outliers dominating.
    return min(1.0, math.log10(pageviews + 1) / 7.0)

def is_meta_page(title):
    """Ported from the old JS file to filter out junk pages."""
    lower = title.lower()
    meta_prefixes = [
        'wikipedia:', 'template:', 'category:', 'portal:',
        'help:', 'user:', 'talk:', 'file:', 'list of'
    ]
    if any(lower.startswith(p) for p in meta_prefixes):
        return True
    if '(disambiguation)' in lower:
        return True
    return False

# ----------------------------

@app.route('/api/related/<path:title>', methods=['GET'])
def get_related(title):
    """Get semantically similar AND popular articles"""
    cursor = db.cursor()
    
    lookup_key = title.replace(' ', '_').lower()
    
    # --- 1. Get Source Article ID ---
    cursor.execute(
        "SELECT article_id FROM articles WHERE lookup_title = ?", 
        (lookup_key,)
    )
    row = cursor.fetchone()
    
    if not row:
        return jsonify({"error": "Article not found", "searched_for": [lookup_key]}), 404
    
    article_id = row['article_id']
    
    try:
        embedding = index.reconstruct(int(article_id)).reshape(1, -1)
    except Exception as e:
        return jsonify({"error": f"Embedding reconstruction failed: {str(e)}"}), 404
    
    # --- 2. Get Semantic Candidates (Candidate Pool) ---
    # Get 1 extra because the first result is always the query article itself
    distances, indices = index.search(embedding, CANDIDATE_POOL_SIZE + 1)
    
    # --- 3. Fetch Signals & Re-rank ---
    ranked_results = []
    
    # Get the article IDs for our candidates, skipping the first (self)
    candidate_ids = [int(idx) for idx in indices[0][1:]]
    # Get their distances (scores)
    candidate_dists = distances[0][1:]
    
    # Placeholders for the SQL query
    placeholders = ','.join('?' for _ in candidate_ids)
    
    # Fetch all candidate signals in ONE query
    cursor.execute(
        f"""
        SELECT article_id, title, pageviews 
        FROM articles 
        WHERE article_id IN ({placeholders})
        """, 
        candidate_ids
    )
    
    # Create a lookup map for the results
    candidate_data = {row['article_id']: row for row in cursor.fetchall()}
    
    # Now, re-rank
    for i, cand_id in enumerate(candidate_ids):
        data = candidate_data.get(cand_id)
        
        # Skip if no data or if it's a meta page
        if not data or is_meta_page(data['title']):
            continue
            
        # --- 4. Calculate Final Score ---
        # Assuming vectors are normalized, (1 - distance) is a good similarity score
        score_semantic = (1 - candidate_dists[i]) 
        score_popularity = normalize_popularity(data['pageviews'])
        
        final_score = (score_semantic * WEIGHT_SEMANTIC) + (score_popularity * WEIGHT_POPULARITY)
        
        ranked_results.append({
            "title": data['title'],
            "score": int(final_score * 100) # Convert to 0-100 score
        })

    # Sort by the new final score
    ranked_results.sort(key=lambda x: x['score'], reverse=True)
    
    return jsonify(ranked_results[:RESULTS_TO_RETURN])

if __name__ == '__main__':
    app.run(port=5001, debug=True)