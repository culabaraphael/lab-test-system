"""
Embedding Microservice -- FastAPI

Same bridge pattern as api.py (CBC) and urinalysis_api.py: Laravel (PHP)
can't call a Python ML model directly, so this exposes the sentence-
transformers embedding model over HTTP. Used by the RAG recommendation
layer to embed a query built from a lab result's abnormal findings, so
it can be compared against the knowledge_base_entries.embedding column
(pgvector) to find the most relevant knowledge base entries.

Model: sentence-transformers/all-MiniLM-L6-v2, 384-dim, normalized
output -- the SAME model and settings used by rag/generate_embeddings.py
to embed the knowledge base itself. Using a different model or different
normalization here would make the vectors incomparable, so if that
script ever changes model/settings, this file must change identically.

HOW TO RUN:
    uvicorn embedding_api:app --host 127.0.0.1 --port 8003 --reload

Then it's reachable at http://127.0.0.1:8003

ENDPOINTS:
    GET  /health  -- quick check that the service is up and the model
                     loaded correctly
    POST /embed   -- takes { "text": "..." }, returns a 384-float vector

WHY PORT 8003:
    8000 = Laravel (php artisan serve), 8001 = CBC ML, 8002 = Urinalysis
    ML. This is the next free port in the same sequence.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

MODEL_NAME = "all-MiniLM-L6-v2"

app = FastAPI(
    title="Lab Test System - Embedding Service",
    description="Serves sentence-transformers embeddings for the RAG "
                "knowledge base retrieval service.",
)

try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(MODEL_NAME)
    MODEL_LOADED = True
    MODEL_LOAD_ERROR = None
except Exception as e:
    model = None
    MODEL_LOADED = False
    MODEL_LOAD_ERROR = str(e)


class EmbedInput(BaseModel):
    text: str


class EmbedOutput(BaseModel):
    embedding: list[float]
    dimensions: int
    model_used: str = MODEL_NAME


@app.get("/health")
def health():
    return {
        "status": "ok" if MODEL_LOADED else "model_not_loaded",
        "model_loaded": MODEL_LOADED,
        "error": MODEL_LOAD_ERROR,
    }


@app.post("/embed", response_model=EmbedOutput)
def embed(payload: EmbedInput):
    if not MODEL_LOADED:
        raise HTTPException(
            status_code=503,
            detail=f"Embedding model failed to load: {MODEL_LOAD_ERROR}",
        )

    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=422, detail="text must not be empty")

    # normalize_embeddings=True matches rag/generate_embeddings.py exactly
    # -- required so cosine distance comparisons in pgvector are valid.
    vector = model.encode(payload.text, normalize_embeddings=True)

    return EmbedOutput(
        embedding=vector.tolist(),
        dimensions=len(vector),
    )
