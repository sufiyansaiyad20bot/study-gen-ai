/**
 * Study Gen AI â€” Quiz
 */

import { CheckCircle2, FileText, GraduationCap, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import AppShell from "../components/AppShell";
import { documentsApi, quizApi } from "../services/api";

export default function Quiz() {
  const [docs, setDocs] = useState([]);
  const [docId, setDocId] = useState("");
  const [num, setNum] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    documentsApi
      .list()
      .then((d) => setDocs(d.filter((x) => x.status === "ready")))
      .catch((err) => setError(err.message));
  }, []);

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError("");
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    try {
      const payload = { num_questions: num };
      if (docId) payload.document_id = Number(docId);
      const res = await quizApi.generate(payload);
      setQuestions(res.questions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function pick(qi, oi) {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [qi]: oi }));
  }

  function submit() {
    if (questions.length === 0) return;
    setSubmitted(true);
  }

  function reset() {
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
  }

  const score = submitted
    ? questions.reduce(
        (acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0),
        0,
      )
    : 0;

  return (
    <AppShell
      title={() => "Generate Quiz"}
      subtitle="Test yourself on your uploaded study material."
    >
      <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="grid gap-4 sm:grid-cols-[1fr,160px,auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-dark">Source</label>
            <select
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-dark outline-none transition focus:border-pink focus:ring-2 focus:ring-pink/20"
            >
              <option value="">All documents</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-dark">Questions</label>
            <input
              type="number"
              min={1}
              max={20}
              value={num}
              onChange={(e) => setNum(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-dark outline-none transition focus:border-pink focus:ring-2 focus:ring-pink/20"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={generate}
              disabled={loading || docs.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-pink-dark disabled:opacity-60 sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generatingâ€¦
                </>
              ) : (
                <>
                  <GraduationCap size={16} />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>

        {docs.length === 0 && (
          <p className="mt-3 rounded-lg bg-bg p-3 text-xs text-muted">
            Upload study material first to generate quizzes.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
      </div>

      {questions.length > 0 && (
        <div className="space-y-4">
          {submitted && (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-pink-light p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-dark">
                  You scored {score} / {questions.length}
                </h3>
                <p className="text-sm text-secondary">
                  {score === questions.length
                    ? "Perfect! ðŸŽ‰"
                    : score >= questions.length / 2
                    ? "Nice work â€” review the explanations below."
                    : "Keep going. Re-read the relevant notes and try again."}
                </p>
              </div>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-lg bg-card px-4 py-2 text-sm font-medium text-dark transition hover:bg-bg"
              >
                <RefreshCw size={16} />
                Start Over
              </button>
            </div>
          )}

          {questions.map((q, qi) => (
            <div key={qi} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="mb-3 flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-light text-xs font-semibold text-pink">
                  {qi + 1}
                </div>
                <p className="text-sm font-medium text-dark">{q.question}</p>
              </div>
              <div className="grid gap-2">
                {q.options.map((opt, oi) => {
                  const chosen = answers[qi] === oi;
                  const isCorrect = q.correct_index === oi;
                  let cls =
                    "border-border bg-card text-dark hover:bg-bg";
                  if (submitted) {
                    if (isCorrect) cls = "border-success bg-green-50 text-success";
                    else if (chosen && !isCorrect)
                      cls = "border-error bg-red-50 text-error";
                  } else if (chosen) {
                    cls = "border-pink bg-pink-light text-pink";
                  }
                  return (
                    <button
                      key={oi}
                      onClick={() => pick(qi, oi)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${cls}`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px] font-semibold">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {submitted && isCorrect && <CheckCircle2 size={16} />}
                      {submitted && chosen && !isCorrect && <XCircle size={16} />}
                    </button>
                  );
                })}
              </div>
              {submitted && q.explanation && (
                <div className="mt-3 rounded-lg bg-bg p-3 text-xs text-secondary">
                  <span className="font-semibold text-dark">Explanation: </span>
                  {q.explanation}
                </div>
              )}
            </div>
          ))}

          {!submitted && (
            <div className="flex justify-end">
              <button
                onClick={submit}
                disabled={Object.keys(answers).length < questions.length}
                className="inline-flex items-center gap-2 rounded-lg bg-pink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-pink-dark disabled:opacity-60"
              >
                Submit Quiz
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && questions.length === 0 && docs.length > 0 && !error && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-secondary shadow-card">
          <FileText size={28} className="mx-auto mb-2 text-muted" />
          <p className="text-sm">
            Choose a source and click <span className="font-medium text-dark">Generate</span> to start.
          </p>
        </div>
      )}
    </AppShell>
  );
}