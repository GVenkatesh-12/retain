const apiMode = (import.meta.env.VITE_API_MODE as string | undefined) === 'server';

export const apiEnabled = apiMode;

let activeRequestsCount = 0;
type SyncListener = (isSyncing: boolean, lastSavedAt?: number) => void;
const syncListeners = new Set<SyncListener>();

export function subscribeToSyncStatus(listener: SyncListener) {
  syncListeners.add(listener);
  return () => { syncListeners.delete(listener); };
}

function notifySync(isSyncing: boolean, lastSavedAt?: number) {
  syncListeners.forEach((fn) => fn(isSyncing, lastSavedAt));
}

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

  activeRequestsCount++;
  notifySync(true);

  try {
    const response = await fetch(path, { ...init, headers });
    return response;
  } finally {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    if (activeRequestsCount === 0) {
      notifySync(false, Date.now());
    }
  }
}
