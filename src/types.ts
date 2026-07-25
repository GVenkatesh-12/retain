export type Theme = 'system' | 'light' | 'dark';
export type RevisionKind = 'mandatory' | 'bonus';
export type RevisionStatus = 'pending' | 'completed';

export interface Settings {
  userId: string;
  timezone: string;
  dailyTarget: number;
  theme: Theme;
  animationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  userId: string;
  subject: string;
  title: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface Revision {
  id: string;
  topicId: string;
  userId: string;
  sequence: number;
  offsetDays: number;
  dueAt: string;
  kind: RevisionKind;
  bonusBatchId: string | null;
  status: RevisionStatus;
  completedAt: string | null;
  createdAt: string;
}

export interface CompletionEvent {
  id: string;
  userId: string;
  revisionId: string;
  topicId: string;
  kind: RevisionKind;
  completedAt: string;
  localDate: string;
  bonusBatchId: string | null;
}

export interface BonusBatch {
  id: string;
  userId: string;
  createdAt: string;
  timeBudget: number;
  revisionIds: string[];
  endedAt: string | null;
}

export interface AppData {
  settings: Settings;
  subjects: string[];
  topics: Topic[];
  revisions: Revision[];
  completionEvents: CompletionEvent[];
  bonusBatches: BonusBatch[];
}

export interface DashboardSummary {
  date: string;
  due: Revision[];
  dueCount: number;
  completedDueCount: number;
  remaining: number;
  progress: number;
  completedToday: number;
  bonusCapacity: number;
}

export interface Statistics {
  totalTopics: number;
  totalRevisions: number;
  completedRevisions: number;
  mandatoryCompleted: number;
  bonusCompleted: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  averagePerDay: number;
  mostStudiedSubject: string | null;
  mostRevisedTopic: string | null;
  daily: Array<{ date: string; completions: number; topicsAdded: number }>;
  subjects: Array<{ subject: string; count: number }>;
}
