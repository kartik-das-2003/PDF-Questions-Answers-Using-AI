"""
PDF Processor — handles:
  1. Text extraction from PDFs (via PyMuPDF)
  2. Chunking the text
  3. Embedding chunks (via Ollama nomic-embed-text)
  4. Storing in ChromaDB
  5. Querying: retrieve relevant chunks → pass to Ollama LLM → return answer
"""

import os
import json
import fitz  # PyMuPDF
import chromadb
import requests

CHROMA_DIR = "../vectorstore"
METADATA_FILE = "../uploads/metadata.json"
OLLAMA_BASE = "http://localhost:11434"
EMBED_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3.2"

chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
collection = chroma_client.get_or_create_collection("documents")


# ── Metadata helpers ──────────────────────────────────────────────────────────

def load_metadata() -> dict:
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE) as f:
            return json.load(f)
    return {}


def save_metadata(meta: dict):
    with open(METADATA_FILE, "w") as f:
        json.dump(meta, f, indent=2)


def get_uploaded_files() -> list:
    meta = load_metadata()
    return [{"doc_id": k, **v} for k, v in meta.items()]


# ── PDF → Chunks ──────────────────────────────────────────────────────────────

def extract_text_from_pdf(path: str) -> str:
    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def chunk_text(text: str, chunk_size: int = 300, overlap: int = 60) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


# ── Ollama helpers ────────────────────────────────────────────────────────────

def get_embedding(text: str) -> list[float]:
    resp = requests.post(
        f"{OLLAMA_BASE}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]


def ask_llm(prompt: str) -> str:
    resp = requests.post(
        f"{OLLAMA_BASE}/api/generate",
        json={"model": LLM_MODEL, "prompt": prompt, "stream": False},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["response"]


# ── Core operations ───────────────────────────────────────────────────────────

def process_pdf(path: str, doc_id: str, filename: str) -> int:
    """Extract, chunk, embed, and store a PDF. Returns chunk count."""
    text = extract_text_from_pdf(path)
    if not text.strip():
        raise ValueError("Could not extract any text from this PDF.")

    chunks = chunk_text(text)

    ids, embeddings, documents, metadatas = [], [], [], []
    for i, chunk in enumerate(chunks):
        emb = get_embedding(chunk)
        ids.append(f"{doc_id}_chunk_{i}")
        embeddings.append(emb)
        documents.append(chunk)
        metadatas.append({"doc_id": doc_id, "filename": filename, "chunk_index": i})

    collection.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)

    meta = load_metadata()
    meta[doc_id] = {"filename": filename, "chunks": len(chunks)}
    save_metadata(meta)

    return len(chunks)


def query_documents(question: str, doc_ids: list[str] = []) -> dict:
    """Retrieve relevant chunks, build prompt, ask LLM, return answer + sources."""
    q_emb = get_embedding(question)

    where_filter = {"doc_id": {"$in": doc_ids}} if doc_ids else None

    results = collection.query(
        query_embeddings=[q_emb],
        n_results=5,
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    chunks = results["documents"][0]
    metas = results["metadatas"][0]
    distances = results["distances"][0]

    if not chunks:
        return {"answer": "No relevant content found in the uploaded documents.", "sources": []}

    context = "\n\n".join([f"[Source: {m['filename']}, chunk {m['chunk_index']}]\n{c}"
                           for c, m in zip(chunks, metas)])

    prompt = f"""You are a helpful document assistant. Answer the user's question using ONLY the context below.
If the answer is not in the context, say "I couldn't find that in the uploaded documents."
Always mention which document/section your answer comes from.

Context:
{context}

Question: {question}

Answer:"""

    answer = ask_llm(prompt)

    sources = []
    seen = set()
    for m, d in zip(metas, distances):
        key = f"{m['doc_id']}_{m['chunk_index']}"
        if key not in seen:
            seen.add(key)
            sources.append({
                "filename": m["filename"],
                "chunk_index": m["chunk_index"],
                "relevance": round(1 - d, 3),
            })

    return {"answer": answer.strip(), "sources": sources}


def delete_document(doc_id: str) -> bool:
    meta = load_metadata()
    if doc_id not in meta:
        return False

    # Remove all chunks from ChromaDB
    all_ids = collection.get(where={"doc_id": doc_id})["ids"]
    if all_ids:
        collection.delete(ids=all_ids)

    # Remove PDF file
    pdf_path = f"../uploads/{doc_id}.pdf"
    if os.path.exists(pdf_path):
        os.remove(pdf_path)

    del meta[doc_id]
    save_metadata(meta)
    return True