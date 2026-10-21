'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@/types/market';
import { authService } from '@/services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (usernameOrEmail: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  checkAuth: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkAuth = useCallback(async () => {
    try {
      const me = await authService.getMe();
      setUser(me);
    } catch {
      try {
        const refreshed = await authService.refresh();
        setUser(refreshed.user);
      } catch {
        setUser(null);
        if (pathname !== '/login') {
          router.push('/login');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    checkAuth();

    // Refresco silencioso de token cada 10 minutos
    const interval = setInterval(async () => {
      try {
        await authService.refresh();
      } catch (err) {
        console.warn('[AuthProvider] Fallo en refresco silencioso:', err);
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkAuth]);

  const login = async (usernameOrEmail: string, pass: string) => {
    setLoading(true);
    try {
      const resp = await authService.login(usernameOrEmail, pass);
      setUser(resp.user);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setLoading(false);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
