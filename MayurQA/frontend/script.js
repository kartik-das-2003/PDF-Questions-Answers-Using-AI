const API = "http://localhost:8000";
let selectedDocs = new Set();
let isLoading = false;
let typingCount = 0;

const $ = (selector) => document.querySelector(selector);
const chat = $("#chat");
const questionInput = $("#question");
const sendButton = $("#send-btn");
const dropZone = $("#drop-zone");
const fileInput = $("#file-input");

window.addEventListener("DOMContentLoaded", () => {
  loadDocuments();
  setupUploadInteractions();
  setupChatInteractions();
  setupMobileMenu();
  autoResizeQuestion();
});

function setupUploadInteractions() {
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") fileInput.click();
  });
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
    uploadFiles([...event.dataTransfer.files]);
  });
  fileInput.addEventListener("change", () => uploadFiles([...fileInput.files]));
}

function setupChatInteractions() {
  sendButton.addEventListener("click", sendQuestion);
  $("#clear-button").addEventListener("click", clearChat);
  document.querySelectorAll(".suggestion-chip").forEach((chip) => {
    chip.addEventListener("click", () => useSuggestion(chip));
  });
}

function setupMobileMenu() {
  $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.addEventListener("click", (event) => {
    const sidebar = $("#sidebar");
    if (window.innerWidth <= 760 && sidebar.classList.contains("open") && !sidebar.contains(event.target) && event.target.id !== "mobile-menu") {
      sidebar.classList.remove("open");
    }
  });
}

async function uploadFiles(files) {
  const pdfs = files.filter((file) => file.name.toLowerCase().endsWith(".pdf"));
  if (!pdfs.length) {
    addUploadRow(null, "error", "⚠️ Only PDF files supported");
    return;
  }

  const rows = pdfs.map(f => addUploadRow(f.name));

  const fd = new FormData();
  pdfs.forEach(f => fd.append("files", f));

  rows.forEach(r => {
    r.querySelector(".ustat").textContent = "⏳";
    r.querySelector(".uprogress-bar").style.width = "40%";
  });

  try {
    const response = await fetch(`${API}/upload`, { method: "POST", body: fd });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Upload failed");

    data.results.forEach((result, i) => {
      const row = rows[i];
      if (!row) return;
      row.querySelector(".uprogress-bar").style.width = "100%";
      if (result.success) {
        row.classList.add("urow-success");
        row.querySelector(".ustat").textContent = "✅";
        row.querySelector(".umeta").textContent = `${result.chunks} chunks indexed`;
      } else {
        row.classList.add("urow-error");
        row.querySelector(".ustat").textContent = "❌";
        row.querySelector(".umeta").textContent = result.error || "Failed";
      }
    });

    await loadDocuments();
    setTimeout(() => {
      document.querySelectorAll(".urow-success").forEach(r => r.remove());
    }, 5000);

  } catch (error) {
    rows.forEach(r => {
      r.classList.add("urow-error");
      r.querySelector(".ustat").textContent = "❌";
      r.querySelector(".umeta").textContent = error.message;
      r.querySelector(".uprogress-bar").style.width = "100%";
    });
  }

  fileInput.value = "";
}

function addUploadRow(filename, state, overrideText = null) {
  const container = $("#upload-status");
  const row = document.createElement("div");
  row.className = "upload-row";
  if (!filename) row.classList.add("urow-error");

  row.innerHTML = `
    <div class="urow-top">
      <span class="ufile">${escapeHtml(filename || overrideText || "")}</span>
      <span class="ustat">${filename ? "📄" : overrideText}</span>
    </div>
    <div class="umeta">${filename ? "Queued…" : ""}</div>
    <div class="uprogress"><div class="uprogress-bar" style="width:${filename ? "10%" : "0"}"></div></div>
  `;

  container.appendChild(row);
  if (!filename) setTimeout(() => row.remove(), 3000);
  return row;
}
async function loadDocuments() {
  try {
    const response = await fetch(`${API}/documents`);
    const data = await response.json();
    renderDocList(data.documents || []);
  } catch {
    renderDocList([]);
  }
}

function renderDocList(documents) {
  const list = $("#doc-list");
  $("#doc-count").textContent = documents.length;

  if (!documents.length) {
    list.innerHTML = `<div class="empty-library"><div class="empty-icon">▧</div><p>No documents yet</p><span>Upload a PDF to get started.</span></div>`;
    updateScopeHint();
    return;
  }

  list.innerHTML = documents.map((document) => `
    <div class="doc-card ${selectedDocs.has(document.doc_id) ? "selected" : ""}" data-doc-id="${escapeHtml(document.doc_id)}" role="button" tabindex="0">
      <div class="doc-icon">▤</div>
      <div class="doc-info">
        <div class="doc-name" title="${escapeHtml(document.filename)}">${escapeHtml(document.filename)}</div>
        <div class="doc-meta">${Number(document.chunks) || 0} indexed chunks</div>
      </div>
      <button class="doc-delete" type="button" aria-label="Delete ${escapeHtml(document.filename)}" title="Delete document">×</button>
    </div>
  `).join("");

  list.querySelectorAll(".doc-card").forEach((card) => {
    const id = card.dataset.docId;
    card.addEventListener("click", () => toggleDoc(id, card));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleDoc(id, card);
      }
    });
    card.querySelector(".doc-delete").addEventListener("click", (event) => deleteDoc(event, id));
  });
  updateScopeHint();
}

function toggleDoc(id, card) {
  if (selectedDocs.has(id)) {
    selectedDocs.delete(id);
    card.classList.remove("selected");
  } else {
    selectedDocs.add(id);
    card.classList.add("selected");
  }
  updateScopeHint();
}

function updateScopeHint() {
  $("#scope-hint").textContent = selectedDocs.size
    ? `Searching ${selectedDocs.size} selected document${selectedDocs.size === 1 ? "" : "s"}`
    : "Search across your entire library";
}

async function deleteDoc(event, id) {
  event.stopPropagation();
  if (!window.confirm("Delete this document?")) return;
  try {
    const response = await fetch(`${API}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_id: id }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Delete failed");
    }
    selectedDocs.delete(id);
    await loadDocuments();
  } catch (error) {
    window.alert(`Failed to delete: ${error.message}`);
  }
}

function useSuggestion(element) {
  questionInput.value = element.textContent;
  questionInput.dispatchEvent(new Event("input"));
  sendQuestion();
}

async function sendQuestion() {
  if (isLoading) return;
  const question = questionInput.value.trim();
  if (!question) return;

  questionInput.value = "";
  questionInput.style.height = "24px";
  hideWelcome();
  isLoading = true;
  sendButton.disabled = true;
  appendMessage("user", question);
  const typingId = appendTyping();

  try {
    const response = await fetch(`${API}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, doc_ids: [...selectedDocs] }),
    });
    const data = await response.json();
    removeTyping(typingId);
    if (!response.ok) throw new Error(data.detail || "Unable to answer this question");
    appendAIMessage(data.answer || "No answer was returned.", data.sources || []);
  } catch (error) {
    removeTyping(typingId);
    appendAIMessage(`⚠ ${error.message}`, []);
  } finally {
    isLoading = false;
    sendButton.disabled = false;
    questionInput.focus();
  }
}

function hideWelcome() {
  $("#welcome")?.remove();
}

function appendMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.innerHTML = `<div class="avatar">${role === "user" ? "?" : "✦"}</div><div class="bubble">${formatText(text)}</div>`;
  chat.appendChild(message);
  scrollChatToBottom();
  return message;
}

function appendAIMessage(text, sources = []) {
  const message = document.createElement("div");
  message.className = "message ai";
  const sourcesHtml = sources.length ? `<div class="sources">${sources.map((source) => `
    <div class="source-tag">▤ ${escapeHtml(source.filename)} · chunk ${escapeHtml(String(source.chunk_index))}<span class="rel">${Math.round(Number(source.relevance || 0) * 100)}%</span></div>
  `).join("")}</div>` : "";
  message.innerHTML = `<div class="avatar">✦</div><div class="bubble">${formatText(text)}${sourcesHtml}</div>`;
  chat.appendChild(message);
  scrollChatToBottom();
}

function appendTyping() {
  const id = `typing-${++typingCount}`;
  const message = document.createElement("div");
  message.className = "message ai";
  message.id = id;
  message.innerHTML = `<div class="avatar">✦</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  chat.appendChild(message);
  scrollChatToBottom();
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

function clearChat() {
  chat.innerHTML = `
    <div id="welcome" class="welcome-state">
      <div class="welcome-orbit"><div class="welcome-icon">✦</div></div>
      <div class="welcome-kicker">WELCOME TO MayurQA</div>
      <h2>Turn pages into answers.</h2>
        <p>Upload one or more PDFs, then ask questions in plain English. <br/>MayurQA retrieves relevant passages to provide accurate answers.</p>      <div class="suggestions" aria-label="Suggested questions">
        <button class="suggestion-chip" type="button">Summarize this document</button>
        <button class="suggestion-chip" type="button">What are the key points?</button>
        <button class="suggestion-chip" type="button">List all important dates</button>
        <button class="suggestion-chip" type="button">What is the main conclusion?</button>
      </div>
    </div>`;
  chat.querySelectorAll(".suggestion-chip").forEach((chip) => chip.addEventListener("click", () => useSuggestion(chip)));
}

function autoResizeQuestion() {
  questionInput.addEventListener("input", () => {
    questionInput.style.height = "24px";
    questionInput.style.height = `${Math.min(questionInput.scrollHeight, 150)}px`;
  });
  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendQuestion();
    }
  });
}

function scrollChatToBottom() {
  chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
}

function formatText(text) {
  return escapeHtml(String(text)).replace(/\n/g, "<br>");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
