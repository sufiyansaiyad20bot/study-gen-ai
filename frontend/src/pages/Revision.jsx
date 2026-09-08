/**
 * Study Gen AI â€” Revision Notes
 */

import { FileText, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import AppShell from "../components/AppShell";
import { documentsApi, revisionApi } from "../services/api";

export default function Revision() {
  const [docs, setDocs] = useState([]);
  const [docId, setDocId] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState(null);

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
    setNotes(null);
    try {
      const payload = {};
      if (docId) payload.document_id = Number(docId);
      if (topic.trim()) payload.topic = topic.trim();
      const res = await revisionApi.generate(payload);
      setNotes(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      title={() => "Revision Notes"}
      subtitle="Generate concise, structured revision notes from your study material."
    >
      <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="grid gap-4 sm:grid-cols-[1fr,1fr,auto]">
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
            <label className="mb-1 block text-sm font-medium text-dark">
              Topic <span className="text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. cell respiration"
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
                  <Sparkles size={16} />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
        {docs.length === 0 && (
          <p className="mt-3 rounded-lg bg-bg p-3 text-xs text-muted">
            Upload study material first to generate revision notes.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
      </div>

      {notes && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-xl font-semibold text-dark">{notes.title}</h2>
            {notes.summary && (
              <p className="mt-2 text-sm leading-relaxed text-secondary">{notes.summary}</p>
            )}
          </div>

          {notes.key_concepts?.length > 0 && (
            <Section title="Key Concepts">
              <ul className="flex flex-wrap gap-2">
                {notes.key_concepts.map((c, i) => (
                  <li
                    key={i}
                    className="rounded-full bg-pink-light px-3 py-1 text-xs font-medium text-pink"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {notes.important_points?.length > 0 && (
            <Section title="Important Points">
              <ul className="list-disc space-y-1 pl-5 text-sm text-dark">
                {notes.important_points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </Section>
          )}

          {notes.definitions?.length > 0 && (
            <Section title="Definitions">
              <dl className="grid gap-3 sm:grid-cols-2">
                {notes.definitions.map((d, i) => (
                  <div key={i} className="rounded-lg border border-border bg-bg p-3">
                    <dt className="text-sm font-semibold text-dark">{d.term}</dt>
                    <dd className="mt-1 text-sm text-secondary">{d.definition}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {notes.formulas?.length > 0 && (
            <Section title="Formulas">
              <ul className="space-y-1 font-mono text-sm text-dark">
                {notes.formulas.map((f, i) => (
                  <li key={i} className="rounded-lg bg-bg px-3 py-2">
                    {f}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {notes.sources?.length > 0 && (
            <Section title="Sources">
              <ul className="space-y-2 text-xs text-muted">
                {notes.sources.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium text-dark">{s.doc_filename}</span>{" "}
                    chunk {s.chunk_index} Â· score {s.score}
                    <div>{s.snippet}</div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {!notes.summary &&
            !notes.key_concepts?.length &&
            !notes.important_points?.length && (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-secondary shadow-card">
                <FileText size={28} className="mx-auto mb-2 text-muted" />
                No notes could be generated. Try a different document.
              </div>
            )}
        </div>
      )}

      {!loading && !notes && docs.length > 0 && !error && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-secondary shadow-card">
          <Sparkles size={28} className="mx-auto mb-2 text-muted" />
          <p className="text-sm">
            Pick a source and click <span className="font-medium text-dark">Generate</span>.
          </p>
        </div>
      )}
    </AppShell>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}