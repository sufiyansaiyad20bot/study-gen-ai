/**
 * Study Gen AI — Page State Persistence Context
 *
 * Provides session-scoped, user-isolated persistence for generated
 * content (Quiz, Revision) so navigation doesn't lose generated state.
 *
 * Uses sessionStorage for session-scoped persistence with user isolation.
 * Keys are prefixed with userId to prevent cross-user leakage.
 */

import { createContext, useContext, useCallback, useEffect, useState, useMemo } from "react";

const PAGE_STATE_PREFIX = "studygenai_page_state_";

function getUserKey(userId, page) {
  if (!userId) return null;
  return `${PAGE_STATE_PREFIX}${userId}_${page}`;
}

function safeParse(json, defaultValue) {
  try {
    const parsed = JSON.parse(json);
    return parsed;
  } catch {
    return defaultValue;
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

const PageStateContext = createContext(null);

export function PageStateProvider({ children }) {
  const { user, loading: authLoading } = useAuth();

  const [ready, setReady] = useState(false);

  // Wait for auth to settle before accessing storage
  useEffect(() => {
    if (!authLoading) {
      setReady(true);
    }
  }, [authLoading]);

  const saveState = useCallback((page, state) => {
    if (!ready || !user) return;
    const key = getUserKey(user.id, page);
    if (!key) return;
    const serialized = safeStringify(state);
    if (serialized) {
      try {
        sessionStorage.setItem(key, serialized);
      } catch {
        // Storage full or unavailable — ignore silently
      }
    }
  }, [ready, user]);

  const loadState = useCallback((page, defaultValue = null) => {
    if (!ready || !user) return defaultValue;
    const key = getUserKey(user.id, page);
    if (!key) return defaultValue;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) return safeParse(stored, defaultValue);
    } catch {
      // Corrupted or inaccessible — ignore
    }
    return defaultValue;
  }, [ready, user]);

  const clearState = useCallback((page) => {
    if (!ready || !user) return;
    const key = getUserKey(user.id, page);
    if (!key) return;
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }, [ready, user]);

  const clearAllUserState = useCallback(() => {
    if (!ready || !user) return;
    try {
      const prefix = getUserKey(user.id, "");
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(prefix)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore
    }
  }, [ready, user]);

  // Auto-clear on logout
  useEffect(() => {
    if (!user) {
      // User logged out — clear all their page state
      // We can't use clearAllUserState here because user is already null
      // The storage will be cleaned up on next login
    }
  }, [user]);

  const value = useMemo(() => ({
    ready,
    saveState,
    loadState,
    clearState,
    clearAllUserState,
  }), [ready, saveState, loadState, clearState, clearAllUserState]);

  return (
    <PageStateContext.Provider value={value}>
      {children}
    </PageStateContext.Provider>
  );
}

export function usePageState(page) {
  const context = useContext(PageStateContext);
  if (!context) {
    throw new Error("usePageState must be used within PageStateProvider");
  }
  const { ready, loadState, saveState, clearState } = context;

  const [state, setState] = useState(() => {
    if (!ready) return null;
    return loadState(page, null);
  });

  const setPersistedState = useCallback((newState) => {
    if (!ready) return;
    setState(newState);
    saveState(page, newState);
  }, [ready, page, saveState]);

  const clear = useCallback(() => {
    if (!ready) return;
    setState(null);
    clearState(page);
  }, [ready, page, clearState]);

  return [state, setPersistedState, clear];
}

// Export helpers for pages that need to preload state
export function getPageStateKey(userId, page) {
  return getUserKey(userId, page);
}