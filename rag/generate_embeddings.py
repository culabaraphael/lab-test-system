"""
Generates embeddings for the RAG knowledge base and writes them to a new
JSON file, ready to be loaded into the `knowledge_base_entries` Postgres
table (see backend/app/Console/Commands/SeedKnowledgeBase.php).

Model: sentence-transformers/all-MiniLM-L6-v2 (384-dimensional output).
Chosen because it is free, runs locally (no API key/cost), and is a
well-established general-purpose embedding model -- reasonable to cite
in the thesis as: Reimers & Gurevych (2019), "Sentence-BERT: Sentence
Embeddings using Siamese BERT-Networks," and the model card at
https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2

Run this once (and again any time knowledge_base.json changes):
    pip install -r requirements.txt
    python generate_embeddings.py

Output: knowledge_base_with_embeddings.json (same entries, each with an
added "embedding" field: a list of 384 floats).
"""

import json
from pathlib import Path

from sentence_transformers import SentenceTransformer

INPUT_PATH = Path(__file__).parent / "knowledge_base.json"
OUTPUT_PATH = Path(__file__).parent / "knowledge_base_with_embeddings.json"
MODEL_NAME = "all-MiniLM-L6-v2"


def main():
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        entries = json.load(f)

    print(f"Loaded {len(entries)} entries from {INPUT_PATH.name}")
    print(f"Loading model: {MODEL_NAME} (first run downloads it, ~90MB)")
    model = SentenceTransformer(MODEL_NAME)

    # Embed title + content together so the vector captures both the
    # short label and the full explanation -- this is what gets compared
    # against a query built from the patient's abnormal finding at
    # retrieval time.
    texts = [f"{e['title']}. {e['content']}" for e in entries]

    print(f"Embedding {len(texts)} entries...")
    embeddings = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)

    for entry, embedding in zip(entries, embeddings):
        entry["embedding"] = embedding.tolist()

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)

    print(f"Wrote {len(entries)} entries with embeddings to {OUTPUT_PATH.name}")
    print(f"Embedding dimension: {len(entries[0]['embedding'])}")


if __name__ == "__main__":
    main()
