/**
 * Study Gen AI — Chat (RAG-powered Q&A)
 */

import { Bot, CheckCircle, FileText, Loader2, Send, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState, Component } from "react";

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

// ---- Error Boundary ----
class ChatErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Chat render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h3 className="text-lg font-medium text-dark mb-2">Something went wrong</h3>
          <p className="text-sm text-muted mb-4">
            The chat encountered an error. Please refresh the page or try again.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-lg bg-pink text-white text-sm font-medium hover:bg-pink-dark"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---- Helpers ----
function safeSourceMap(sources, renderFn) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  try {
    return sources.map((s, i) => {
      if (!s || typeof s !== "object") return null;
      return renderFn(s, i);
    }).filter(Boolean);
  } catch {
    return null;
  }
}

function Message({ message }) {
  const isUser = message?.role === "user";
  const isGrounded = Boolean(message?.grounded);
  const answerSource = message?.answer_source || (isGrounded ? "uploaded_documents" : "general_knowledge");
  const generalMessage = message?.general_message || "";
  const content = message?.content ?? "";

  const sources = Array.isArray(message?.sources) ? message.sources : [];

  const sourceItems = safeSourceMap(sources, (s, i) => {
    if (!s) return null;
    return (
      <li key={i} className="text-secondary source-chip -mx-1 rounded-lg px-1">
        <span className="font-medium text-dark">{s.doc_filename ?? "Unknown source"}</span>{" "}
        <span className="text-muted">
          chunk {s.chunk_index ?? "?"} · score {typeof s.score === "number" ? s.score.toFixed(3) : "?"}
        </span>
        <div className="text-muted">{s.snippet ?? ""}</div>
      </li>
    );
  });

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
        <div className="whitespace-pre-wrap">{content}</div>
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
        {!isUser && sources.length > 0 && sourceItems && (
          <div className="mt-3 border-t border-border pt-2 text-xs">
            <div className="mb-1 font-semibold text-muted">Sources</div>
            <ul className="space-y-1.5">{sourceItems}</ul>
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
  const loadingRef = useRef(false);
  const [error, setError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [aiError, setAiError] = useState(null);
  const endRef = useRef(null);

  const hasConversation = messages.length > 1;

  function submitPrompt(prompt) {
    if (loadingRef.current) return;
    setInput(prompt);
    setTimeout(() => send(prompt), 0);
  }

  useEffect(() => {
    documentsApi
      .list()
      .then((d) => setDocs(d.filter((x) => x.status === "ready")))
      .catch((err) => setError(err.message));
  }, []);

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
                grounded: Boolean(r.grounded),
                answer_source: r.grounded ? "uploaded_documents" : "general_knowledge",
                general_message: r.grounded ? "" : "This information was not found in your uploaded study material.",
              }))
            )
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || loadingRef.current) return;
    if (docs.length === 0) {
      setError("You need to upload a study material first.");
      return;
    }
    setError("");
    setAiError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    loadingRef.current = true;
    setLoading(true);
    try {
      const payload = { question: text };
      if (docId) payload.document_id = Number(docId);
      const res = await chatApi.ask(payload);
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
          sources,
          grounded,
          answer_source: answerSource,
          general_message: generalMessage,
        },
      ]);
    } catch (err) {
      const code = err?.code || "";
      let userMsg;
      if (code === "AI_QUOTA_EXCEEDED") {
        userMsg = "Gemini AI is temporarily unavailable — the API quota has been reached. Your documents and RAG retrieval are still working. Please try again later.";
      } else if (code === "AI_UNAVAILABLE") {
        userMsg = "The AI service is temporarily unavailable. Your documents and RAG retrieval are still working — please try again in a moment.";
      } else if (code === "AI_NETWORK_ERROR") {
        userMsg = "Could not reach the AI service. Check your network connection and try again.";
      } else if (code === "AI_TIMEOUT") {
        userMsg = "The AI service took too long to respond. Please try again.";
      } else if (code === "AI_NOT_CONFIGURED") {
        userMsg = "The AI service is not configured on the server. Ask an admin to set GEMINI_API_KEY.";
      } else if (err?.status === 400) {
        userMsg = err?.message || "Please upload a document first.";
      } else if (err?.status === 401) {
        userMsg = "Session expired. Please log in again.";
      } else {
        userMsg = err?.message || "Something went wrong. Please try again.";
      }
      setMessages((m) => [...m, { role: "assistant", content: userMsg, sources: [] }]);
      setAiError(err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <ChatErrorBoundary>
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
                      const lastUser = [...messages].reverse().find((m) => m.role === "user");
                      if (lastUser) setInput(lastUser.content);
                      setAiError(null);
                    }}
                  />
                </div>
              )}
              <div ref={endRef} />
            </div>

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
                  if (!loadingRef.current) send();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !loadingRef.current) {
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
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Sending
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>
        </div>
      </AppShell>
    </ChatErrorBoundary>
  );
}