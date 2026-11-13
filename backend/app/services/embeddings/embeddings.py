"""Embeddings: sentence-transformers when available, else a deterministic
hash-based fallback.

The fallback is NOT a semantic model: it hashes lower-cased words into a
384-dimensional bag-of-words vector (same dimension as all-MiniLM-L6-v2) and
L2-normalises it. It exists so the app and its tests run fully offline without
downloading a model, and so retrieval still ranks chunks sharing vocabulary
with the query. /api/health reports which mode is active honestly; the real
model is preferred whenever it can be loaded. Groq is NEVER used for
embeddings.
"""
import hashlib
import re
import threading

import numpy as np

DIM = 384
_model = None
_model_tried = False
# Guards the (slow, ~18s) first model load: without it, a second caller
# arriving mid-load would see _model_tried=True with _model still None and
# wrongly report hash-fallback — and a chat arriving in that window would
# embed (and cache) with hash vectors. With the lock, concurrent callers
# wait for the load to finish and then get the real model.
_model_lock = threading.Lock()


def _hash_embed(text: str) -> np.ndarray:
    vec = np.zeros(DIM, dtype=np.float32)
    for word in re.findall(r"[a-z0-9_]+", text.lower()):
        idx = int(hashlib.sha256(word.encode()).hexdigest(), 16) % DIM
        vec[idx] += 1.0
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return vec


def _load_model():
    # Always take the lock: a fast path that reads _model_tried outside it
    # can observe the intermediate state (_model_tried=True, _model still
    # None) mid-load and wrongly report hash-fallback. The lock is
    # uncontended after the first load, so this costs nothing then.
    global _model, _model_tried
    with _model_lock:
        if _model_tried:
            return _model
        _model_tried = True
        try:
            from sentence_transformers import SentenceTransformer

            from app.core.config import get_settings

            _model = SentenceTransformer(get_settings().embedding_model)
        except Exception:
            _model = None
        return _model


def embedding_mode() -> str:
    """'sentence-transformers' if the real model loaded, else 'hash-fallback'."""
    return "sentence-transformers" if _load_model() is not None else "hash-fallback"


def embed_texts(texts: list[str]) -> np.ndarray:
    """Return L2-normalised float32 array of shape (n, 384)."""
    model = _load_model()
    if model is not None:
        vecs = model.encode(texts, normalize_embeddings=True)
        return np.asarray(vecs, dtype=np.float32)
    if not texts:
        return np.zeros((0, DIM), dtype=np.float32)
    return np.stack([_hash_embed(t) for t in texts]).astype(np.float32)


def embed_query(text: str) -> np.ndarray:
    return embed_texts([text])[0]
