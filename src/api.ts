const apiMode = (import.meta.env.VITE_API_MODE as string | undefined) === 'server';

export const apiEnabled = apiMode;

function accessToken(): string | null {
  try {
    return localStorage.getItem('retain-auth-token') || sessionStorage.getItem('retain-auth-token');
  } catch {
    return null;
  }
}

export async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  const token = accessToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}
