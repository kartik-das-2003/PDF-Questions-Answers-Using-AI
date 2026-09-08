# 📄 MayurQA — Chat with your PDFs

> A MayurQA web application that lets you upload PDF documents and ask questions about them using a **fully local AI** — no API keys, no internet, no cost.

---

## 📚 Table of Contents

1. [What This Project Does](#what-this-project-does)
2. [How It Works — The RAG Pipeline](#how-it-works)
3. [Tech Stack](#tech-stack)
4. [System Requirements](#system-requirements)
5. [Project Structure](#project-structure)
6. [Complete Setup Guide (PyCharm)](#complete-setup-guide)
7. [Running the App](#running-the-app)
8. [Using the App](#using-the-app)
9. [API Reference](#api-reference)
10. [Configuration & Customization](#configuration--customization)
11. [Troubleshooting](#troubleshooting)
12. [How Each File Works](#how-each-file-works)
13. [Key Concepts for Interviews](#key-concepts-for-interviews)
14. [Future Improvements](#future-improvements)

---

## What This Project Does

MayurQA is an **AI-powered document question-answering system**. You upload any PDF (research papers, textbooks, reports, manuals) and then chat with it — asking questions in plain English and getting accurate answers with citations showing exactly which part of the document the answer came from.

**Example:**
- Upload a 50-page research paper
- Ask: *"What methodology did the authors use?"*
- Get: A precise answer + the exact chunk of the paper it came from

This is exactly the kind of system used in enterprise tools like Notion AI, Adobe Acrobat AI, and ChatPDF.

---

## How It Works

This app uses a technique called **RAG — Retrieval-Augmented Generation**. Here is the full pipeline:

```
[0] PDF Upload
    │
    ▼
[1] Text Extraction       ← PyMuPDF reads raw text from each page
    │
    ▼
[2] Chunking              ← Text is split into ~500-word overlapping chunks
    │
    ▼
[3] Embedding             ← Each chunk is converted into a vector (list of numbers)
    │                        using Ollama's nomic-embed-text model
    ▼
[4] Storage               ← Vectors + text stored in ChromaDB (local vector database)
    │
    ▼
    |┌──────────────────────────────────┐
    │|       User asks a question       │
    |└──────────────────────────────────┘
    │
    ▼
[5] Query Embedding       ← The question is also converted to a vector
    │
    ▼
[6] Similarity Search     ← ChromaDB finds the 5 most similar chunks
    │
    ▼
[7] Prompt Building       ← The question + retrieved chunks are combined into a prompt
    │
    ▼
[8] LLM Generation        ← Ollama's llama3.2 reads the prompt and writes an answer
    │
    ▼
[9] Response + Sources    ← Answer is shown in the chat with source citations
```

**Why RAG?** A PDF can have thousands of pages — too long to fit in an LLM's context window. RAG solves this by only feeding the LLM the *relevant* chunks, not the whole document.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **LLM** | Ollama + llama3.2 | Generates answers from retrieved context |
| **Embeddings** | Ollama + nomic-embed-text | Converts text to vectors |
| **Vector DB** | ChromaDB | Stores and searches embeddings |
| **PDF Reading** | PyMuPDF (fitz) | Extracts text from PDF pages |
| **Backend API** | FastAPI + Uvicorn | REST API server |
| **Frontend** | Plain HTML/CSS/JS | Chat UI (no framework needed) |

Everything runs **100% locally** on your machine.

---

## System Requirements

| Requirement | Minimum | Recommended | My Setup
|---|---|---|---|
| OS | Windows 10 / macOS 12 / Ubuntu 20.04 | Latest version | Windows 11
| RAM | 8 GB | 16 GB | 16 GB
| Storage | 5 GB free (for models) | 10 GB | ~3 GB for Lamma Model & ~1.5 GB for additional files
| Python | 3.10+ | 3.11 | 3.11.9
| GPU | Not required | NVIDIA GPU speeds things up | Integrated Intel Iris Graphics

> ⚠️ **RAM note:** llama3.2 (3B) needs ~4GB RAM. If you have less, use `mistral` (4GB) or `phi3` (2GB) instead.

---

## Project Structure

```
MayurQA/
│
├── backend/
│   ├── main.py              ← FastAPI app — defines all API endpoints
│   └── pdf_processor.py     ← Core RAG logic: extract, chunk, embed, query
│
├── frontend/                ← Complete chat UI — open this in your browser
│   └── index.html           
|   └── styles.css
|   └── script.js    
│
├── uploads/                 ← PDFs saved here after upload (auto-created)
│   └── metadata.json        ← Tracks doc_id → filename mapping
│
├── vectorstore/             ← ChromaDB database files (auto-created)
│
├── requirements.txt         ← All Python packages needed
└── README.md                ← This file
```

---

## Complete Setup Guide

Follow these steps **in order**. Don't skip any step.

---

### Step 1 — Install Python 3.11

1. Go to https://python.org/downloads
2. Download Python **3.11** (not 3.12+ — some packages have compatibility issues)
3. During install on Windows: ✅ check **"Add Python to PATH"**
4. Verify in a terminal:
   ```bash
   python --version
   # Should print: Python 3.11.x
   ```

---

### Step 2 — Install Ollama

Ollama is what runs the AI models locally on your machine.

1. Go to https://ollama.com and click **Download**
2. Install it (it works like a normal app)
3. After install, **Ollama runs in the background** (check your system tray / menu bar)
4. Open a terminal and pull the two models this project needs:

```bash
# The LLM that generates answers (~2GB download)
ollama pull llama3.2

# The embedding model that converts text to vectors (~270MB)
ollama pull nomic-embed-text
```

5. Test that Ollama works:
```bash
ollama run llama3.2
# Type: "Hello, are you working?"
# You should get a response. Press Ctrl+D to exit.
```

---

### Step 3 — Open Project in PyCharm

1. Open **PyCharm** (download Community Edition free from https://jetbrains.com/pycharm if needed)
2. Click **"Open"** and select the `MayurQA/` folder
3. PyCharm will detect it as a Python project

---

### Step 4 — Create a Virtual Environment

A virtual environment keeps this project's packages separate from your system Python.

1. In PyCharm: go to **File → Settings → Project: MayurQA → Python Interpreter**
2. Click the gear icon ⚙️ → **"Add Interpreter"** → **"Add Local Interpreter"**
3. Select **"Virtualenv Environment"** → **"New environment"**
4. Leave the location as default (usually `MayurQA/venv/`)
5. Click **OK**

Alternatively, in the PyCharm terminal:
```bash
python -m venv venv

# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate

# You should see (venv) in your terminal prompt
```

---

### Step 5 — Install Dependencies

In the PyCharm terminal (make sure your venv is active — you should see `(venv)`):

```bash
pip install -r requirements.txt
```

This installs:
- `fastapi` — the web framework for the backend API
- `uvicorn` — the server that runs FastAPI
- `python-multipart` — allows FastAPI to receive file uploads
- `pymupdf` — reads and extracts text from PDFs
- `chromadb` — the local vector database
- `requests` — for calling the Ollama API
- `pydantic` — data validation

Installation takes 2–5 minutes. You'll see a lot of output — that's normal.

Verify it worked:
```bash
python -c "import fastapi, fitz, chromadb; print('All packages OK!')"
```

---

## Running the App

You need **two things running** at the same time:

### Terminal 1 — Start the Backend

```bash
# Make sure you're in the MayurQA/ folder and venv is active
cd backend
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

The `--reload` flag means the server auto-restarts when you edit code — very useful during development.

### Open the Frontend

Open `frontend/index.html` in your browser:
- **Windows:** double-click the file, or drag it into Chrome
- **macOS:** right-click → Open With → Chrome/Firefox
- **Or:** in PyCharm, right-click `index.html` → Open In → Browser

> ✅ You should see the MayurQA chat interface. The app is now running!

---

## Using the App

### Uploading a PDF
1. Click the **upload area** in the left sidebar (or drag & drop a PDF onto it)
2. Wait for the green confirmation: *"✓ filename.pdf — 42 chunks indexed"*
3. The document appears in the sidebar as a card

### Asking Questions
1. Type your question in the input box at the bottom
2. Press **Enter** to send (or Shift+Enter for a new line)
3. The AI will think for a few seconds and reply
4. Below each answer you'll see **source tags** showing which document and chunk the answer came from

### Filtering by Document
- Click a document card in the sidebar to **select it** (turns purple)
- The AI will only search that document
- Click again to deselect — now it searches all documents
- You can select multiple documents at once

### Deleting Documents
- Click the 🗑 icon on any document card to remove it
- This deletes both the PDF file and its embeddings from the database

---

## API Reference

The backend exposes these REST endpoints at `http://localhost:8000`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/upload` | Upload a PDF file |
| `POST` | `/query` | Ask a question |
| `GET` | `/documents` | List all uploaded documents |
| `POST` | `/delete` | Delete a document |

### POST /upload
```
Content-Type: multipart/form-data
Body: file (PDF)

Response:
{
  "doc_id": "uuid-string",
  "filename": "paper.pdf",
  "chunks": 47,
  "message": "PDF processed successfully!"
}
```

### POST /query
```json
Request:
{
  "question": "What is the main finding of this paper?",
  "doc_ids": []   // empty = search all documents
}

Response:
{
  "answer": "The main finding is...",
  "sources": [
    { "filename": "paper.pdf", "chunk_index": 12, "relevance": 0.87 }
  ]
}
```

You can test these in your browser at: **http://localhost:8000/docs** (FastAPI gives you a free interactive API explorer!)

---

## Configuration & Customization

Open `backend/pdf_processor.py` to change these settings:

```python
# Change the LLM model
LLM_MODEL = "llama3.2"       # Options: "mistral", "phi3", "llama3.1"

# Change the embedding model
EMBED_MODEL = "nomic-embed-text"

# Change chunk size (words per chunk)
# Larger = more context per chunk, but slower
chunk_text(text, chunk_size=300, overlap=60)

# Change how many chunks to retrieve per query
n_results=5   # in the query_documents function
```

**Available Ollama models to try:**

| Model | Size | Speed | Quality |
|---|---|---|---|
| `llama3.2` | 2GB | Fast | Good |
| `mistral` | 4GB | Medium | Better |
| `llama3.1:8b` | 5GB | Slow | Best |
| `phi3` | 2GB | Fastest | Decent |

---

## Troubleshooting

### "Connection refused" when uploading
- The backend is not running. Start it: `uvicorn main:app --reload --port 8000`
- Make sure you're in the `backend/` folder when running it

### First response takes very long (30–60 seconds)
- Normal! Ollama loads the model into RAM the first time. Subsequent questions are faster.

### "Failed to get embeddings" error
- Ollama is not running. Open the Ollama app from your Applications/Start menu
- Verify: `curl http://localhost:11434` should return `Ollama is running`

### Empty or "I couldn't find that" answers
- The question might not match the document content well — try rephrasing
- Test your LLM works: `ollama run llama3.2` in terminal

### PyMuPDF install fails
```bash
pip install --upgrade pip
pip install pymupdf
```

### ChromaDB errors on Windows
```bash
pip install chromadb --pre
```

### Port 8000 already in use
```bash
uvicorn main:app --reload --port 8001
# Then update the API URL in frontend/index.html:
# const API = "http://localhost:8001";
```

---

## How Each File Works

### `backend/main.py`
Defines the FastAPI web server with 4 endpoints. Think of it as the "receptionist" — it receives requests from the frontend, calls the right function in `pdf_processor.py`, and sends back responses. Uses `CORSMiddleware` so the browser-based frontend can talk to it.

### `backend/pdf_processor.py`
The brain of the app. Contains:
- `extract_text_from_pdf()` — uses PyMuPDF to read each page
- `chunk_text()` — splits text into overlapping windows so context isn't lost at boundaries
- `get_embedding()` — calls Ollama's embedding API to vectorize text
- `process_pdf()` — orchestrates the full upload pipeline
- `query_documents()` — takes a question, finds relevant chunks, builds a prompt, calls the LLM, returns the answer
- `delete_document()` — removes chunks from ChromaDB and deletes the PDF file

### `frontend/index.html`
A single-file web app (HTML + CSS + JavaScript). Communicates with the backend using `fetch()` API calls. No external libraries or frameworks — pure vanilla web tech, so it's easy to understand and modify.

### `requirements.txt`
Lists all Python packages with pinned versions so the project works the same on any machine.

---

## Key Concepts for Interviews

These are the terms you should know if asked about this project:

**RAG (Retrieval-Augmented Generation)**
Instead of relying purely on the LLM's training data, we retrieve relevant context from our own documents and feed it into the prompt. This makes answers accurate, current, and attributable.

**Embeddings**
A way of representing text as a list of numbers (a vector) where similar meanings result in similar vectors. "cat" and "kitten" will have vectors that are mathematically close together.

**Vector Database (ChromaDB)**
A special database optimized for storing and searching vectors. Instead of exact matching (like SQL), it finds the *most similar* vectors — which corresponds to the *most semantically relevant* text chunks.

**Chunking**
PDFs can be huge. We split them into ~500-word chunks because: (a) LLMs have limited context windows, and (b) smaller pieces make retrieval more precise. Overlapping chunks (`overlap=100`) prevent losing context at chunk boundaries.

**Local LLM (Ollama)**
Running the AI model on your own machine instead of calling a cloud API. Advantages: free, private, works offline. Disadvantage: slower and less powerful than GPT-4.

**FastAPI**
A modern Python web framework for building REST APIs. Much faster to write than Flask, and automatically generates interactive documentation at `/docs`.

---

## Future Improvements

Here are features you could add to make this project even more impressive:

- [ ] **Multi-format support** — accept .docx, .txt, .pptx files, not just PDFs
- [ ] **Conversation memory** — remember previous questions in the same session
- [ ] **Streaming responses** — show the answer word-by-word as it's generated (like ChatGPT)
- [ ] **Better chunking** — split by paragraphs/sections instead of word count
- [ ] **Highlighted sources** — show the exact sentence in the PDF that answered the question
- [ ] **Login system** — each user gets their own document library
- [ ] **Docker setup** — one command to run the whole app anywhere
- [ ] **Re-ranking** — use a second model to re-score retrieved chunks for better accuracy

---
