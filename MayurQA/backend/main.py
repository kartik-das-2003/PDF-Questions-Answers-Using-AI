from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
import uuid

from pdf_processor import process_pdf, query_documents, get_uploaded_files, delete_document

app = FastAPI(title="DocQA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "../uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class QueryRequest(BaseModel):
    question: str
    doc_ids: list[str] = []  # empty = search all


class DeleteRequest(BaseModel):
    doc_id: str


@app.get("/")
def root():
    return {"status": "DocQA backend running"}


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    doc_id = str(uuid.uuid4())
    save_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")

    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        chunk_count = process_pdf(save_path, doc_id, file.filename)
        return {
            "doc_id": doc_id,
            "filename": file.filename,
            "chunks": chunk_count,
            "message": "PDF processed successfully!"
        }
    except Exception as e:
        os.remove(save_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
async def query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        result = query_documents(req.question, req.doc_ids)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents")
def list_documents():
    return {"documents": get_uploaded_files()}


@app.post("/delete")
def delete_doc(req: DeleteRequest):
    success = delete_document(req.doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"message": "Document deleted successfully."}