/**
 * Study Gen AI â€” Authentication Context
 *
 * Provides login / register / logout / user state to the whole app.
 * The token is stored in localStorage (never the password).
 * On initial load, if a token exists, we verify it with /auth/me.
 */

import { createContext, useContext, useCallback, useEffect, useState } from "react";

import {
  authApi,
  clearToken,
  clearStoredUser,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  // On mount: verify the token if one exists
  useEffect(() => {
    const token = getToken();

    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .me()
      .then((currentUser) => {
        setUser(currentUser);
        setStoredUser(currentUser);
      })
      .catch(() => {
        setUser(null);
        clearToken();
        clearStoredUser();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });

    setToken(data.access_token);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);

    setToken(data.access_token);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearToken();
    clearStoredUser();
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}