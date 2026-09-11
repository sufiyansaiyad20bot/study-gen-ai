/**
 * Study Gen AI — Chat (RAG-powered Q&A)
 */

import { Bot, CheckCircle, FileText, Loader2, Send, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import AppShell from "../components/AppShell";
import { AIErrorBanner, ThinkingDots } from "../components/States";
import { chatApi, documentsApi } from "../services/api";

const QUICK_PROMPTS = [
  "Explain this in simple terms",
  "Summarize the important points",
  "Give me the key concepts",
  "Explain with an example",
  "What are the important definitions?",
  "Help me revise this topic",
  "What should I remember for an exam?",
  "Test my understanding",
];

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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [aiError, setAiError] = useState(null);
  const endRef = useRef(null);

  // True when only the default greeting is present (no real conversation yet)
  const hasConversation = messages.length > 1;

  function submitPrompt(prompt) {
    if (loading) return;
    setInput(prompt);
    // Use a microtask so the input state updates before send() reads it
    setTimeout(() => send(prompt), 0);
  }

  useEffect(() => {
    documentsApi
      .list()
      .then((d) => setDocs(d.filter((x) => x.status === "ready")))
      .catch((err) => setError(err.message));
  }, []);

  // Load persisted chat history on mount so conversations survive
  // navigation, refresh, and switching between pages.
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    chatApi
      .history()
      .then((rows) => {
        if (cancelled) return;
        if (rows && rows.length > 0) {
          setMessages(
            rows.map((r) => ({
              role: "user",
              content: r.question,
            })).concat(
              rows.map((r) => ({
                role: "assistant",
                content: r.answer,
                sources: [],
                grounded: r.grounded,
                answer_source: r.grounded ? "uploaded_documents" : "general_knowledge",
                general_message: r.grounded ? "" : "This information was not found in your uploaded study material.",
              }))
            )
          );
        }
      })
      .catch(() => {
        // History load failure is non-fatal — keep the default greeting.
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    if (docs.length === 0) {
      setError("You need to upload a study material first.");
      return;
    }
    setError("");
    setAiError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const payload = { question: text };
      if (docId) payload.document_id = Number(docId);
      const res = await chatApi.ask(payload);
      // Safe fallbacks — never render undefined/null as JSX
      const answerText = res?.answer || "I could not generate a response. Please try again.";
      const sources = Array.isArray(res?.sources) ? res.sources : [];
      const grounded = Boolean(res?.grounded);
      const answerSource = res?.answer_source || (grounded ? "uploaded_documents" : "general_knowledge");
      const generalMessage = res?.general_message || "";
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: answerText,
          sources: sources,
          grounded: grounded,
          answer_source: answerSource,
          general_message: generalMessage,
        },
      ]);
    } catch (err) {
      // Every request must end in success OR a visible error state.
      // Never leave the UI stuck on "thinking...".
      const code = err?.code || "";
      let userMsg;
      if (code === "AI_QUOTA_EXCEEDED") {
        userMsg =
          "Gemini AI is temporarily unavailable — the API quota has been reached. Your documents and RAG retrieval are still working. Please try again later.";
      } else if (code === "AI_UNAVAILABLE") {
        userMsg =
          "The AI service is temporarily unavailable. Your documents and RAG retrieval are still working — please try again in a moment.";
      } else if (code === "AI_NETWORK_ERROR") {
        userMsg =
          "Could not reach the AI service. Check your network connection and try again.";
      } else if (code === "AI_TIMEOUT") {
        userMsg =
          "The AI service took too long to respond. Please try again.";
      } else if (code === "AI_NOT_CONFIGURED") {
        userMsg =
          "The AI service is not configured on the server. Ask an admin to set GEMINI_API_KEY.";
      } else if (err?.status === 400) {
        userMsg = err?.message || "Please upload a document first.";
      } else if (err?.status === 401) {
        userMsg = "Session expired. Please log in again.";
      } else {
        userMsg =
          err?.message ||
          "Something went wrong. Please try again.";
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: userMsg, sources: [] },
      ]);
      // Keep the error banner visible for retry
      setAiError(err);
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
            {docs.length} ready · pick one to scope the chat
          </p>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setDocId("")}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  docId === ""
                    ? "bg-pink-light text-pink"
                    : "doc-selector-item text-secondary hover:bg-bg hover:text-dark"
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
                      : "doc-selector-item text-secondary hover:bg-bg hover:text-dark"
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

        <section className="flex h-[72vh] flex-col rounded-2xl border border-border bg-card shadow-card">
          <div className="flex-1 space-y-4 overflow-y-auto p-5 chat-scroll-area">
            {historyLoading && messages.length === 1 && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" />
                Loading conversation…
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="animate-message-in">
                <Message message={m} />
              </div>
            ))}
            {loading && (
              <div className="animate-message-in">
                <ThinkingDots label="Study Gen AI is thinking" />
              </div>
            )}
            {aiError && !loading && (
              <div className="animate-message-in">
                <AIErrorBanner
                  err={aiError}
                  onRetry={() => {
                    const lastUser = [...messages]
                      .reverse()
                      .find((m) => m.role === "user");
                    if (lastUser) {
                      setInput(lastUser.content);
                    }
                    setAiError(null);
                  }}
                />
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick Prompts — shown when no conversation has started yet */}
          {!hasConversation && !loading && (
            <div className="border-t border-border px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                How can I help you study?
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => submitPrompt(prompt)}
                    className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-pink/40 hover:bg-pink-light hover:text-pink disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mx-5 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-error animate-slide-in">
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
                placeholder="Ask a question about your notes"
                disabled={loading}
                className="min-h-[44px] max-h-40 flex-1 resize-none rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-dark outline-none transition input-focus-glow disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-pink px-4 text-sm font-medium text-white transition hover:bg-pink-dark disabled:opacity-60 button-press"
              >
                {loading ? <ButtonSpinner /> : <Send size={16} />}
                {loading ? "Sending" : "Send"}
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
  const isGrounded = message.grounded;
  const answerSource = message.answer_source || (isGrounded ? "uploaded_documents" : "general_knowledge");
  const generalMessage = message.general_message || "";
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
        {!isUser && answerSource === "uploaded_documents" && isGrounded && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
            <CheckCircle size={10} />
            From your study material
          </div>
        )}
        {!isUser && answerSource === "general_knowledge" && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Outside your uploaded study material
          </div>
        )}
        {!isUser && generalMessage && (
          <p className="mt-2 text-xs text-muted">{generalMessage}</p>
        )}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-border pt-2 text-xs">
            <div className="mb-1 font-semibold text-muted">Sources</div>
            <ul className="space-y-1.5">
              {message.sources.map((s, i) => (
                <li key={i} className="text-secondary source-chip -mx-1 rounded-lg px-1">
                  <span className="font-medium text-dark">{s.doc_filename}</span>{" "}
                  <span className="text-muted">chunk {s.chunk_index} · score {s.score}</span>
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