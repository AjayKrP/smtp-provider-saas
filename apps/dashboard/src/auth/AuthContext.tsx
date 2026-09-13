import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getAccessToken, setAccessToken, setAuthLostHandler } from '../api/client.js';

interface AuthState {
  authenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    organizationName?: string;
  }) => Promise<void>;
  /** Sign in with an access token obtained elsewhere (e.g. from email verification). */
  startSession: (accessToken: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [authenticated, setAuthenticated] = useState(!!getAccessToken());

  useEffect(() => {
    setAuthLostHandler(() => {
      setAccessToken(null);
      setAuthenticated(false);
      qc.clear();
    });
  }, [qc]);

  const applyToken = useCallback(
    (token: string) => {
      setAccessToken(token);
      setAuthenticated(true);
      void qc.invalidateQueries();
    },
    [qc],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ accessToken: string }>('/auth/login', { email, password });
      applyToken(data.accessToken);
    },
    [applyToken],
  );

  // Creates the account and emails a verification link; there is no session until the
  // user follows it.
  const register = useCallback<AuthState['register']>(async (input) => {
    await api.post('/auth/register', input);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setAuthenticated(false);
    qc.clear();
  }, [qc]);

  const value = useMemo<AuthState>(
    () => ({ authenticated, login, register, startSession: applyToken, logout }),
    [authenticated, login, register, applyToken, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
