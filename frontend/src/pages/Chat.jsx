/**
 * Study Gen AI â€” Chat (RAG-powered Q&A)
 */

import { Bot, FileText, Loader2, Send, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import AppShell from "../components/AppShell";
import { chatApi, documentsApi } from "../services/api";

export default function Chat() {
  const [docs, setDocs] = useState([]);
  const [docId, setDocId] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! Ask me anything about your uploaded study material. I'll answer using your notes and cite the source.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    documentsApi
      .list()
      .then((d) => setDocs(d.filter((x) => x.status === "ready")))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (docs.length === 0) {
      setError("You need to upload a study material first.");
      return;
    }
    setError("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const payload = { question: text };
      if (docId) payload.document_id = Number(docId);
      const res = await chatApi.ask(payload);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.answer,
          sources: res.sources || [],
          grounded: res.grounded,
        },
      ]);
    } catch (err) {
      const fallback =
        "The AI service is temporarily unavailable. Your uploaded study material and RAG retrieval are still working — please try again in a moment.";
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err.message || fallback, sources: [] },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      title={() => "Ask Study Gen AI"}
      subtitle="Get answers grounded in your own uploaded study material."
    >
      <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
        <aside className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <h3 className="px-2 text-sm font-semibold text-dark">Your Documents</h3>
          <p className="mb-3 px-2 text-xs text-muted">
            {docs.length} ready Â· pick one to scope the chat
          </p>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setDocId("")}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  docId === ""
                    ? "bg-pink-light text-pink"
                    : "text-secondary hover:bg-bg hover:text-dark"
                }`}
              >
                All documents
              </button>
            </li>
            {docs.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setDocId(String(d.id))}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    docId === String(d.id)
                      ? "bg-pink-light text-pink"
                      : "text-secondary hover:bg-bg hover:text-dark"
                  }`}
                >
                  <FileText size={14} className="shrink-0" />
                  <span className="truncate">{d.filename}</span>
                </button>
              </li>
            ))}
          </ul>
          {docs.length === 0 && (
            <p className="mt-3 rounded-lg bg-bg p-3 text-xs text-muted">
              No documents yet. Upload some on the My Documents page.
            </p>
          )}
        </aside>

        <section className="flex h-[70vh] flex-col rounded-2xl border border-border bg-card shadow-card">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m, i) => (
              <Message key={i} message={m} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Loader2 size={16} className="animate-spin" />
                Study Gen AI is thinkingâ€¦
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="mx-5 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}

          <div className="border-t border-border p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask a question about your notesâ€¦"
                className="min-h-[44px] max-h-40 flex-1 resize-none rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-dark outline-none transition focus:border-pink focus:ring-2 focus:ring-pink/20"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-pink px-4 text-sm font-medium text-white transition hover:bg-pink-dark disabled:opacity-60"
              >
                <Send size={16} />
                Send
              </button>
            </form>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Message({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-light text-pink">
          <Bot size={18} />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-card ${
          isUser
            ? "bg-pink text-white"
            : "border border-border bg-card text-dark"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-border pt-2 text-xs">
            <div className="mb-1 font-semibold text-muted">Sources</div>
            <ul className="space-y-1">
              {message.sources.map((s, i) => (
                <li key={i} className="text-secondary">
                  <span className="font-medium text-dark">{s.doc_filename}</span>{" "}
                  <span className="text-muted">chunk {s.chunk_index} Â· score {s.score}</span>
                  <div className="text-muted">{s.snippet}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-secondary">
          <UserIcon size={18} />
        </div>
      )}
    </div>
  );
}