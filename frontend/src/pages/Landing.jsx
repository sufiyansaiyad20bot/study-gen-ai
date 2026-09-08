/**
 * Study Gen AI â€” Landing Page
 *
 * Simple public page shown before login.
 * Hero: "Study smarter with your own AI assistant."
 */

import { BookOpen, Bot, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-light text-pink">
              <BookOpen size={18} />
            </div>
            <span className="text-lg font-semibold text-dark">Study Gen AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-secondary transition hover:bg-bg hover:text-dark"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-pink px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-dark"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-light text-pink">
          <GraduationCap size={32} />
        </div>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight text-dark sm:text-5xl">
          Study smarter with your own AI&nbsp;assistant.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-secondary">
          Upload your study material, ask questions, generate quizzes, and create
          revision notes from your own documents.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/register"
            className="rounded-lg bg-pink px-6 py-3 text-sm font-medium text-white shadow-card transition hover:bg-pink-dark"
          >
            Get Started
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium text-dark transition hover:bg-bg"
          >
            Login
          </Link>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<BookOpen size={20} />}
            title="Understand Your Notes"
            description="Upload PDFs, DOCX, or TXT and turn them into a personal knowledge base."
          />
          <FeatureCard
            icon={<Bot size={20} />}
            title="Ask Your AI Assistant"
            description="Get answers grounded in your own study material with source references."
          />
          <FeatureCard
            icon={<GraduationCap size={20} />}
            title="Prepare for Exams"
            description="Generate quizzes, revision notes, and important questions from your documents."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-5 text-center text-sm text-muted">
        Study Gen AI â€” Your personal AI study companion.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-card">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-pink-light text-pink">
        {icon}
      </div>
      <h3 className="font-semibold text-dark">{title}</h3>
      <p className="mt-1 text-sm text-secondary">{description}</p>
    </div>
  );
}