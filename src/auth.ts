import { createClient, type Tokens } from '@openauthjs/openauth/client';
import { object, string } from 'valibot';
import { createSubjects } from '@openauthjs/openauth/subject';

const issuer = import.meta.env.VITE_OPENAUTH_ISSUER as string | undefined;
export const authEnabled = Boolean(issuer);
const client = issuer ? createClient({ clientID: 'retain-web', issuer }) : null;
const subjects = createSubjects({ user: object({ id: string(), email: string() }) });
const TOKEN_KEY = 'retain-auth-tokens';
const USER_KEY = 'retain-user-session';
const CALLBACK_PATH = '/callback';

export interface UserSession {
  id: string;
  email: string;
}

export function getUserSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) as UserSession : null;
  } catch {
    return null;
  }
}

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) as Tokens : null;
  } catch {
    return null;
  }
}

function saveTokens(tokens: Tokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function beginLogin() {
  if (!client) return;
  const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
  const result = await client.authorize(redirectUri, 'code', { provider: 'password', pkce: true });
  localStorage.setItem('retain-auth-challenge', JSON.stringify(result.challenge));
  sessionStorage.setItem('retain-auth-challenge', JSON.stringify(result.challenge));
  window.location.assign(result.url);
}

export async function finishLogin(): Promise<boolean> {
  if (!client) return false;
  const params = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search.slice(1));
  const code = params.get('code');
  if (!code) return false;
  const challenge = localStorage.getItem('retain-auth-challenge') || sessionStorage.getItem('retain-auth-challenge');
  const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
  const result = await client.exchange(code, redirectUri, challenge ? JSON.parse(challenge).verifier : undefined);
  if (result.err) return false;
  saveTokens(result.tokens);
  localStorage.removeItem('retain-auth-challenge');
  sessionStorage.removeItem('retain-auth-challenge');
  window.history.replaceState({}, document.title, '/');
  return true;
}

export async function checkAuth(): Promise<boolean> {
  if (!client) return true;
  const tokens = readTokens();
  if (!tokens) return false;
  const verified = await client.verify(subjects, tokens.access, { refresh: tokens.refresh });
  if (verified.err) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    return false;
  }
  if (verified.tokens) saveTokens(verified.tokens);
  if (verified.subject?.properties) {
    localStorage.setItem(USER_KEY, JSON.stringify(verified.subject.properties));
  }
  return true;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('retain-auth-challenge');
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem('retain-auth-challenge');
  window.location.reload();
}
