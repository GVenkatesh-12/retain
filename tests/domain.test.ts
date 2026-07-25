import { describe, expect, it } from 'vitest';
import { addDaysToDateKey, dateKeyToInstant, localDateKey } from '../src/domain/date';
import { calculateStatistics } from '../src/domain/metrics';
import { dashboardSummary, estimateBonusCount, rankBonusTopics, scheduleForTopic } from '../src/domain/schedule';
import type { AppData, Topic } from '../src/types';

const settings = { userId: 'test', timezone: 'America/New_York', dailyTarget: 15, theme: 'system' as const, animationsEnabled: true, createdAt: '2025-01-01T12:00:00Z', updatedAt: '2025-01-01T12:00:00Z' };
const topic: Topic = { id: 'topic-1', userId: 'test', subject: 'Biology', title: 'Cell membranes', createdAt: '2025-01-01T16:00:00Z', archivedAt: null };
const base = (): AppData => ({ settings, subjects: ['Biology'], topics: [topic], revisions: scheduleForTopic(topic, settings.timezone), completionEvents: [], bonusBatches: [] });

describe('date-safe scheduling', () => {
  it('adds calendar days across month boundaries', () => expect(addDaysToDateKey('2025-01-30', 3)).toBe('2025-02-02'));
  it('stores an instant that resolves to the intended local date', () => {
    const instant = dateKeyToInstant('2025-07-25', 'Asia/Kolkata');
    expect(localDateKey(new Date(instant), 'Asia/Kolkata')).toBe('2025-07-25');
  });
  it('creates exactly the six documented offsets', () => expect(scheduleForTopic(topic, settings.timezone).map((revision) => revision.offsetDays)).toEqual([3, 5, 7, 12, 20, 30]));
  it('counts late pending revisions as due', () => {
    const data = base();
    const summary = dashboardSummary(data, new Date('2025-01-09T15:00:00Z'));
    expect(summary.dueCount).toBe(3);
    expect(summary.remaining).toBe(3);
  });
});

describe('bonus and metrics', () => {
  it('turns time into a bounded estimate', () => {
    expect(estimateBonusCount(0)).toBe(0);
    expect(estimateBonusCount(10)).toBe(5);
    expect(estimateBonusCount(60)).toBe(20);
  });
  it('ranks bonus candidates deterministically', () => {
    const data = base();
    data.revisions.forEach((revision) => { revision.status = 'completed'; revision.completedAt = '2025-02-01T15:00:00Z'; });
    const first = rankBonusTopics(data, 1, new Date('2025-02-10T15:00:00Z'));
    const second = rankBonusTopics(data, 1, new Date('2025-02-10T15:00:00Z'));
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
  });
  it('calculates a current and longest streak from completion events', () => {
    const data = base();
    data.completionEvents = ['2025-02-08', '2025-02-09', '2025-02-10'].map((date, index) => ({ id: String(index), userId: 'test', revisionId: String(index), topicId: topic.id, kind: 'mandatory' as const, completedAt: `${date}T15:00:00Z`, localDate: date, bonusBatchId: null }));
    const stats = calculateStatistics(data, new Date('2025-02-10T15:00:00Z'));
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });
});
