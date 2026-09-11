/**
 * Study Gen AI â€” Register Page
 *
 * Student registration with full name, email, password,
 * confirm password, branch, and semester.
 * On success, stores the JWT token and redirects to /dashboard.
 */

import { useState } from "react";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const BRANCHES = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Electrical",
  "Mechanical",
  "Civil",
  "Other",
];

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm_password: "",
    branch: "",
    semester: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!form.name || !form.email || !form.password || !form.confirm_password || !form.branch || !form.semester) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
        branch: form.branch,
        semester: Number(form.semester),
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-dark outline-none transition focus:border-pink focus:ring-2 focus:ring-pink/20";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-light text-pink">
            <BookOpen size={22} />
          </div>
          <h1 className="text-2xl font-semibold text-dark">Study Gen AI</h1>
          <p className="text-sm text-secondary">Your personal AI study companion.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h2 className="text-lg font-semibold text-dark">Create Account</h2>
          <p className="mb-6 mt-1 text-sm text-secondary">Start learning with your own AI assistant.</p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-dark">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Ananya Sharma"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-dark">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="student@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-dark">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="At least 6 characters"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-dark"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm_password" className="mb-1 block text-sm font-medium text-dark">
                Confirm Password
              </label>
              <input
                id="confirm_password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirm_password}
                onChange={(e) => update("confirm_password", e.target.value)}
                placeholder="Re-enter your password"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="branch" className="mb-1 block text-sm font-medium text-dark">
                  Branch
                </label>
                <select
                  id="branch"
                  value={form.branch}
                  onChange={(e) => update("branch", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select branch</option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="semester" className="mb-1 block text-sm font-medium text-dark">
                  Semester
                </label>
                <select
                  id="semester"
                  value={form.semester}
                  onChange={(e) => update("semester", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-pink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pink-dark disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-secondary">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-pink hover:underline">
              Login
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Study Gen AI © 2026
        </p>
      </div>
    </div>
  );
}