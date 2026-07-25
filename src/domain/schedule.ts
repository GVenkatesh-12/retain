import type { AppData, DashboardSummary, Revision, Topic } from '../types';
import { addDaysToDateKey, dateKeyToInstant, daysBetween, localDateKey } from './date';

export const SCHEDULE_OFFSETS = [3, 5, 7, 12, 20, 30] as const;

export function scheduleForTopic(topic: Topic, timezone: string): Revision[] {
  const createdDate = localDateKey(new Date(topic.createdAt), timezone);
  return SCHEDULE_OFFSETS.map((offset, index) => ({
    id: `${topic.id}-mandatory-${index + 1}`,
    topicId: topic.id,
    userId: topic.userId,
    sequence: index + 1,
    offsetDays: offset,
    dueAt: dateKeyToInstant(addDaysToDateKey(createdDate, offset), timezone),
    kind: 'mandatory' as const,
    bonusBatchId: null,
    status: 'pending' as const,
    completedAt: null,
    createdAt: topic.createdAt,
  }));
}

export function isDue(revision: Revision, today: string, timezone: string): boolean {
  return revision.status === 'pending' && localDateKey(new Date(revision.dueAt), timezone) <= today;
}

export function isMaintenanceTopic(topicId: string, revisions: Revision[]): boolean {
  const mandatory = revisions.filter((revision) => revision.topicId === topicId && revision.kind === 'mandatory');
  return mandatory.length === SCHEDULE_OFFSETS.length && mandatory.every((revision) => revision.status === 'completed');
}

export function dashboardSummary(data: AppData, now = new Date()): DashboardSummary {
  const { timezone, dailyTarget } = data.settings;
  const date = localDateKey(now, timezone);
  const mandatory = data.revisions.filter((revision) => revision.kind === 'mandatory');
  const dueAll = mandatory.filter((revision) => localDateKey(new Date(revision.dueAt), timezone) <= date);
  const due = dueAll.filter((revision) => revision.status === 'pending');
  const completedDueCount = dueAll.filter((revision) => revision.status === 'completed').length;
  const topics = new Map(data.topics.map((topic) => [topic.id, topic]));
  due.sort((a, b) => {
    const byDate = a.dueAt.localeCompare(b.dueAt);
    if (byDate !== 0) return byDate;
    const topicA = topics.get(a.topicId);
    const topicB = topics.get(b.topicId);
    return (topicA?.createdAt ?? '').localeCompare(topicB?.createdAt ?? '') || (topicA?.title ?? '').localeCompare(topicB?.title ?? '');
  });
  const completedToday = data.completionEvents.filter((event) => event.localDate === date).length;
  return {
    date,
    due,
    dueCount: dueAll.length,
    completedDueCount,
    remaining: due.length,
    progress: Math.min(completedDueCount / Math.max(dueAll.length, 1), 1),
    completedToday,
    bonusCapacity: Math.max(dailyTarget - dueAll.length, 0),
  };
}

export function estimateBonusCount(minutes: number, averageMinutes = 2): number {
  if (minutes <= 0) return 0;
  return Math.min(20, Math.max(1, Math.floor(minutes / averageMinutes)));
}

function seededValue(topicId: string, date: string): number {
  let hash = 2_166_136_261;
  for (const char of `${topicId}:${date}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

export function rankBonusTopics(data: AppData, requestedCount: number, now = new Date()): Topic[] {
  const { timezone } = data.settings;
  const today = localDateKey(now, timezone);
  const yesterday = addDaysToDateKey(today, -1);
  const maintenance = data.topics.filter((topic) => !topic.archivedAt && isMaintenanceTopic(topic.id, data.revisions));
  const selected = new Set(data.revisions.filter((r) => r.kind === 'bonus' && r.bonusBatchId && r.status === 'pending').map((r) => r.topicId));
  const yesterdayTopics = new Set(data.completionEvents.filter((event) => event.kind === 'bonus' && event.localDate === yesterday).map((event) => event.topicId));
  const todayBonusCounts = new Map<string, number>();
  data.completionEvents.filter((event) => event.kind === 'bonus' && event.localDate === today).forEach((event) => {
    todayBonusCounts.set(event.topicId, (todayBonusCounts.get(event.topicId) ?? 0) + 1);
  });
  const lastRevision = (topicId: string) => data.completionEvents
    .filter((event) => event.topicId === topicId)
    .map((event) => event.localDate)
    .sort()
    .at(-1) ?? today;
  const subjects = new Map<string, number>();
  const scored = maintenance.filter((topic) => !selected.has(topic.id)).map((topic) => {
    const value = seededValue(topic.id, today);
    const days = Math.max(0, daysBetween(lastRevision(topic.id), today));
    const recency = Math.min(days / 30, 1);
    const subjectCount = [...todayBonusCounts.entries()]
      .filter(([topicId]) => data.topics.find((candidate) => candidate.id === topicId)?.subject === topic.subject)
      .reduce((sum, [, count]) => sum + count, 0);
    const selectedCount = [...todayBonusCounts.values()].reduce((sum, count) => sum + count, 0);
    const subjectBalance = 1 - subjectCount / Math.max(selectedCount, 1);
    const yesterdayPenalty = yesterdayTopics.has(topic.id) ? 1 : 0;
    const score = 0.5 * recency + 0.25 * subjectBalance + 0.15 * (1 - yesterdayPenalty) + 0.1 * value;
    return { topic, score, value, last: lastRevision(topic.id) };
  }).sort((a, b) => b.score - a.score || b.value - a.value || a.last.localeCompare(b.last));

  const cap = Math.max(1, Math.ceil(requestedCount / 3));
  const result: Topic[] = [];
  for (const candidate of scored) {
    const count = subjects.get(candidate.topic.subject) ?? 0;
    if (count >= cap && new Set(scored.map((item) => item.topic.subject)).size > 1) continue;
    result.push(candidate.topic);
    subjects.set(candidate.topic.subject, count + 1);
    if (result.length >= requestedCount) break;
  }
  if (result.length < requestedCount) {
    for (const candidate of scored) {
      if (!result.some((topic) => topic.id === candidate.topic.id)) result.push(candidate.topic);
      if (result.length >= requestedCount) break;
    }
  }
  return result;
}
