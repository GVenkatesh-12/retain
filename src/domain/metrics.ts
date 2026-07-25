import type { AppData, Statistics } from '../types';
import { addDaysToDateKey, daysBetween, localDateKey } from './date';
import { isMaintenanceTopic } from './schedule';

function consecutiveEndingAt(dates: Set<string>, end: string): number {
  let count = 0;
  let cursor = end;
  while (dates.has(cursor)) {
    count += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }
  return count;
}

function longestRun(dates: Set<string>): number {
  return [...dates].reduce((best, date) => Math.max(best, consecutiveEndingAt(dates, date)), 0);
}

export function calculateStatistics(data: AppData, now = new Date()): Statistics {
  const { timezone } = data.settings;
  const today = localDateKey(now, timezone);
  const completed = data.completionEvents;
  const dates = new Set(completed.map((event) => event.localDate));
  const currentStreak = dates.has(today) ? consecutiveEndingAt(dates, today) : consecutiveEndingAt(dates, addDaysToDateKey(today, -1));
  const subjectCounts = new Map<string, number>();
  completed.forEach((event) => {
    const topic = data.topics.find((candidate) => candidate.id === event.topicId);
    if (topic) subjectCounts.set(topic.subject, (subjectCounts.get(topic.subject) ?? 0) + 1);
  });
  const subjects = [...subjectCounts.entries()].map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count);
  const topicCounts = new Map<string, number>();
  completed.forEach((event) => topicCounts.set(event.topicId, (topicCounts.get(event.topicId) ?? 0) + 1));
  const mostTopicId = [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mostStudiedTopic = data.topics.find((topic) => topic.id === mostTopicId)?.title ?? null;
  const firstDate = [...dates].sort()[0] ?? today;
  const rangeStart = addDaysToDateKey(today, -27);
  const daily = Array.from({ length: 28 }, (_, index) => {
    const date = addDaysToDateKey(rangeStart, index);
    return {
      date,
      completions: completed.filter((event) => event.localDate === date).length,
      topicsAdded: data.topics.filter((topic) => localDateKey(new Date(topic.createdAt), timezone) === date).length,
    };
  });
  const mandatoryTotal = data.revisions.filter((revision) => revision.kind === 'mandatory').length;
  const mandatoryCompleted = completed.filter((event) => event.kind === 'mandatory').length;
  const bonusCompleted = completed.filter((event) => event.kind === 'bonus').length;
  return {
    totalTopics: data.topics.length,
    totalRevisions: data.revisions.length,
    completedRevisions: completed.length,
    mandatoryCompleted,
    bonusCompleted,
    completionRate: mandatoryTotal ? mandatoryCompleted / mandatoryTotal : 0,
    currentStreak,
    longestStreak: longestRun(dates),
    averagePerDay: completed.length / Math.max(daysBetween(firstDate, today) + 1, 1),
    mostStudiedSubject: subjects[0]?.subject ?? null,
    mostRevisedTopic: mostStudiedTopic,
    daily,
    subjects,
  };
}

export function maintenanceCount(data: AppData): number {
  return data.topics.filter((topic) => isMaintenanceTopic(topic.id, data.revisions)).length;
}
