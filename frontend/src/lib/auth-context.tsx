'use client';

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { loginRequest } from './api';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'admin_token';

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getTokenSnapshot(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getServerSnapshot(): null {
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedToken = useSyncExternalStore(
    subscribeToStorage,
    getTokenSnapshot,
    getServerSnapshot,
  );
  const [token, setToken] = useState<string | null>(storedToken);
  const router = useRouter();

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginRequest(email, password);
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      router.push('/admin');
    },
    [router],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    router.push('/admin/login');
  }, [router]);

  const isAuthenticated = !!(token || storedToken);
  const currentToken = token || storedToken;

  return (
    <AuthContext.Provider
      value={{
        token: currentToken,
        isAuthenticated,
        isLoading: false,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
