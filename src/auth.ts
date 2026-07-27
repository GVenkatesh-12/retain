import { DEFAULT_HASH, DEFAULT_SALT, DEFAULT_USER_EMAIL, verifyPassword } from './crypto';

const USER_KEY = 'retain-user-session';
const TOKEN_KEY = 'retain-auth-token';

export const authEnabled = true;

export interface UserSession {
  id: string;
  email: string;
}

export function getUserSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

export async function loginWithPassword(
  email: string,
  passwordAttempt: string
): Promise<{ ok: boolean; message?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail !== DEFAULT_USER_EMAIL.toLowerCase()) {
    return { ok: false, message: 'Invalid email address.' };
  }

  // If server mode is active, try server auth endpoint first
  const apiMode = (import.meta.env.VITE_API_MODE as string | undefined) === 'server';
  if (apiMode) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: passwordAttempt }),
      });
      if (res.ok) {
        const body = (await res.json()) as { data: { user: UserSession; token: string } };
        localStorage.setItem(USER_KEY, JSON.stringify(body.data.user));
        localStorage.setItem(TOKEN_KEY, body.data.token);
        return { ok: true };
      } else {
        const body = (await res.json()) as { error?: { message?: string } };
        return { ok: false, message: body.error?.message || 'Invalid email or password.' };
      }
    } catch {
      // Fallback to local crypto verification if offline
    }
  }

  const isValid = await verifyPassword(passwordAttempt, DEFAULT_SALT, DEFAULT_HASH);
  if (!isValid) {
    return { ok: false, message: 'Incorrect password. Please check your credentials.' };
  }

  const session: UserSession = {
    id: 'user-gvenkatesh',
    email: DEFAULT_USER_EMAIL,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(session));
  localStorage.setItem(TOKEN_KEY, `local-token-${Date.now()}`);
  return { ok: true };
}

export async function checkAuth(): Promise<boolean> {
  const session = getUserSession();
  return Boolean(session);
}

export function logout() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  window.location.reload();
}
