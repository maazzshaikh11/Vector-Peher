"""Chunking + embeddings unit tests (no DB needed for most)."""
import numpy as np

from app.services.chunking import chunk_text
from app.services.embeddings.embeddings import embed_query, embed_texts


def test_chunking_empty():
    assert chunk_text("") == []
    assert chunk_text("   \n  ") == []


def test_chunking_short_text_single_chunk():
    assert chunk_text("hello world") == ["hello world"]


def test_chunking_respects_size_and_overlap():
    text = " ".join(f"Sentence number {i} about science and research." for i in range(60))
    chunks = chunk_text(text, size=200, overlap=50)
    assert len(chunks) > 1
    for c in chunks:
        assert len(c) <= 210  # size + small sentence-boundary slack
        assert c.strip()
    # Overlap: consecutive chunks share some words
    assert len(set(chunks[0].split()) & set(chunks[1].split())) > 0
    # All content covered: every sentence appears in at least one chunk
    joined = " ".join(chunks)
    assert "Sentence number 0" in joined and "Sentence number 59" in joined


def test_chunking_sentence_aware():
    text = "First sentence here. Second sentence here. Third sentence here."
    chunks = chunk_text(text, size=25, overlap=0)
    assert chunks[0].startswith("First sentence")
    assert all(c.strip() for c in chunks)


def test_embedding_dims_and_normalisation():
    from app.services.embeddings.embeddings import embedding_mode

    vecs = embed_texts(["quantum computing", "photosynthesis in plants", ""])
    assert vecs.shape == (3, 384)
    assert vecs.dtype == np.float32
    assert np.all(np.isfinite(vecs))
    for v in vecs[:2]:
        assert abs(float(np.linalg.norm(v)) - 1.0) < 1e-5
    # Empty text: hash fallback yields a zero vector; the real MiniLM model
    # returns a valid (normalised) embedding for it.
    if embedding_mode() == "hash-fallback":
        assert float(np.linalg.norm(vecs[2])) == 0.0
    else:
        assert abs(float(np.linalg.norm(vecs[2])) - 1.0) < 1e-5


def test_embedding_deterministic():
    a = embed_query("deterministic test sentence")
    b = embed_query("deterministic test sentence")
    assert np.allclose(a, b)
    c = embed_query("a completely different sentence about cooking")
    assert not np.allclose(a, c)


def test_embedding_same_words_similar():
    q = embed_query("quantum computing qubits")
    same = embed_query("qubits and quantum computing research")
    other = embed_query("photosynthesis chlorophyll leaves sunlight")
    sim_same = float(q @ same)
    sim_other = float(q @ other)
    assert sim_same > sim_other


def test_concurrent_first_load_waits_for_model(monkeypatch):
    """Startup race (Fix 2 follow-up): two callers arriving during the slow
    first model load must both get the model — not a hash-fallback None.
    Uses a slow fake constructor so the test runs in ~1s; restores the real
    cached model afterwards so later tests are unaffected."""
    import threading
    import time

    import app.services.embeddings.embeddings as emb

    saved_model, saved_tried = emb._model, emb._model_tried
    built = []

    class SlowFake:
        def __init__(self, *args, **kwargs):
            time.sleep(0.5)
            built.append(1)

        def encode(self, texts, normalize_embeddings=True):
            return np.zeros((len(texts), 384), dtype=np.float32)

    monkeypatch.setattr("sentence_transformers.SentenceTransformer", SlowFake)
    emb._model, emb._model_tried = None, False
    try:
        results = []
        threads = [
            threading.Thread(target=lambda: results.append(emb._load_model()))
            for _ in range(4)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)
        assert len(built) == 1, "model must be constructed exactly once"
        assert all(r is not None for r in results)
        assert len({id(r) for r in results}) == 1, "all callers share one model"
        assert emb.embedding_mode() == "sentence-transformers"
    finally:
        emb._model, emb._model_tried = saved_model, saved_tried
