"""Sentence-aware chunking.

Splits text into ~CHUNK_SIZE-char chunks with CHUNK_OVERLAP chars of
overlap, preferring sentence boundaries. Empty chunks are skipped.
"""
import re

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])")
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_sentences(text: str) -> list[str]:
    """Split on sentence-ending punctuation; fall back to line splits."""
    parts = _SENTENCE_RE.split(text.strip())
    sentences: list[str] = []
    for part in parts:
        # Very long "sentences" (e.g. no punctuation) split on newlines.
        if len(part) > 800:
            sentences.extend(p for p in part.split("\n") if p.strip())
        elif part.strip():
            sentences.append(part.strip())
    return sentences


def chunk_text(text: str, size: int = 1000, overlap: int = 200) -> list[str]:
    """Return sentence-aware chunks of at most ~`size` chars.

    Overlap is achieved by carrying the tail of the previous chunk (up to
    `overlap` chars, cut at a sentence boundary when possible) into the
    next chunk.
    """
    text = normalize_text(text)
    if not text:
        return []
    if len(text) <= size:
        return [text]

    sentences = split_sentences(text)
    if not sentences:
        return []

    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current} {sentence}".strip() if current else sentence
        if len(candidate) <= size:
            current = candidate
            continue
        # Flush current chunk.
        if current.strip():
            chunks.append(current.strip())
        # Overlap: carry the tail of the flushed chunk forward.
        if overlap > 0 and current:
            tail = current[-overlap:]
            # Cut tail at a sentence boundary if one is nearby.
            m = re.search(r"[.!?]\s+", tail)
            if m:
                tail = tail[m.end():].strip()
            current = f"{tail} {sentence}".strip() if tail else sentence
        else:
            current = sentence
        # A single sentence longer than `size`: hard-split it.
        while len(current) > size:
            chunks.append(current[:size].strip())
            current = current[size - overlap:].strip() if overlap else current[size:].strip()
    if current.strip():
        chunks.append(current.strip())
    return [c for c in chunks if c.strip()]
