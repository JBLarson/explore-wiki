from flask import Flask, jsonify, request
from flask_cors import CORS
import faiss
import sqlite3
from sentence_transformers import SentenceTransformer
import os

# --- 1. CRITICAL FIX for macOS ---
os.environ["TOKENIZERS_PARALLELISM"] = "false"

app = Flask(__name__)
CORS(app)

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

print("Loading sentence transformer model...")
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

print("Flask server ready.")

# ----------------------------

@app.route('/api/related/<path:title>', methods=['GET'])
def get_related(title):
    """Get semantically similar articles"""
    cursor = db.cursor()
    
    # --- 1. SIMPLIFIED NORMALIZATION ---
    # Normalize incoming title to match the 'lookup_title' format
    lookup_key = title.replace(' ', '_').lower()
    
    # --- 2. SIMPLIFIED & FASTER QUERY ---
    # Query against the new indexed column
    cursor.execute(
        "SELECT article_id FROM articles WHERE lookup_title = ?", 
        (lookup_key,) # Note the comma to make it a tuple
    )
    row = cursor.fetchone()
    
    if not row:
        # This 'not found' is now a real "not found"
        return jsonify({
            "error": "Article not found",
            "searched_for": [lookup_key],
        }), 404
    
    article_id = row[0]
    
    try:
        embedding = index.reconstruct(int(article_id)).reshape(1, -1)
    except Exception as e:
        return jsonify({"error": f"Embedding reconstruction failed: {str(e)}"}), 404
    
    distances, indices = index.search(embedding, 21)  # +1 because first is self
    
    results = []
    for idx, distance in zip(indices[0][1:8], distances[0][1:8]):
        if int(idx) == int(article_id): # Skip self
            continue
            
        cursor.execute("SELECT title FROM articles WHERE article_id = ?", (int(idx),))
        row = cursor.fetchone()
        if row:
            results.append({
                "title": row[0],
                "score": int(distance * 100)
            })
    
    return jsonify(results[:7])

if __name__ == '__main__':
    app.run(port=5001, debug=True)