"""RAG over movie reviews — ChromaDB + sentence-transformers."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CHROMA_DIR = Path(os.getenv("CHROMA_PERSIST_DIR", str(PROJECT_ROOT / "data" / "chroma")))
COLLECTION = os.getenv("RAG_COLLECTION", "imdb_reviews")
EMBED_MODEL = os.getenv("RAG_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

_store: Any = None
_embedder: Any = None


def rag_enabled() -> bool:
    return os.getenv("RAG_ENABLED", "true").lower() in ("1", "true", "yes")


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def _get_collection():
    global _store
    if _store is None:
        import chromadb
        from chromadb.config import Settings

        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
        _store = client.get_or_create_collection(
            name=COLLECTION,
            metadata={"hnsw:space": "cosine"},
        )
    return _store


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = _get_embedder()
    vectors = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
    return vectors.tolist()


def index_documents(
    texts: list[str],
    metadatas: list[dict] | None = None,
    ids: list[str] | None = None,
) -> dict[str, Any]:
    if not texts:
        return {"indexed": 0, "total": _get_collection().count()}
    col = _get_collection()
    metadatas = metadatas or [{} for _ in texts]
    ids = ids or [f"doc-{i}" for i in range(col.count(), col.count() + len(texts))]
    embeddings = embed_texts(texts)
    col.add(documents=texts, embeddings=embeddings, metadatas=metadatas, ids=ids)
    return {"indexed": len(texts), "total": col.count()}


def query_similar(text: str, k: int = 5) -> dict[str, Any]:
    col = _get_collection()
    if col.count() == 0:
        return {"query": text, "matches": [], "message": "Index empty — run: make rag-index"}
    q_emb = embed_texts([text])[0]
    result = col.query(query_embeddings=[q_emb], n_results=min(k, col.count()))
    matches = []
    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    dists = (result.get("distances") or [[]])[0]
    ids = (result.get("ids") or [[]])[0]
    for i, doc in enumerate(docs):
        matches.append(
            {
                "id": ids[i] if i < len(ids) else None,
                "text": doc,
                "metadata": metas[i] if i < len(metas) else {},
                "distance": dists[i] if i < len(dists) else None,
            }
        )
    return {"query": text, "matches": matches, "collection_size": col.count()}


def collection_stats() -> dict[str, Any]:
    col = _get_collection()
    return {
        "collection": COLLECTION,
        "count": col.count(),
        "persist_dir": str(CHROMA_DIR),
        "embed_model": EMBED_MODEL,
    }
