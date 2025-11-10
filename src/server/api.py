from flask import Flask, jsonify, request
from flask_cors import CORS
import faiss
import sqlite3
from sentence_transformers import SentenceTransformer

app = Flask(__name__)
CORS(app)

# Load once at startup
index = faiss.read_index("../data/index.faiss")
db = sqlite3.connect("../data/metadata.db", check_same_thread=False)
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")




@app.route('/api/related/<path:title>', methods=['GET'])
def get_related(title):
    """Get semantically similar articles"""
    cursor = db.cursor()
    
    # Try both underscore and space versions
    title_space = title.replace('_', ' ')
    title_underscore = title.replace(' ', '_')
    
    # Get article ID - try both formats
    cursor.execute(
        "SELECT article_id FROM articles WHERE title = ? OR title = ?", 
        (title, title_space)
    )
    row = cursor.fetchone()
    
    if not row:
        # Debug: show what titles exist
        cursor.execute("SELECT title FROM articles LIMIT 10")
        sample_titles = [r[0] for r in cursor.fetchall()]
        return jsonify({
            "error": "Article not found",
            "searched_for": [title, title_space],
            "sample_titles": sample_titles
        }), 404
    
    article_id = row[0]
    
    try:
        # Get embedding from FAISS
        embedding = index.reconstruct(article_id).reshape(1, -1)
    except Exception as e:
        return jsonify({"error": f"Embedding not found: {str(e)}"}), 404
    
    # Search for k=20 similar articles
    distances, indices = index.search(embedding, 21)  # +1 because first is self
    
    # Get titles (skip first result - it's the query article)
    results = []
    for idx, distance in zip(indices[0][1:8], distances[0][1:8]):  # Top 7
        cursor.execute("SELECT title FROM articles WHERE article_id = ?", (int(idx),))
        row = cursor.fetchone()
        if row:
            results.append({
                "title": row[0],
                "score": int(distance * 100)  # Convert to 0-100 score
            })
    
    return jsonify(results)




if __name__ == '__main__':
    app.run(port=5001, debug=True)
