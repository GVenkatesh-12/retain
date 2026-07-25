const apiMode = (import.meta.env.VITE_API_MODE as string | undefined) === 'server';

export const apiEnabled = apiMode;

function accessToken(): string | null {
  try {
    const raw = sessionStorage.getItem('retain-auth-tokens');
    return raw ? (JSON.parse(raw) as { access?: string }).access ?? null : null;
  } catch {
    return null;
  }
}

export async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  const token = accessToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const passcode = sessionStorage.getItem('retain-app-passcode');
  if (passcode) headers.set('x-retain-passcode', passcode);
  return fetch(path, { ...init, headers });
}
