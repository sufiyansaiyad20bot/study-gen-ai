/**
 * Study Gen AI â€” Dashboard
 */

import { Bot, FileText, GraduationCap, Sparkles, Upload as UploadIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AppShell from "../components/AppShell";
import { documentsApi } from "../services/api";

const ACTIONS = [
  {
    to: "/chat",
    icon: Bot,
    title: "Ask Study Gen AI",
    description: "Chat with your study material",
    cta: "Start chatting",
  },
  {
    to: "/documents",
    icon: FileText,
    title: "Upload Material",
    description: "Add PDFs, DOCX, or TXT notes",
    cta: "Upload now",
  },
  {
    to: "/quiz",
    icon: GraduationCap,
    title: "Generate Quiz",
    description: "Test yourself on your notes",
    cta: "Take a quiz",
  },
  {
    to: "/revision",
    icon: Sparkles,
    title: "Revision Notes",
    description: "Create quick study summaries",
    cta: "Generate notes",
  },
];

function statusLabel(status) {
  if (status === "ready") return "Ready";
  if (status === "processing") return "Processing";
  if (status === "failed") return "Failed";
  if (status === "empty") return "No text";
  return status;
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function Dashboard() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    documentsApi
      .list()
      .then(setDocs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const readyCount = docs.filter((d) => d.status === "ready").length;
  const totalChunks = docs.reduce((acc, d) => acc + (d.chunk_count || 0), 0);
  const recent = docs.slice(0, 3);

  return (
    <AppShell
      title={(name) => `Welcome back, ${name} ðŸ‘‹`}
      subtitle="Here's an overview of your study workspace."
    >
      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Documents"
          value={loading ? "â€”" : docs.length}
          hint={loading ? "Loadingâ€¦" : `${readyCount} ready`}
          icon={FileText}
        />
        <StatCard
          label="Indexed chunks"
          value={loading ? "â€”" : totalChunks}
          hint="Across your documents"
          icon={UploadIcon}
        />
        <StatCard
          label="Quick start"
          value="4"
          hint="Chat Â· Upload Â· Quiz Â· Revision"
          icon={Sparkles}
        />
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Quick actions */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Quick Actions
      </h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.to}
              to={a.to}
              className="group rounded-2xl border border-border bg-card p-5 shadow-card transition hover:border-pink/40 hover:shadow-pop"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-pink-light text-pink transition group-hover:bg-pink group-hover:text-white">
                <Icon size={20} />
              </div>
              <h3 className="font-semibold text-dark">{a.title}</h3>
              <p className="mt-1 text-sm text-secondary">{a.description}</p>
              <div className="mt-3 text-xs font-medium text-pink opacity-0 transition group-hover:opacity-100">
                {a.cta} â†’
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent documents */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Recent Documents
      </h2>
      <div className="rounded-2xl border border-border bg-card shadow-card">
        {loading ? (
          <div className="p-6 text-sm text-secondary">Loadingâ€¦</div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-light text-pink">
              <FileText size={22} />
            </div>
            <p className="text-sm text-dark">No documents yet.</p>
            <p className="mt-1 text-xs text-muted">
              Upload your first study material to start using AI features.
            </p>
            <Link
              to="/documents"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-pink px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-dark"
            >
              <UploadIcon size={16} />
              Upload a document
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pink-light text-pink">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-dark">
                      {d.filename}
                    </div>
                    <div className="text-xs text-muted">
                      {d.file_type.toUpperCase()} Â· {d.chunk_count} chunks Â· {timeAgo(d.created_at)}
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-secondary">
                  {statusLabel(d.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-light text-pink">
          <Icon size={16} />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold text-dark">{value}</div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </div>
  );
}