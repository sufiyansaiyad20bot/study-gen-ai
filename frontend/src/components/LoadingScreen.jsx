/**
 * Study Gen AI â€” Loading Screen
 *
 * Simple centered spinner shown while the app verifies auth state.
 */

export default function LoadingScreen() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-pink" />
        <p className="text-sm text-secondary">Loading…</p>
      </div>
    </div>
  );
}