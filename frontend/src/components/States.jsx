/**
 * Study Gen AI — Shared loading states and error banner.
 *
 * Reusable across Chat, Quiz, Revision, Documents, Auth.
 * No fake content — every state reflects a real backend response.
 */

import { AlertCircle, Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Loading dots — used for "AI is thinking" / "Generating…" states    */
/* ------------------------------------------------------------------ */

export function ThinkingDots({ label = "Study Gen AI is thinking" }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-secondary">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-light text-pink">
        <Loader2 size={14} className="animate-spin" />
      </div>
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <span className="thinking-dot-1 h-1.5 w-1.5 rounded-full bg-pink/60" />
        <span className="thinking-dot-2 h-1.5 w-1.5 rounded-full bg-pink/60" />
        <span className="thinking-dot-3 h-1.5 w-1.5 rounded-full bg-pink/60" />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline spinner — for button loading states                        */
/* ------------------------------------------------------------------ */

export function ButtonSpinner() {
  return <Loader2 size={14} className="animate-spin" />;
}

/* ------------------------------------------------------------------ */
/* AI error banner — maps backend error codes to friendly messages   */
/* ------------------------------------------------------------------ */

const ERROR_MESSAGES = {
  AI_QUOTA_EXCEEDED:
    "Gemini AI is temporarily unavailable — the API quota has been reached. Your documents and RAG retrieval are still working. Please try again later.",
  AI_UNAVAILABLE:
    "The AI service is temporarily unavailable. Your documents and RAG retrieval are still working — please try again in a moment.",
  AI_NETWORK_ERROR:
    "Could not reach the AI service. Check your network connection and try again. Your documents and RAG retrieval are still working.",
  AI_TIMEOUT:
    "The AI service took too long to respond. Please try again.",
  AI_NOT_CONFIGURED:
    "The AI service is not configured on the server. Ask an admin to set GEMINI_API_KEY.",
};

export function AIErrorBanner({ err, onRetry, compact = false }) {
  const code = err?.code || "";
  const message =
    ERROR_MESSAGES[code] ||
    err?.message ||
    "Something went wrong. Please try again.";

  if (compact) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-error">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <span className="flex-1">{message}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-card animate-slide-in">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-error">
          <AlertCircle size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-error">AI generation failed</h3>
          <p className="mt-1 text-sm text-secondary">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state helper                                                 */
/* ------------------------------------------------------------------ */

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card animate-fade-in">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-light text-pink">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-dark">{title}</p>
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      {action}
    </div>
  );
}