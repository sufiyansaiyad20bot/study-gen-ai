/**
 * Study Gen AI — App Shell
 *
 * Shared header + sidebar layout for all authenticated pages.
 */

import { BookOpen, Bot, FileText, GraduationCap, LogOut, Sparkles } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: BookOpen, end: true },
  { to: "/chat", label: "Ask Study Gen AI", icon: Bot },
  { to: "/documents", label: "My Documents", icon: FileText },
  { to: "/quiz", label: "Generate Quiz", icon: GraduationCap },
  { to: "/revision", label: "Revision Notes", icon: Sparkles },
];

export default function AppShell({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name?.split(" ")[0] || "Student";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-light text-pink">
              <BookOpen size={18} />
            </div>
            <span className="text-lg font-semibold text-dark">Study Gen AI</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-dark">{user?.name}</div>
              <div className="text-xs text-muted">
                {user?.branch} · Semester {user?.semester}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary transition hover:bg-bg hover:text-dark"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-8 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-pink-light text-pink"
                        : "text-secondary hover:bg-bg hover:text-dark"
                    }`
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 animate-page-enter">
          {(title || subtitle) && (
            <div className="mb-6">
              {title && (
                <h1 className="text-2xl font-bold text-dark sm:text-3xl">
                  {title(firstName)}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-secondary">{subtitle}</p>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}