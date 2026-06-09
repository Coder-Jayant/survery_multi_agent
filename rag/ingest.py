"""
rag/ingest.py
--------------
Ingests the GreenLeaf Bistro FAQ document into a FAISS vector store.

Chunking Strategy: Sentence-aware with Q&A block preservation
--------------------------------------------------------------
The FAQ is structured as discrete Q&A blocks. We first split on Q:/A: boundaries
to keep each question paired with its answer (semantically coherent unit), then
apply sentence-level splitting within blocks that exceed the token target.

Justification:
- Fixed-size chunking risks splitting a question from its answer mid-sentence
- Sentence-aware preserves complete thought units while staying under token limits
- Semantic chunking (embedding-based) is overkill for a ~500-word document
- This approach produces chunks that directly map to user query intents

Embedding model: sentence-transformers/all-MiniLM-L6-v2
- Free and local (no API cost)
- 384-dim embeddings, fast inference
- Strong performance on retrieval benchmarks for short passages

Run:
    python rag/ingest.py
"""

import os
import re
import json
import pickle

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

# ------------------------------------------------------------------------------
# Paths
# ------------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAQ_PATH = os.path.join(BASE_DIR, "data", "faq_document.txt")
STORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vector_store")
INDEX_PATH = os.path.join(STORE_DIR, "faq_index.faiss")
META_PATH  = os.path.join(STORE_DIR, "faq_meta.pkl")

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
MAX_TOKENS_PER_CHUNK = 150  # approximate token budget per chunk


# ------------------------------------------------------------------------------
# Chunking
# ------------------------------------------------------------------------------

def load_faq(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def split_into_qa_blocks(text: str) -> list[str]:
    """
    Split FAQ text into Q&A blocks.
    A block starts at a line beginning with 'Q:' and ends before the next 'Q:' or EOF.
    The preamble (About Us section) is kept as its own block.
    """
    # Normalize line endings
    text = text.replace("\r\n", "\n").strip()

    # Split on lines that start with 'Q:' (keeping the delimiter)
    qa_pattern = re.compile(r"(?=^Q:)", re.MULTILINE)
    parts = qa_pattern.split(text)

    blocks = []
    for part in parts:
        part = part.strip()
        if part:
            blocks.append(part)

    return blocks


def sentence_split(text: str) -> list[str]:
    """Simple sentence splitter on '.', '?', '!' boundaries."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def approximate_tokens(text: str) -> int:
    """Rough token count: words * 1.3 (conservative estimate)."""
    return int(len(text.split()) * 1.3)


def chunk_block(block: str, max_tokens: int = MAX_TOKENS_PER_CHUNK) -> list[str]:
    """
    If a block is within the token budget, keep it whole.
    Otherwise, split into sentences and group into sub-chunks.
    """
    if approximate_tokens(block) <= max_tokens:
        return [block]

    sentences = sentence_split(block)
    chunks = []
    current = []
    current_tokens = 0

    for sent in sentences:
        sent_tokens = approximate_tokens(sent)
        if current_tokens + sent_tokens > max_tokens and current:
            chunks.append(" ".join(current))
            current = [sent]
            current_tokens = sent_tokens
        else:
            current.append(sent)
            current_tokens += sent_tokens

    if current:
        chunks.append(" ".join(current))

    return chunks


def build_chunks(faq_text: str) -> list[dict]:
    """
    Full chunking pipeline: FAQ text -> list of chunk dicts with metadata.
    """
    qa_blocks = split_into_qa_blocks(faq_text)
    chunks = []
    chunk_id = 0

    for block_idx, block in enumerate(qa_blocks):
        sub_chunks = chunk_block(block)
        for sub in sub_chunks:
            chunks.append({
                "chunk_id": f"chunk_{chunk_id:03d}",
                "block_index": block_idx,
                "text": sub,
                "source": "faq_document.txt",
                "approx_tokens": approximate_tokens(sub),
            })
            chunk_id += 1

    return chunks


# ------------------------------------------------------------------------------
# Embedding + FAISS indexing
# ------------------------------------------------------------------------------

def build_index(chunks: list[dict], model: SentenceTransformer) -> faiss.Index:
    texts = [c["text"] for c in chunks]
    print(f"  Embedding {len(texts)} chunks...")
    embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
    embeddings = embeddings.astype(np.float32)

    # Normalize for cosine similarity (inner product on normalized = cosine)
    faiss.normalize_L2(embeddings)

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # Inner product (cosine after L2 norm)
    index.add(embeddings)
    return index


def main():
    os.makedirs(STORE_DIR, exist_ok=True)

    print("📄 Loading FAQ document...")
    faq_text = load_faq(FAQ_PATH)

    print("✂️  Chunking document...")
    chunks = build_chunks(faq_text)
    print(f"   Produced {len(chunks)} chunks")
    for c in chunks:
        print(f"   [{c['chunk_id']}] ~{c['approx_tokens']} tokens: {c['text'][:60]}...")

    print("\n🤖 Loading embedding model...")
    model = SentenceTransformer(MODEL_NAME)

    print("\n📊 Building FAISS index...")
    index = build_index(chunks, model)

    print(f"\n💾 Saving index -> {INDEX_PATH}")
    faiss.write_index(index, INDEX_PATH)

    print(f"💾 Saving metadata -> {META_PATH}")
    with open(META_PATH, "wb") as f:
        pickle.dump(chunks, f)

    print(f"\n[OK] Ingestion complete! {len(chunks)} chunks indexed.")


if __name__ == "__main__":
    main()
