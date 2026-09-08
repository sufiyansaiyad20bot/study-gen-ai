/**
 * Study Gen AI â€” Documents (Upload + List + Delete)
 */

import {
  BookOpen,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Upload as UploadIcon,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import AppShell from "../components/AppShell";
import { documentsApi } from "../services/api";

const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

function formatBytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status) {
  const map = {
    ready: { color: "bg-green-100 text-success", label: "Ready" },
    processing: { color: "bg-yellow-100 text-warning", label: "Processing" },
    failed: { color: "bg-red-100 text-error", label: "Failed" },
    empty: { color: "bg-yellow-100 text-warning", label: "No text" },
  };
  const s = map[status] || { color: "bg-gray-100 text-muted", label: status };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await documentsApi.list();
      setDocs(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function pickFile(f) {
    setFile(f);
    setFeedback(null);
    setError("");
  }

  function onSelect(e) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }

  async function onUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setProgress(0);
    setFeedback(null);
    setError("");
    try {
      const doc = await documentsApi.upload(file, setProgress);
      setFeedback({ kind: "success", message: `Uploaded "${doc.filename}" successfully.` });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (err) {
      setFeedback({ kind: "error", message: err.message });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function onDelete(doc) {
    if (!confirm(`Delete "${doc.filename}"? This also removes it from your study index.`)) return;
    try {
      await documentsApi.remove(doc.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell
      title={() => "My Documents"}
      subtitle="Upload PDFs, DOCX, or TXT notes. Study Gen AI will read, index, and use them to answer questions."
    >
      {/* Upload card */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-semibold text-dark">Upload Study Material</h2>
        <p className="mt-1 text-sm text-secondary">Supported formats: PDF, DOCX, TXT (up to 20 MB).</p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-bg p-8 text-center"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-light text-pink">
            <UploadIcon size={22} />
          </div>
          <p className="text-sm text-dark">
            {file ? file.name : "Drag & drop a file here, or click to browse"}
          </p>
          {file && (
            <p className="mt-1 text-xs text-muted">{formatBytes(file.size)}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <label className="cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-dark transition hover:bg-bg">
              Choose File
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                onChange={onSelect}
                className="hidden"
              />
            </label>
            {file && (
              <button
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-secondary transition hover:bg-bg"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>Uploadingâ€¦</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
              <div
                className="h-full bg-pink transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              feedback.kind === "success"
                ? "border-green-200 bg-green-50 text-success"
                : "border-red-200 bg-red-50 text-error"
            }`}
          >
            {feedback.kind === "success" ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <X size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onUpload}
            disabled={!file || uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-pink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-pink-dark disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploadingâ€¦
              </>
            ) : (
              <>
                <UploadIcon size={16} />
                Upload
              </>
            )}
          </button>
        </div>
      </div>

      {/* Documents list */}
      <div className="rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-dark">Your Documents</h2>
          <button
            onClick={load}
            className="text-sm font-medium text-pink hover:underline"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-secondary">
            <Loader2 size={18} className="animate-spin" />
            Loading your documentsâ€¦
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-light text-pink">
              <BookOpen size={22} />
            </div>
            <p className="text-sm text-dark">No documents yet.</p>
            <p className="text-xs text-muted">
              Upload a study material above to start asking questions and generating quizzes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-light text-pink">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-dark">{d.filename}</span>
                      {statusBadge(d.status)}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {d.file_type.toUpperCase()} Â· {formatBytes(d.file_size)} Â·{" "}
                      {d.chunk_count} chunks Â· {new Date(d.created_at).toLocaleString()}
                    </div>
                    {d.error_message && (
                      <div className="mt-1 text-xs text-error">{d.error_message}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(d)}
                  className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-error hover:text-error sm:self-auto"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}