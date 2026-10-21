import { AuthResponse, User } from '@/types/market';

const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '127.0.0.1';
    return `http://${host}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
};

class AuthService {
  private inMemoryToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.inMemoryToken = localStorage.getItem('market_access_token');
    }
  }

  getAccessToken(): string | null {
    return this.inMemoryToken;
  }

  setAccessToken(token: string | null) {
    this.inMemoryToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('market_access_token', token);
      } else {
        localStorage.removeItem('market_access_token');
      }
    }
  }

  async login(usernameOrEmail: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${getApiBase()}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username_or_email: usernameOrEmail.trim(),
        password,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Fallo al autenticar' }));
      throw new Error(err.detail || 'Credenciales incorrectas');
    }

    const data: AuthResponse = await res.json();
    this.setAccessToken(data.access_token);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${getApiBase()}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.inMemoryToken ? { Authorization: `Bearer ${this.inMemoryToken}` } : {}),
        },
        credentials: 'include',
      });
    } catch (e) {
      console.warn('[AuthService] Error durante cierre de sesión:', e);
    } finally {
      this.setAccessToken(null);
    }
  }

  async refresh(): Promise<AuthResponse> {
    const res = await fetch(`${getApiBase()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!res.ok) {
      this.setAccessToken(null);
      throw new Error('Sesión revocada o expirada.');
    }

    const data: AuthResponse = await res.json();
    this.setAccessToken(data.access_token);
    return data;
  }

  async getMe(): Promise<User> {
    const res = await fetch(`${getApiBase()}/api/v1/auth/me`, {
      headers: {
        'Content-Type': 'application/json',
        ...(this.inMemoryToken ? { Authorization: `Bearer ${this.inMemoryToken}` } : {}),
      },
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('No autorizado');
    }

    return res.json();
  }

  async getWsTicket(): Promise<string> {
    const res = await fetch(`${getApiBase()}/api/v1/auth/ws-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.inMemoryToken ? { Authorization: `Bearer ${this.inMemoryToken}` } : {}),
      },
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('No se pudo generar el ticket de WebSocket');
    }

    const data = await res.json();
    return data.ticket;
  }
}

export const authService = new AuthService();
