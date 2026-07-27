import { dateKeyToInstant, localDateKey } from './domain/date';
import { dashboardSummary, estimateBonusCount, rankBonusTopics, scheduleForTopic } from './domain/schedule';
import { apiEnabled, apiRequest } from './api';
import type { AppData, BonusBatch, CompletionEvent, Revision, Settings, Topic } from './types';

const STORAGE_KEY = 'retain-data-v1';
const USER_ID = 'user-gvenkatesh';

const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function defaultData(): AppData {
  const now = nowIso();
  return {
    settings: { userId: USER_ID, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', dailyTarget: 15, theme: 'system', animationsEnabled: true, createdAt: now, updatedAt: now },
    subjects: [], topics: [], revisions: [], completionEvents: [], bonusBatches: [],
  };
}

function load(): AppData {
  if (typeof window === 'undefined') return defaultData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.settings || !Array.isArray(parsed.topics) || !Array.isArray(parsed.revisions)) return defaultData();
    const fallback = defaultData();
    const subjects = parsed.subjects ?? [...new Set(parsed.topics.map((topic) => topic.subject))];
    return { ...fallback, ...parsed, settings: { ...fallback.settings, ...parsed.settings }, subjects, bonusBatches: parsed.bonusBatches ?? [] };
  } catch {
    return defaultData();
  }
}

let state = load();
const listeners = new Set<() => void>();

function persist() {
  state = { ...state, settings: { ...state.settings, updatedAt: nowIso() } };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

export const store = {
  get data(): AppData { return state; },
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  async addTopic(subject: string, title: string, startDate?: string): Promise<Topic> {
    const s = subject.trim(); const t = title.trim();
    const createdAt = startDate ? (/^\d{4}-\d{2}-\d{2}$/.test(startDate) ? dateKeyToInstant(startDate, state.settings.timezone) : new Date(startDate).toISOString()) : nowIso();
    const topic: Topic = { id: makeId('topic'), userId: USER_ID, subject: s, title: t, createdAt, archivedAt: null };
    if (!state.subjects.some((savedSubject) => savedSubject.toLocaleLowerCase() === s.toLocaleLowerCase())) {
      state.subjects = [...state.subjects, s].sort((a, b) => a.localeCompare(b));
    }
    state.topics = [topic, ...state.topics];
    state.revisions = [...state.revisions, ...scheduleForTopic(topic, state.settings.timezone)];
    persist();

    if (apiEnabled) {
      const response = await apiRequest('/api/topics', { method: 'POST', body: JSON.stringify({ id: topic.id, subject: s, title: t, startDate, createdAt }) });
      if (response.ok) {
        await store.hydrateFromApi();
      }
    }
    return topic;
  },
  async updateTopic(id: string, subject: string, title: string, startDate?: string): Promise<boolean> {
    const s = subject.trim(); const t = title.trim();
    const topic = state.topics.find((item) => item.id === id);
    if (topic) {
      topic.subject = s;
      topic.title = t;
      if (startDate) {
        topic.createdAt = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? dateKeyToInstant(startDate, state.settings.timezone) : new Date(startDate).toISOString();
        state.revisions = state.revisions.filter((rev) => rev.topicId !== id);
        state.revisions = [...state.revisions, ...scheduleForTopic(topic, state.settings.timezone)];
      }
      if (!state.subjects.some((savedSubject) => savedSubject.toLocaleLowerCase() === s.toLocaleLowerCase())) {
        state.subjects = [...state.subjects, s].sort((a, b) => a.localeCompare(b));
      }
      persist();
    }

    if (apiEnabled) {
      const response = await apiRequest(`/api/topics/${id}`, { method: 'PATCH', body: JSON.stringify({ subject: s, title: t, startDate }) });
      if (response.ok) {
        await store.hydrateFromApi();
        return true;
      }
    }
    return Boolean(topic);
  },
  async deleteTopic(id: string): Promise<boolean> {
    state.topics = state.topics.filter((topic) => topic.id !== id);
    state.revisions = state.revisions.filter((rev) => rev.topicId !== id);
    state.completionEvents = state.completionEvents.filter((event) => event.topicId !== id);
    persist();

    if (apiEnabled) {
      const response = await apiRequest(`/api/topics/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await store.hydrateFromApi();
        return true;
      }
    }
    return true;
  },
  async completeRevision(revisionId: string): Promise<boolean> {
    const revision = state.revisions.find((item) => item.id === revisionId);
    if (!revision || revision.status === 'completed') return false;

    if (apiEnabled) {
      const response = await apiRequest(`/api/revisions/${revisionId}/complete`, { method: 'POST' });
      if (response.ok) { await store.hydrateFromApi(); return true; }
    }

    const completedAt = nowIso();
    revision.status = 'completed';
    revision.completedAt = completedAt;
    const event: CompletionEvent = { id: makeId('event'), userId: USER_ID, revisionId, topicId: revision.topicId, kind: revision.kind, completedAt, localDate: localDateKey(new Date(completedAt), state.settings.timezone), bonusBatchId: revision.bonusBatchId };
    state.completionEvents = [...state.completionEvents, event];
    persist();
    return true;
  },
  async createBonusBatch(minutes: number): Promise<BonusBatch | null> {
    if (apiEnabled) {
      const response = await apiRequest('/api/bonus-batches', { method: 'POST', body: JSON.stringify({ minutes }) });
      if (!response.ok) return null;
      const result = await response.json() as { data: BonusBatch | null };
      await store.hydrateFromApi();
      return result.data;
    }
    const count = estimateBonusCount(minutes);
    const topics = rankBonusTopics(state, count);
    if (!topics.length) return null;
    const batch: BonusBatch = { id: makeId('batch'), userId: USER_ID, createdAt: nowIso(), timeBudget: minutes, revisionIds: [], endedAt: null };
    const revisions: Revision[] = topics.map((topic, index) => ({ id: `${batch.id}-bonus-${index + 1}`, topicId: topic.id, userId: USER_ID, sequence: index + 1, offsetDays: 0, dueAt: batch.createdAt, kind: 'bonus', bonusBatchId: batch.id, status: 'pending', completedAt: null, createdAt: batch.createdAt }));
    batch.revisionIds = revisions.map((revision) => revision.id);
    state.bonusBatches = [batch, ...state.bonusBatches];
    state.revisions = [...state.revisions, ...revisions];
    persist();
    return batch;
  },
  endBonusBatch(batchId: string) {
    const batch = state.bonusBatches.find((item) => item.id === batchId);
    if (!batch) return;
    batch.endedAt = nowIso();
    persist();
  },
  async updateSettings(changes: Partial<Pick<Settings, 'timezone' | 'dailyTarget' | 'theme' | 'animationsEnabled'>>) {
    if (apiEnabled) {
      const response = await apiRequest('/api/settings', { method: 'PATCH', body: JSON.stringify(changes) });
      if (response.ok) { await store.hydrateFromApi(); return; }
    }
    state.settings = { ...state.settings, ...changes };
    persist();
  },
  search(query: string): Topic[] {
    const normalized = query.trim().toLocaleLowerCase();
    return state.topics.filter((topic) => !normalized || `${topic.subject} ${topic.title}`.toLocaleLowerCase().includes(normalized)).slice(0, 50);
  },
  exportData(): string {
    return JSON.stringify({ schemaVersion: 1, exportedAt: nowIso(), ...state }, null, 2);
  },
  async importData(raw: string): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const incoming = JSON.parse(raw) as Partial<AppData> & { schemaVersion?: number };
      if (incoming.schemaVersion !== 1 || !incoming.settings || !Array.isArray(incoming.topics) || !Array.isArray(incoming.revisions) || !Array.isArray(incoming.completionEvents)) return { ok: false, message: 'This file is not a valid Retain export.' };
      if (incoming.topics.some((topic) => !topic.id || !topic.subject || !topic.title) || incoming.revisions.some((revision) => !revision.id || !revision.topicId)) return { ok: false, message: 'The export contains an invalid topic or revision.' };
      const topicIds = new Set(incoming.topics.map((topic) => topic.id));
      if (incoming.revisions.some((revision) => !topicIds.has(revision.topicId))) return { ok: false, message: 'A revision refers to a missing topic.' };
      const importedTopics = incoming.topics as Topic[];
      state = { settings: { ...state.settings, ...incoming.settings }, subjects: incoming.subjects ?? [...new Set(importedTopics.map((topic) => topic.subject))], topics: importedTopics, revisions: incoming.revisions as Revision[], completionEvents: incoming.completionEvents as CompletionEvent[], bonusBatches: incoming.bonusBatches ?? [] };
      persist();

      if (apiEnabled) {
        const response = await apiRequest('/api/import', { method: 'POST', body: raw });
        if (response.ok) {
          await store.hydrateFromApi();
        }
      }
      return { ok: true };
    } catch {
      return { ok: false, message: 'Choose a JSON export file to restore your data.' };
    }
  },
  async reset() {
    state = defaultData();
    persist();
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    if (apiEnabled) {
      const response = await apiRequest('/api/reset', { method: 'POST', body: JSON.stringify({ confirmation: 'RESET RETAIN' }) });
      if (response.ok) {
        await store.hydrateFromApi();
      }
    }
  },
  async hydrateFromApi() {
    if (!apiEnabled) return;
    const response = await apiRequest('/api/export');
    if (!response.ok) return;
    const result = await response.json() as { data?: AppData };
    if (result.data) { state = result.data; persist(); }
  },
};

export function currentSummary(): ReturnType<typeof dashboardSummary> { return dashboardSummary(state); }

// Avoid coupling the data module to React while still offering a convenient subscription hook.
export function subscribeToStore(listener: () => void) { return store.subscribe(listener); }

export function resetForTests() { state = defaultData(); }
