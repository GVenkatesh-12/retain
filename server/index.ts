import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { createClient } from '@openauthjs/openauth/client';
import { subjects } from '../auth/subjects.js';
import { addDaysToDateKey, dateKeyToInstant, isValidTimezone, localDateKey } from '../src/domain/date.js';
import { calculateStatistics } from '../src/domain/metrics.js';
import { dashboardSummary, estimateBonusCount, isMaintenanceTopic, rankBonusTopics, scheduleForTopic } from '../src/domain/schedule.js';
import { execute, migrate, query, transaction } from './db.js';
import type { AppData, BonusBatch, CompletionEvent, Revision, Settings, Topic } from '../src/types.js';

const app = new Hono<{ Variables: { retainUserId: string } }>();
const installationUser = process.env.RETAIN_USER_ID ?? 'local-user';
const authClient = process.env.OPENAUTH_ISSUER ? createClient({ clientID: 'retain-api', issuer: process.env.OPENAUTH_ISSUER }) : null;
const nowIso = () => new Date().toISOString();
const json = (c: any, data: unknown, status = 200) => c.json({ data }, status);
const fail = (c: any, code: string, message: string, status = 400, fields?: Record<string, string>) => c.json({ error: { code, message, requestId: randomUUID(), ...(fields ? { fields } : {}) } }, status);

function getHeader(c: any, name: string): string {
  const v1 = c.req.header(name); if (typeof v1 === 'string' && v1.trim()) return v1.trim();
  const v2 = c.req.header(name.toLowerCase()); if (typeof v2 === 'string' && v2.trim()) return v2.trim();
  const titleCase = name.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join('-');
  const v3 = c.req.header(titleCase); if (typeof v3 === 'string' && v3.trim()) return v3.trim();
  return '';
}

function userId(c: any): string { return c.get('retainUserId') || getHeader(c, 'x-retain-user-id') || installationUser; }
function stringValue(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function rowString(row: Record<string, unknown>, key: string): string { return String(row[key] ?? ''); }
function rowNullable(row: Record<string, unknown>, key: string): string | null { return row[key] == null ? null : String(row[key]); }

async function ensureSettings(id: string): Promise<Settings> {
  const current = (await query('SELECT * FROM app_settings WHERE user_id = :user_id', { user_id: id }))[0];
  if (current) return { userId: id, timezone: rowString(current, 'timezone'), dailyTarget: Number(current.daily_target), theme: rowString(current, 'theme') as Settings['theme'], animationsEnabled: Boolean(current.animations_enabled), createdAt: rowString(current, 'created_at'), updatedAt: rowString(current, 'updated_at') };
  const now = nowIso();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  await execute('INSERT INTO app_settings (user_id, timezone, daily_target, theme, animations_enabled, created_at, updated_at) VALUES (:user_id, :timezone, 15, \'system\', 1, :created_at, :updated_at)', { user_id: id, timezone, created_at: now, updated_at: now });
  return { userId: id, timezone, dailyTarget: 15, theme: 'system', animationsEnabled: true, createdAt: now, updatedAt: now };
}

async function loadData(id: string): Promise<AppData> {
  const settings = await ensureSettings(id);
  const [topicRows, revisionRows, eventRows] = await Promise.all([
    query('SELECT * FROM topics WHERE user_id = :user_id ORDER BY created_at DESC', { user_id: id }),
    query('SELECT * FROM revisions WHERE user_id = :user_id ORDER BY due_at ASC', { user_id: id }),
    query('SELECT * FROM completion_events WHERE user_id = :user_id ORDER BY completed_at ASC', { user_id: id }),
  ]);
  const topics: Topic[] = topicRows.map((row) => ({ id: rowString(row, 'id'), userId: id, subject: rowString(row, 'subject'), title: rowString(row, 'title'), createdAt: rowString(row, 'created_at'), archivedAt: rowNullable(row, 'archived_at') }));
  const revisions: Revision[] = revisionRows.map((row) => ({ id: rowString(row, 'id'), topicId: rowString(row, 'topic_id'), userId: id, sequence: Number(row.sequence), offsetDays: Number(row.offset_days), dueAt: rowString(row, 'due_at'), kind: rowString(row, 'kind') as Revision['kind'], bonusBatchId: rowNullable(row, 'bonus_batch_id'), status: rowString(row, 'status') as Revision['status'], completedAt: rowNullable(row, 'completed_at'), createdAt: rowString(row, 'created_at') }));
  const completionEvents: CompletionEvent[] = eventRows.map((row) => ({ id: rowString(row, 'id'), userId: id, revisionId: rowString(row, 'revision_id'), topicId: rowString(row, 'topic_id'), kind: rowString(row, 'kind') as CompletionEvent['kind'], completedAt: rowString(row, 'completed_at'), localDate: rowString(row, 'local_date'), bonusBatchId: rowNullable(row, 'bonus_batch_id') }));
  const batches = [...new Set(revisions.map((revision) => revision.bonusBatchId).filter((batch): batch is string => Boolean(batch)))].map((id): BonusBatch => ({ id, userId: settings.userId, createdAt: revisions.find((revision) => revision.bonusBatchId === id)?.createdAt ?? nowIso(), timeBudget: 0, revisionIds: revisions.filter((revision) => revision.bonusBatchId === id).map((revision) => revision.id), endedAt: null }));
  return { settings, subjects: [...new Set(topics.map((topic) => topic.subject))], topics, revisions, completionEvents, bonusBatches: batches };
}

app.use('*', async (_c, next) => { await migrate(); await next(); });

app.get('/api/health', async (c) => { await query('SELECT 1 AS ok'); return json(c, { status: 'ok', database: 'connected' }); });

app.use('/api/*', async (c, next) => {
  if (!authClient) return next();
  const header = c.req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return fail(c, 'unauthorized', 'Sign in to access Retain.', 401);
  const verified = await authClient.verify(subjects, token);
  if (verified.err) return fail(c, 'unauthorized', 'Your session has expired. Sign in again.', 401);
  c.set('retainUserId', verified.subject.properties.id);
  return next();
});

app.get('/api/settings', async (c) => json(c, await ensureSettings(userId(c))));
app.patch('/api/settings', async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return fail(c, 'invalid_json', 'Request body must be JSON.');
  const updates: string[] = []; const args: Record<string, string | number | null> = { user_id: userId(c), updated_at: nowIso() };
  if (body.timezone !== undefined) { const timezone = stringValue(body.timezone); if (!isValidTimezone(timezone)) return fail(c, 'invalid_timezone', 'Choose a valid IANA timezone.', 422); updates.push('timezone = :timezone'); args.timezone = timezone; }
  if (body.dailyTarget !== undefined) { const target = Number(body.dailyTarget); if (!Number.isInteger(target) || target < 1 || target > 100) return fail(c, 'invalid_target', 'Daily target must be an integer from 1 to 100.', 422); updates.push('daily_target = :daily_target'); args.daily_target = target; }
  if (body.theme !== undefined) { const theme = stringValue(body.theme); if (!['system', 'light', 'dark'].includes(theme)) return fail(c, 'invalid_theme', 'Theme must be system, light, or dark.', 422); updates.push('theme = :theme'); args.theme = theme; }
  if (body.animationsEnabled !== undefined) { updates.push('animations_enabled = :animations_enabled'); args.animations_enabled = body.animationsEnabled ? 1 : 0; }
  if (updates.length) await execute(`UPDATE app_settings SET ${updates.join(', ')}, updated_at = :updated_at WHERE user_id = :user_id`, args);
  return json(c, await ensureSettings(userId(c)));
});

app.get('/api/dashboard', async (c) => {
  const data = await loadData(userId(c));
  const date = c.req.query('date');
  const now = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : new Date();
  return json(c, dashboardSummary(data, now));
});

async function checkIdempotency(c: any, key: string, uid: string): Promise<Response | null> {
  if (!key) return null;
  try {
    const rows = await query('SELECT response_body, status_code FROM idempotency_keys WHERE key = :key AND user_id = :user_id', { key, user_id: uid });
    if (rows[0]) {
      const parsed = JSON.parse(String(rows[0].response_body));
      return c.json(parsed, Number(rows[0].status_code) as any);
    }
  } catch (err) {
    console.error('checkIdempotency error:', err);
  }
  return null;
}

async function saveIdempotency(key: string, uid: string, statusCode: number, body: unknown) {
  if (!key) return;
  try {
    await execute('INSERT OR REPLACE INTO idempotency_keys (key, user_id, response_body, status_code, created_at) VALUES (:key, :user_id, :response_body, :status_code, :created_at)', {
      key, user_id: uid, response_body: JSON.stringify({ data: body }), status_code: statusCode, created_at: nowIso()
    });
  } catch (err) {
    console.error('saveIdempotency error:', err);
  }
}

app.post('/api/topics', async (c) => {
  const uid = userId(c);
  const idempotencyKey = getHeader(c, 'idempotency-key') || getHeader(c, 'x-idempotency-key');
  if (idempotencyKey) {
    const cached = await checkIdempotency(c, idempotencyKey, uid);
    if (cached) return cached;
  }
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const subject = stringValue(body?.subject); const title = stringValue(body?.title);
  if (!subject || subject.length > 120 || !title || title.length > 240 || /[\u0000-\u001f]/.test(`${subject}${title}`)) return fail(c, 'invalid_topic', 'Subject and title are required and must be within their length limits.', 422);
  const settings = await ensureSettings(uid);
  const rawDate = stringValue(body?.createdAt) || stringValue(body?.startDate);
  const createdAt = rawDate ? (/^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? dateKeyToInstant(rawDate, settings.timezone) : new Date(rawDate).toISOString()) : nowIso();
  const id = randomUUID(); const topic: Topic = { id, userId: uid, subject, title, createdAt, archivedAt: null }; const revisions = scheduleForTopic(topic, settings.timezone);
  await transaction([{ sql: 'INSERT INTO topics (id, user_id, subject, title, created_at) VALUES (:id, :user_id, :subject, :title, :created_at)', args: { id, user_id: topic.userId, subject, title, created_at: createdAt } }, ...revisions.map((revision) => ({ sql: 'INSERT INTO revisions (id, topic_id, user_id, sequence, offset_days, due_at, kind, status, created_at) VALUES (:id, :topic_id, :user_id, :sequence, :offset_days, :due_at, :kind, :status, :created_at)', args: { id: revision.id, topic_id: id, user_id: topic.userId, sequence: revision.sequence, offset_days: revision.offsetDays, due_at: revision.dueAt, kind: revision.kind, status: revision.status, created_at: createdAt } }))]);
  const resData = { topic, revisions };
  if (idempotencyKey) await saveIdempotency(idempotencyKey, uid, 201, resData);
  return json(c, resData, 201);
});

app.get('/api/topics', async (c) => { const q = stringValue(c.req.query('q')); const args: Record<string, string | number | null> = { user_id: userId(c) }; const where = q ? 'AND (subject LIKE :q OR title LIKE :q)' : ''; if (q) args.q = `%${q}%`; return json(c, await query(`SELECT id, user_id AS userId, subject, title, created_at AS createdAt, archived_at AS archivedAt FROM topics WHERE user_id = :user_id ${where} ORDER BY created_at DESC LIMIT 50`, args)); });
app.get('/api/topics/:id', async (c) => { const id = c.req.param('id'); const rows = await query('SELECT id, user_id AS userId, subject, title, created_at AS createdAt, archived_at AS archivedAt FROM topics WHERE id = :id AND user_id = :user_id', { id, user_id: userId(c) }); if (!rows[0]) return fail(c, 'not_found', 'Topic not found.', 404); return json(c, { topic: rows[0], revisions: await query('SELECT id, topic_id AS topicId, user_id AS userId, sequence, offset_days AS offsetDays, due_at AS dueAt, kind, bonus_batch_id AS bonusBatchId, status, completed_at AS completedAt, duration_seconds AS durationSeconds, created_at AS createdAt FROM revisions WHERE topic_id = :id AND user_id = :user_id ORDER BY sequence', { id, user_id: userId(c) }) }); });

app.patch('/api/topics/:id', async (c) => {
  const id = c.req.param('id'); const uid = userId(c); const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const subject = stringValue(body?.subject); const title = stringValue(body?.title);
  if (!subject || subject.length > 120 || !title || title.length > 240) return fail(c, 'invalid_topic', 'Subject and title are required.', 422);
  const settings = await ensureSettings(uid); const rawDate = stringValue(body?.createdAt) || stringValue(body?.startDate);
  const existing = await query('SELECT id, created_at FROM topics WHERE id = :id AND user_id = :user_id', { id, user_id: uid });
  if (!existing[0]) return fail(c, 'not_found', 'Topic not found.', 404);
  const createdAt = rawDate ? (/^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? dateKeyToInstant(rawDate, settings.timezone) : new Date(rawDate).toISOString()) : rowString(existing[0], 'created_at');
  const updatedTopic: Topic = { id, userId: uid, subject, title, createdAt, archivedAt: null };
  const newRevisions = scheduleForTopic(updatedTopic, settings.timezone);
  await transaction([
    { sql: 'UPDATE topics SET subject = :subject, title = :title, created_at = :created_at WHERE id = :id AND user_id = :user_id', args: { id, user_id: uid, subject, title, created_at: createdAt } },
    ...newRevisions.map((rev) => ({ sql: 'UPDATE revisions SET due_at = :due_at, created_at = :created_at WHERE topic_id = :topic_id AND sequence = :sequence AND user_id = :user_id', args: { topic_id: id, sequence: rev.sequence, user_id: uid, due_at: rev.dueAt, created_at: createdAt } }))
  ]);
  return json(c, { topic: updatedTopic });
});

app.delete('/api/topics/:id', async (c) => {
  const id = c.req.param('id'); const uid = userId(c);
  await transaction([
    { sql: 'DELETE FROM completion_events WHERE topic_id = :id AND user_id = :user_id', args: { id, user_id: uid } },
    { sql: 'DELETE FROM revisions WHERE topic_id = :id AND user_id = :user_id', args: { id, user_id: uid } },
    { sql: 'DELETE FROM topics WHERE id = :id AND user_id = :user_id', args: { id, user_id: uid } }
  ]);
  return json(c, { deleted: true });
});

app.post('/api/revisions/:id/complete', async (c) => {
  const id = c.req.param('id'); const uid = userId(c);
  const idempotencyKey = getHeader(c, 'idempotency-key') || getHeader(c, 'x-idempotency-key');
  if (idempotencyKey) {
    const cached = await checkIdempotency(c, idempotencyKey, uid);
    if (cached) return cached;
  }
  const data = await loadData(uid); const revision = data.revisions.find((item) => item.id === id); if (!revision) return fail(c, 'not_found', 'Revision not found.', 404); if (revision.status === 'completed') return json(c, { revision, summary: dashboardSummary(data) });
  if (revision.kind === 'mandatory' && localDateKey(new Date(revision.dueAt), data.settings.timezone) > localDateKey(new Date(), data.settings.timezone)) return fail(c, 'not_due', 'This revision is not due yet.', 422);
  const completedAt = nowIso(); const localDate = localDateKey(new Date(completedAt), data.settings.timezone);
  await transaction([
    { sql: 'UPDATE revisions SET status = \'completed\', completed_at = :completed_at WHERE id = :id AND user_id = :user_id AND status = \'pending\'', args: { id, user_id: uid, completed_at: completedAt } },
    { sql: 'INSERT OR IGNORE INTO completion_events (id, user_id, revision_id, topic_id, kind, completed_at, local_date, bonus_batch_id) VALUES (:event_id, :user_id, :revision_id, :topic_id, :kind, :completed_at, :local_date, :bonus_batch_id)', args: { event_id: randomUUID(), user_id: uid, revision_id: id, topic_id: revision.topicId, kind: revision.kind, completed_at: completedAt, local_date: localDate, bonus_batch_id: revision.bonusBatchId ?? null } }
  ]);
  const updated = await loadData(uid);
  const resData = { revision: updated.revisions.find((item) => item.id === id), summary: dashboardSummary(updated) };
  if (idempotencyKey) await saveIdempotency(idempotencyKey, uid, 200, resData);
  return json(c, resData, 200);
});

app.post('/api/bonus-batches', async (c) => { const body = await c.req.json().catch(() => null) as Record<string, unknown> | null; const minutes = Number(body?.minutes); if (![0, 10, 20, 30, 60].includes(minutes) || minutes === 0) return fail(c, 'invalid_time_budget', 'Time budget must be 10, 20, 30, or 60 minutes.', 422); const data = await loadData(userId(c)); const topics = rankBonusTopics(data, estimateBonusCount(minutes)); if (!topics.length) return json(c, null); const batchId = randomUUID(); const createdAt = nowIso(); const revisions = topics.map((topic, index) => ({ id: `${batchId}-${index + 1}`, topic, sequence: index + 1 })); await transaction(revisions.map(({ id, topic, sequence }) => ({ sql: 'INSERT INTO revisions (id, topic_id, user_id, sequence, offset_days, due_at, kind, bonus_batch_id, status, created_at) VALUES (:id, :topic_id, :user_id, :sequence, 0, :due_at, \'bonus\', :bonus_batch_id, \'pending\', :created_at)', args: { id, topic_id: topic.id, user_id: userId(c), sequence, due_at: createdAt, bonus_batch_id: batchId, created_at: createdAt } }))); return json(c, { id: batchId, timeBudget: minutes, revisionIds: revisions.map((revision) => revision.id) }, 201); });
app.post('/api/bonus-batches/:id/complete', async (c) => { const batchId = c.req.param('id'); const body = await c.req.json().catch(() => null) as Record<string, unknown> | null; const revisionId = stringValue(body?.revisionId) || (await query('SELECT id FROM revisions WHERE bonus_batch_id = :batch_id AND user_id = :user_id AND status = \'pending\' ORDER BY sequence LIMIT 1', { batch_id: batchId, user_id: userId(c) }))[0]?.id?.toString(); if (!revisionId) return fail(c, 'not_found', 'No pending revision remains in this batch.', 404); const response = await app.request(new Request(new URL(`/api/revisions/${revisionId}/complete`, c.req.url), { method: 'POST', headers: { 'x-retain-user-id': userId(c) } })); return response; });
app.get('/api/statistics', async (c) => json(c, calculateStatistics(await loadData(userId(c)))));
app.get('/api/export', async (c) => { const data = await loadData(userId(c)); return json(c, { schemaVersion: 1, exportedAt: nowIso(), ...data }); });
app.post('/api/import/validate', async (c) => { const body = await c.req.json().catch(() => null) as Record<string, unknown> | null; if (!body || body.schemaVersion !== 1 || !Array.isArray(body.topics) || !Array.isArray(body.revisions) || !Array.isArray(body.completionEvents)) return fail(c, 'invalid_export', 'This file is not a valid Retain export.', 422); return json(c, { valid: true, topics: body.topics.length, revisions: body.revisions.length, completionEvents: body.completionEvents.length }); });

app.post('/api/import', async (c) => {
  const uid = userId(c);
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || body.schemaVersion !== 1 || !Array.isArray(body.topics) || !Array.isArray(body.revisions) || !Array.isArray(body.completionEvents)) {
    return fail(c, 'invalid_export', 'This file is not a valid Retain export.', 422);
  }

  const topics = body.topics as Array<Record<string, unknown>>;
  const revisions = body.revisions as Array<Record<string, unknown>>;
  const completionEvents = body.completionEvents as Array<Record<string, unknown>>;
  const settings = body.settings as Record<string, unknown> | undefined;

  const statements: Array<{ sql: string; args?: Record<string, string | number | null> }> = [
    { sql: 'DELETE FROM completion_events WHERE user_id = :user_id', args: { user_id: uid } },
    { sql: 'DELETE FROM revisions WHERE user_id = :user_id', args: { user_id: uid } },
    { sql: 'DELETE FROM topics WHERE user_id = :user_id', args: { user_id: uid } },
  ];

  if (settings && typeof settings === 'object') {
    const timezone = stringValue(settings.timezone) || 'UTC';
    const dailyTarget = Number(settings.dailyTarget) || 15;
    const theme = stringValue(settings.theme) || 'system';
    const animationsEnabled = settings.animationsEnabled ? 1 : 0;
    const now = nowIso();
    statements.push({
      sql: 'INSERT OR REPLACE INTO app_settings (user_id, timezone, daily_target, theme, animations_enabled, created_at, updated_at) VALUES (:user_id, :timezone, :daily_target, :theme, :animations_enabled, :created_at, :updated_at)',
      args: { user_id: uid, timezone, daily_target: dailyTarget, theme, animations_enabled: animationsEnabled, created_at: now, updated_at: now }
    });
  }

  for (const t of topics) {
    statements.push({
      sql: 'INSERT INTO topics (id, user_id, subject, title, created_at, archived_at) VALUES (:id, :user_id, :subject, :title, :created_at, :archived_at)',
      args: {
        id: stringValue(t.id),
        user_id: uid,
        subject: stringValue(t.subject),
        title: stringValue(t.title),
        created_at: stringValue(t.createdAt) || nowIso(),
        archived_at: t.archivedAt ? stringValue(t.archivedAt) : null,
      }
    });
  }

  for (const r of revisions) {
    statements.push({
      sql: 'INSERT INTO revisions (id, topic_id, user_id, sequence, offset_days, due_at, kind, bonus_batch_id, status, completed_at, duration_seconds, created_at) VALUES (:id, :topic_id, :user_id, :sequence, :offset_days, :due_at, :kind, :bonus_batch_id, :status, :completed_at, :duration_seconds, :created_at)',
      args: {
        id: stringValue(r.id),
        topic_id: stringValue(r.topicId),
        user_id: uid,
        sequence: Number(r.sequence) || 1,
        offset_days: Number(r.offsetDays) || 0,
        due_at: stringValue(r.dueAt),
        kind: stringValue(r.kind) === 'bonus' ? 'bonus' : 'mandatory',
        bonus_batch_id: r.bonusBatchId ? stringValue(r.bonusBatchId) : null,
        status: stringValue(r.status) === 'completed' ? 'completed' : 'pending',
        completed_at: r.completedAt ? stringValue(r.completedAt) : null,
        duration_seconds: r.durationSeconds != null ? Number(r.durationSeconds) : null,
        created_at: stringValue(r.createdAt) || nowIso(),
      }
    });
  }

  for (const e of completionEvents) {
    statements.push({
      sql: 'INSERT OR IGNORE INTO completion_events (id, user_id, revision_id, topic_id, kind, completed_at, local_date, bonus_batch_id) VALUES (:id, :user_id, :revision_id, :topic_id, :kind, :completed_at, :local_date, :bonus_batch_id)',
      args: {
        id: stringValue(e.id),
        user_id: uid,
        revision_id: stringValue(e.revisionId),
        topic_id: stringValue(e.topicId),
        kind: stringValue(e.kind) === 'bonus' ? 'bonus' : 'mandatory',
        completed_at: stringValue(e.completedAt) || nowIso(),
        local_date: stringValue(e.localDate),
        bonus_batch_id: e.bonusBatchId ? stringValue(e.bonusBatchId) : null,
      }
    });
  }

  await transaction(statements);
  return json(c, { imported: true, topics: topics.length, revisions: revisions.length, completionEvents: completionEvents.length });
});
app.post('/api/reset', async (c) => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const confirmation = stringValue(body?.confirmation).toUpperCase();
  if (confirmation !== 'RESET RETAIN') return fail(c, 'confirmation_required', 'Type RESET RETAIN to confirm.', 422);
  const uid = userId(c);
  await transaction([
    { sql: 'DELETE FROM completion_events WHERE user_id = :user_id', args: { user_id: uid } },
    { sql: 'DELETE FROM revisions WHERE user_id = :user_id', args: { user_id: uid } },
    { sql: 'DELETE FROM topics WHERE user_id = :user_id', args: { user_id: uid } },
    { sql: 'DELETE FROM app_settings WHERE user_id = :user_id', args: { user_id: uid } },
    { sql: 'DELETE FROM idempotency_keys WHERE user_id = :user_id', args: { user_id: uid } }
  ]);
  return json(c, { reset: true });
});

serve({ fetch: app.fetch, port: Number(process.env.API_PORT ?? 8787), hostname: process.env.API_HOST ?? '127.0.0.1' }, (info) => console.info(`Retain API listening on http://${info.address}:${info.port}`));
