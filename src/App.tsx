import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { authEnabled, checkAuth, getUserSession, loginWithPassword, logout } from './auth';
import { subscribeToSyncStatus } from './api';
import { calculateStatistics } from './domain/metrics';
import { addDaysToDateKey, formatDate, isValidTimezone, localDateKey } from './domain/date';
import { dashboardSummary, isMaintenanceTopic } from './domain/schedule';
import { store } from './store';
import type { Revision, Topic } from './types';
import './styles.css';

type Page = 'dashboard' | 'statistics' | 'search' | 'settings';

function useData() {
  return useSyncExternalStore(store.subscribe, () => store.data, () => store.data);
}

function Spinner({ size = 15 }: { size?: number }) {
  return (
    <svg
      className="icon spinner"
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function TopbarSyncIndicator() {
  const [syncState, setSyncState] = useState<{ isSyncing: boolean; lastSavedAt?: number }>({ isSyncing: false });
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    return subscribeToSyncStatus((isSyncing, lastSavedAt) => {
      setSyncState({ isSyncing, lastSavedAt });
      if (!isSyncing && lastSavedAt) {
        setShowSaved(true);
        const t = setTimeout(() => setShowSaved(false), 2200);
        return () => clearTimeout(t);
      }
    });
  }, []);

  if (!syncState.isSyncing && !showSaved) return null;

  return (
    <div className={`topbar-sync-indicator ${syncState.isSyncing ? 'syncing' : 'saved'}`}>
      {syncState.isSyncing ? (
        <>
          <Spinner size={13} />
          <span>Saving to cloud…</span>
        </>
      ) : (
        <>
          <Icon name="check" />
          <span>Cloud updated</span>
        </>
      )}
    </div>
  );
}

function Icon({ name }: { name: 'sun' | 'moon' | 'chart' | 'search' | 'gear' | 'plus' | 'check' | 'arrow' | 'download' | 'upload' | 'book' | 'user' | 'logout' | 'calendar' | 'edit' | 'trash' }) {
  const paths: Record<string, string> = {
    sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z',
    moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
    chart: 'M4 19V5m0 14h16M8 16v-4m4 4V8m4 8V4', search: 'm20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z', gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.2-3.2a7.3 7.3 0 0 0-.1-1.1l1.7-1.3-1.6-2.7-2 .8a7.3 7.3 0 0 0-1.9-1.1L15 4.5h-3.1l-.4 2.1a7.3 7.3 0 0 0-1.9 1.1l-2-.8L6 9.6l1.7 1.3a7.3 7.3 0 0 0 0 2.2L6 14.4l1.6 2.7 2-.8a7.3 7.3 0 0 0 1.9 1.1l.4 2.1H15l.4-2.1a7.3 7.3 0 0 0 1.9-1.1l2 .8 1.6-2.7-1.7-1.3c.1-.4.1-.7.1-1.1Z', plus: 'M12 5v14M5 12h14', check: 'm5 12 4 4L19 6', arrow: 'M5 12h14m-6-6 6 6-6 6', download: 'M12 3v12m0 0 4-4m-4 4-4-4M5 21h14', upload: 'M12 15V3m0 0 4 4m-4-4L8 7M5 21h14', book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Zm0 0A2.5 2.5 0 0 1 6.5 8H20',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
    calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
    trash: 'M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  };
  if (name === 'gear') return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" /><circle cx="12" cy="12" r="5.2" /><circle cx="12" cy="12" r="1.3" /></svg>;
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function Button({ children, variant = 'secondary', onClick, type = 'button', disabled = false, loading = false, className = '' }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; loading?: boolean; className?: string }) {
  return (
    <button className={`button button-${variant} ${loading ? 'is-loading' : ''} ${className}`} type={type} onClick={onClick} disabled={disabled || loading}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

function ProgressRing({ value, completed, total }: { value: number; completed: number; total: number }) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.round(value * 100);
  return <div className="progress-wrap"><svg className="progress-ring" viewBox="0 0 148 148" role="img" aria-label={`${completed} of ${total} mandatory revisions complete`}>
    <defs>
      <linearGradient id="progress-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--accent)" />
        <stop offset="100%" stopColor="var(--accent-dark)" />
      </linearGradient>
    </defs>
    <circle className="progress-track" cx="74" cy="74" r={radius} />
    <circle className="progress-value" cx="74" cy="74" r={radius} stroke="url(#progress-grad)" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value)} />
  </svg><div className="progress-center"><strong>{completed}</strong><span>of {total || 0} ({pct}%)</span></div></div>;
}

function RevisionRow({ revision, topic, timezone, onComplete }: { revision: Revision; topic?: Topic; timezone: string; onComplete: (id: string) => Promise<void> | void }) {
  const [loading, setLoading] = useState(false);
  const handleComplete = async () => {
    setLoading(true);
    await onComplete(revision.id);
    setLoading(false);
  };
  return <div className="revision-row" tabIndex={0}>
    <div className="revision-marker">{revision.sequence}</div>
    <div className="revision-info"><div className="eyebrow">{topic?.subject} <span>·</span> Day {revision.offsetDays}</div><h3>{topic?.title}</h3><p>Due {formatDate(localDateKey(new Date(revision.dueAt), timezone))}</p></div>
    <Button variant="secondary" loading={loading} onClick={handleComplete}>
      {loading ? 'Saving…' : <><Icon name="check" /> Complete</>}
    </Button>
  </div>;
}

function UpcomingRevisionRow({ revision, topic, timezone }: { revision: Revision; topic?: Topic; timezone: string }) {
  const dueDate = localDateKey(new Date(revision.dueAt), timezone);
  return <div className="upcoming-row"><div className="upcoming-date"><strong>{formatDate(dueDate)}</strong><span>Day {revision.offsetDays}</span></div><div className="revision-info"><div className="eyebrow">{topic?.subject}</div><h3>{topic?.title}</h3></div><span className="upcoming-label">Coming up</span></div>;
}

function parseDdMmYy(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatKeyToDdMmYy(key: string): string {
  const [y, m, d] = key.split('-');
  return y && m && d ? `${d}/${m}/${y.slice(-2)}` : '';
}

function CustomDateInput({ valueKey, onChangeKey }: { valueKey: string; onChangeKey: (key: string) => void }) {
  const [displayText, setDisplayText] = useState(() => formatKeyToDdMmYy(valueKey));
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayText(formatKeyToDdMmYy(valueKey));
  }, [valueKey]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let text = e.target.value;
    setDisplayText(text);
    const parsed = parseDdMmYy(text);
    if (parsed) onChangeKey(parsed);
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) onChangeKey(e.target.value);
  };

  const openPicker = (e?: React.MouseEvent | React.FocusEvent) => {
    if (e) e.stopPropagation();
    if (nativeRef.current) {
      try {
        if (typeof nativeRef.current.showPicker === 'function') {
          nativeRef.current.showPicker();
        } else {
          nativeRef.current.focus();
          nativeRef.current.click();
        }
      } catch (err) {
        nativeRef.current.focus();
        nativeRef.current.click();
      }
    }
  };

  return (
    <div className="custom-date-input-wrap">
      <input
        type="text"
        value={displayText}
        onChange={handleTextChange}
        placeholder="DD/MM/YY"
        maxLength={10}
      />
      <div className="calendar-trigger-container" onClick={openPicker}>
        <button
          type="button"
          className="calendar-trigger"
          title="Open calendar picker"
          aria-label="Open calendar picker"
          onClick={openPicker}
        >
          <Icon name="calendar" />
        </button>
        <input
          ref={nativeRef}
          type="date"
          value={valueKey}
          onChange={handleNativeChange}
          onClick={openPicker}
          className="overlay-native-date"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

function AddStudyDialog({ onClose }: { onClose: () => void }) {
  const data = useData();
  const newSubjectValue = '__new_subject__';
  const [subjectChoice, setSubjectChoice] = useState(data.subjects[0] ?? newSubjectValue);
  const [subject, setSubject] = useState(data.subjects[0] ?? '');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => localDateKey(new Date(), data.settings.timezone));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const focusRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      focusRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [subjectChoice]);

  const valid = subject.trim().length > 0 && subject.trim().length <= 120 && title.trim().length > 0 && title.trim().length <= 240;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    await store.addTopic(subject, title, startDate);
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 350);
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubject(e.target.value);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-study-title">
    <div className="modal-heading"><div><span className="eyebrow">New study</span><h2 id="add-study-title">Keep something worth remembering</h2></div><button className="close-button" onClick={onClose} aria-label="Close dialog">×</button></div>
    <form onSubmit={submit}><label>Subject<select ref={subjectChoice !== newSubjectValue ? (focusRef as any) : undefined} value={subjectChoice} onChange={(event) => { const value = event.target.value; setSubjectChoice(value); setSubject(value === newSubjectValue ? '' : value); }} aria-label="Choose a saved subject"><option value={newSubjectValue}>＋ Create a new subject</option>{data.subjects.map((savedSubject) => <option key={savedSubject} value={savedSubject}>{savedSubject}</option>)}</select></label>{subjectChoice === newSubjectValue && <label>New subject<input ref={focusRef as any} value={subject} onChange={handleSubjectChange} placeholder="e.g. Biology, Spanish, Product design" maxLength={120} /></label>}<label>Title<input ref={subjectChoice !== newSubjectValue ? (focusRef as any) : undefined} value={title} onChange={handleTitleChange} placeholder="What do you want to retain?" maxLength={240} /></label><label>Start date (DD/MM/YY)<CustomDateInput valueKey={startDate} onChangeKey={setStartDate} /></label><p className="form-hint">Saved subjects are kept for quick selection. Six quiet check-ins will appear on days 3, 5, 7, 12, 20, and 30 relative to your start date.</p><div className="modal-actions"><Button variant="quiet" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" disabled={!valid || saving} loading={saving}>{saved ? 'Saved' : saving ? 'Saving…' : 'Add study'} {!saving && <Icon name="arrow" />}</Button></div></form>
  </div></div>;
}

function EditStudyDialog({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  const data = useData();
  const [subject, setSubject] = useState(topic.subject);
  const [title, setTitle] = useState(topic.title);
  const getInitialDate = (created: string) => {
    if (!created) return localDateKey(new Date(), data.settings.timezone);
    if (/^\d{4}-\d{2}-\d{2}$/.test(created)) return created;
    const d = new Date(created);
    return !isNaN(d.getTime()) ? localDateKey(d, data.settings.timezone) : localDateKey(new Date(), data.settings.timezone);
  };
  const [startDate, setStartDate] = useState(() => getInitialDate(topic.createdAt));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid = subject.trim().length > 0 && subject.trim().length <= 120 && title.trim().length > 0 && title.trim().length <= 240;

  useEffect(() => {
    setSubject(topic.subject);
    setTitle(topic.title);
    setStartDate(getInitialDate(topic.createdAt));
  }, [topic.id, topic.subject, topic.title, topic.createdAt, data.settings.timezone]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    await store.updateTopic(topic.id, subject, title, startDate);
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 350);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-study-title">
        <div className="modal-heading">
          <div><span className="eyebrow">Edit study</span><h2 id="edit-study-title">Update topic details</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        <form onSubmit={submit}>
          <label>Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Biology" maxLength={120} required />
          </label>
          <label>Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to retain?" maxLength={240} required />
          </label>
          <label>Start date (DD/MM/YY)
            <CustomDateInput valueKey={startDate} onChangeKey={setStartDate} />
          </label>
          <p className="form-hint">Updating the start date will recalculate all 6 check-in due dates relative to the new date.</p>
          <div className="modal-actions">
            <Button variant="quiet" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={!valid || saving} loading={saving}>{saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'} {!saving && <Icon name="arrow" />}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TopicsManageSection({ onEdit }: { onEdit: (topic: Topic) => void }) {
  const data = useData();
  const tz = data.settings.timezone;
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!data.topics.length) return null;

  return (
    <section className="topics-manage-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Library ({data.topics.length})</span>
          <h2>All added topics</h2>
        </div>
      </div>
      <div className="topics-manage-list">
        {data.topics.map((topic) => {
          const createdKey = localDateKey(new Date(topic.createdAt), tz);
          const isConfirming = confirmDeleteId === topic.id;
          return (
            <div key={topic.id} className="topic-manage-card">
              <div className="topic-manage-info">
                <div className="eyebrow-row">
                  <span className="subject-pill">{topic.subject}</span>
                  <span className="date-pill">Added {formatDate(createdKey)}</span>
                </div>
                <h3>{topic.title}</h3>
              </div>
              <div className="topic-manage-actions">
                {isConfirming ? (
                  <div className="delete-confirm-wrap">
                    <span>Delete topic?</span>
                    <Button variant="danger" className="btn-xs" onClick={async () => { await store.deleteTopic(topic.id); setConfirmDeleteId(null); }}>Yes, delete</Button>
                    <Button variant="quiet" className="btn-xs" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    <button className="action-icon-btn" onClick={() => onEdit(topic)} title="Edit study" aria-label="Edit study">
                      <Icon name="edit" />
                    </button>
                    <button className="action-icon-btn danger" onClick={() => setConfirmDeleteId(topic.id)} title="Delete study" aria-label="Delete study">
                      <Icon name="trash" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BonusPrompt({ onCreated }: { onCreated: () => void }) {
  const [choice, setChoice] = useState(0);
  const choices = [0, 10, 20, 30, 60];
  const data = useData();
  const summary = dashboardSummary(data);
  const maintenance = data.topics.filter((topic) => isMaintenanceTopic(topic.id, data.revisions)).length;
  if (!maintenance || summary.remaining > 0) return null;
  const create = async () => { if (choice && await store.createBonusBatch(choice)) onCreated(); };
  return <section className="bonus-card"><div className="bonus-copy"><span className="eyebrow accent">Optional maintenance</span><h2>Want to keep a little momentum?</h2><p>You’re all clear on mandatory work. Pick a small, optional batch if it feels useful.</p><div className="bonus-choices">{choices.map((minutes) => <button key={minutes} className={choice === minutes ? 'selected' : ''} onClick={() => setChoice(minutes)}>{minutes === 0 ? 'No thanks' : minutes === 60 ? '1 hour' : `${minutes} min`}</button>)}</div></div><div className="bonus-side"><span className="sparkle">✦</span><strong>{choice ? `About ${Math.min(20, Math.max(1, Math.floor(choice / 2)))} topics` : 'Your pace, your choice'}</strong><small>an estimate based on 2 minutes each</small>{choice > 0 && <Button variant="primary" onClick={create}>Choose batch <Icon name="arrow" /></Button>}</div></section>;
}

function ActiveBonus({ onComplete }: { onComplete: (id: string) => void }) {
  const data = useData();
  const batch = data.bonusBatches.find((candidate) => !candidate.endedAt && candidate.revisionIds.some((id) => data.revisions.find((revision) => revision.id === id)?.status === 'pending'));
  if (!batch) return null;
  const revisions = batch.revisionIds.map((id) => data.revisions.find((revision) => revision.id === id)).filter((revision): revision is Revision => Boolean(revision && revision.status === 'pending'));
  return <section className="active-bonus"><div><span className="eyebrow accent">Optional batch · {batch.timeBudget} min</span><h2>A little extra, if you’re here for it</h2></div><div className="bonus-list">{revisions.map((revision) => <RevisionRow key={revision.id} revision={revision} timezone={data.settings.timezone} topic={data.topics.find((topic) => topic.id === revision.topicId)} onComplete={onComplete} />)}</div><Button variant="quiet" onClick={() => store.endBonusBatch(batch.id)}>End optional batch</Button></section>;
}

function Dashboard({ onAdd, onEditTopic }: { onAdd: () => void; onEditTopic: (topic: Topic) => void }) {
  const data = useData();
  const summary = dashboardSummary(data);
  const topicMap = useMemo(() => new Map(data.topics.map((topic) => [topic.id, topic])), [data.topics]);
  const [queueFilter, setQueueFilter] = useState<'all' | 'due' | 'overdue'>('all');

  const filteredRevisions = useMemo(() => {
    if (queueFilter === 'due') {
      return summary.due.filter((r) => localDateKey(new Date(r.dueAt), data.settings.timezone) === summary.date);
    }
    if (queueFilter === 'overdue') {
      return summary.due.filter((r) => localDateKey(new Date(r.dueAt), data.settings.timezone) < summary.date);
    }
    return summary.due;
  }, [summary.due, summary.date, data.settings.timezone, queueFilter]);

  const upcomingNextDay = useMemo(() => {
    const tomorrowKey = addDaysToDateKey(summary.date, 1);
    const pending = data.revisions.filter((revision) => revision.kind === 'mandatory' && revision.status === 'pending');
    const tomorrowRevisions = pending.filter((revision) => localDateKey(new Date(revision.dueAt), data.settings.timezone) === tomorrowKey);
    if (tomorrowRevisions.length > 0) {
      return { dateKey: tomorrowKey, revisions: tomorrowRevisions.sort((a, b) => a.dueAt.localeCompare(b.dueAt)), isTomorrow: true };
    }
    const futureRevisions = pending.filter((revision) => localDateKey(new Date(revision.dueAt), data.settings.timezone) > summary.date).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    if (!futureRevisions.length) return { dateKey: tomorrowKey, revisions: [], isTomorrow: true };
    const nextUpcomingDateKey = localDateKey(new Date(futureRevisions[0].dueAt), data.settings.timezone);
    const nextDateRevisions = futureRevisions.filter((revision) => localDateKey(new Date(revision.dueAt), data.settings.timezone) === nextUpcomingDateKey);
    return { dateKey: nextUpcomingDateKey, revisions: nextDateRevisions, isTomorrow: nextUpcomingDateKey === tomorrowKey };
  }, [data.revisions, data.settings.timezone, summary.date]);

  const [toast, setToast] = useState('');
  const complete = async (id: string) => { if (await store.completeRevision(id)) { setToast('Revision completed. Nice work.'); setTimeout(() => setToast(''), 2400); } };
  const dateLabel = formatDate(summary.date, { weekday: 'long', month: 'long', day: 'numeric' });
  const activeBatch = data.bonusBatches.some((batch) => !batch.endedAt && batch.revisionIds.some((id) => data.revisions.find((revision) => revision.id === id)?.status === 'pending'));

  const dueTodayCount = summary.due.filter((r) => localDateKey(new Date(r.dueAt), data.settings.timezone) === summary.date).length;
  const overdueCount = summary.due.filter((r) => localDateKey(new Date(r.dueAt), data.settings.timezone) < summary.date).length;

  return <>
    <header className="page-header"><div><span className="eyebrow">{dateLabel}</span><h1>Good to see you.</h1><p className="subtitle">A little progress, kept simple.</p></div><Button variant="primary" onClick={onAdd}><Icon name="plus" /> Add study <span className="shortcut">N</span></Button></header>
    {data.topics.length === 0 ? <EmptyState onAdd={onAdd} /> : <>
      <section className="overview-grid"><div className="progress-card"><div><span className="eyebrow">Today’s mandatory work</span><h2>{summary.remaining ? `${summary.remaining} to go` : summary.dueCount ? 'All clear for today' : 'Your plan is ready'}</h2><p>{summary.dueCount ? `${summary.completedDueCount} of ${summary.dueCount} due revisions complete.` : 'Your next check-in will appear here when it is due.'}</p><div className="stat-pair"><span><strong>{summary.completedToday}</strong> completed today</span><span><strong>{summary.dueCount}</strong> due total</span></div></div><ProgressRing value={summary.progress} completed={summary.completedDueCount} total={summary.dueCount} /></div><div className="insight-card"><span className="eyebrow">Daily target</span><div className="insight-number">{summary.completedToday}<span> / {data.settings.dailyTarget}</span></div><p>{summary.bonusCapacity > 0 ? `${summary.bonusCapacity} spaces left for optional maintenance.` : 'Mandatory work takes priority today.'}</p><div className="mini-line"><span style={{ width: `${Math.min(summary.completedToday / data.settings.dailyTarget * 100, 100)}%` }} /></div></div></section>
      <section className="section-heading"><div><span className="eyebrow">Your queue</span><h2>Mandatory revisions</h2></div><span className="quiet-count">{summary.remaining} remaining</span></section>
      {summary.due.length > 0 && (
        <div className="queue-filter-pills">
          <button className={`filter-pill ${queueFilter === 'all' ? 'active' : ''}`} onClick={() => setQueueFilter('all')}>
            All ({summary.due.length})
          </button>
          <button className={`filter-pill ${queueFilter === 'due' ? 'active' : ''}`} onClick={() => setQueueFilter('due')}>
            Due Today ({dueTodayCount})
          </button>
          <button className={`filter-pill ${queueFilter === 'overdue' ? 'active' : ''}`} onClick={() => setQueueFilter('overdue')}>
            Overdue ({overdueCount})
          </button>
        </div>
      )}
      {filteredRevisions.length ? <div className="revision-list">{filteredRevisions.map((revision) => <RevisionRow key={revision.id} revision={revision} timezone={data.settings.timezone} topic={topicMap.get(revision.topicId)} onComplete={complete} />)}</div> : <div className="done-card"><div className="done-icon"><Icon name="check" /></div><div><h2>{summary.dueCount ? 'Great job. All mandatory revisions in this filter are complete.' : 'Nothing due just yet.'}</h2><p>{summary.dueCount ? 'You’ve made space for what comes next.' : 'New check-ins will appear here automatically.'}</p></div></div>}
      {upcomingNextDay.revisions.length > 0 && <section className="upcoming-section"><div className="section-heading"><div><span className="eyebrow">{upcomingNextDay.isTomorrow ? 'Next Day' : 'Coming Up'} · {formatDate(upcomingNextDay.dateKey)}</span><h2>{upcomingNextDay.isTomorrow ? 'Revisions due tomorrow' : `Revisions for ${formatDate(upcomingNextDay.dateKey)}`}</h2></div><span className="quiet-count">{upcomingNextDay.revisions.length} scheduled</span></div><div className="upcoming-list">{upcomingNextDay.revisions.map((revision) => <UpcomingRevisionRow key={revision.id} revision={revision} timezone={data.settings.timezone} topic={topicMap.get(revision.topicId)} />)}</div></section>}
      {!activeBatch && <BonusPrompt onCreated={() => setToast('Optional maintenance batch ready.')} />}{activeBatch && <ActiveBonus onComplete={complete} />}
      <section className="recent-section"><div className="section-heading"><div><span className="eyebrow">A small record</span><h2>Recent completions</h2></div></div>{data.completionEvents.length ? <div className="recent-list">{[...data.completionEvents].reverse().slice(0, 4).map((event) => <div className="recent-item" key={event.id}><span className="recent-dot" /><div><strong>{topicMap.get(event.topicId)?.title ?? 'Study'}</strong><span>{event.kind === 'bonus' ? 'Optional maintenance' : 'Mandatory revision'} · {formatDate(event.localDate)}</span></div></div>)}</div> : <p className="muted">Your first completion will show up here.</p>}</section>
      <TopicsManageSection onEdit={onEditTopic} />
    </>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) { return <div className="empty-state"><div className="empty-art"><Icon name="book" /></div><span className="eyebrow">A quiet place to begin</span><h2>Keep the things you care about close.</h2><p>Add a study and Retain will gently bring it back when it matters.</p><Button variant="primary" onClick={onAdd}><Icon name="plus" /> Add your first study</Button></div>; }

function StatisticsPage() {
  const data = useData();
  const stats = calculateStatistics(data);
  const max = Math.max(...stats.daily.map((day) => day.completions), 1);
  return <><header className="page-header"><div><span className="eyebrow">Your practice</span><h1>Statistics</h1><p className="subtitle">A clearer picture of the habit you’re building.</p></div></header><div className="metrics-grid"><Metric label="Current streak" value={`${stats.currentStreak} days`} note="Keep showing up" /><Metric label="Longest streak" value={`${stats.longestStreak} days`} note="Your best run" /><Metric label="Completion rate" value={`${Math.round(stats.completionRate * 100)}%`} note="Across mandatory revisions" /><Metric label="Topics retained" value={String(stats.totalTopics)} note={`${stats.completedRevisions} total completions`} /></div><section className="chart-card"><div className="card-heading"><div><span className="eyebrow">Last 28 days</span><h2>Daily activity</h2></div><span className="chart-legend"><i /> completions</span></div><div className="bar-chart" aria-label="Daily completion chart">{stats.daily.map((day) => <div className="bar-column" key={day.date} title={`${day.date}: ${day.completions} completions`}><div className="bar" style={{ height: `${Math.max(day.completions / max * 100, day.completions ? 8 : 2)}%` }} /><small>{day.date.slice(8)}</small></div>)}</div><p className="chart-summary">{stats.completedRevisions ? `${stats.completedRevisions} revisions completed so far, averaging ${stats.averagePerDay.toFixed(1)} per day.` : 'Complete a revision to begin your activity history.'}</p></section><div className="two-column"><section className="chart-card"><div className="card-heading"><div><span className="eyebrow">By subject</span><h2>Where your attention goes</h2></div></div>{stats.subjects.length ? <div className="subject-bars">{stats.subjects.slice(0, 6).map((item) => <div key={item.subject}><div><span>{item.subject}</span><strong>{item.count}</strong></div><div className="subject-track"><i style={{ width: `${item.count / stats.subjects[0].count * 100}%` }} /></div></div>)}</div> : <p className="muted">Subject patterns will appear as you study.</p>}</section><section className="chart-card highlight-card"><span className="eyebrow">A gentle insight</span><h2>{stats.mostStudiedSubject ? `${stats.mostStudiedSubject} is getting the most attention.` : 'Your pattern will emerge.'}</h2><p>{stats.mostRevisedTopic ? `“${stats.mostRevisedTopic}” is currently your most revisited topic.` : 'Start with one study and let the record grow.'}</p><div className="insight-orb">✦</div></section></div></>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="metric-card"><span className="eyebrow">{label}</span><strong>{value}</strong><small>{note}</small></div>; }

function SearchPage({ onEditTopic }: { onEditTopic: (topic: Topic) => void }) {
  const data = useData();
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const results = store.search(query);
  const tz = data.settings.timezone;
  return <><header className="page-header"><div><span className="eyebrow">Your library</span><h1>Search</h1><p className="subtitle">Find a topic by subject or title.</p></div></header><div className="search-box"><Icon name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your studies…" aria-label="Search studies" /><span className="shortcut">/</span></div><div className="search-results"><div className="results-heading"><span>{query ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Recent studies'}</span></div>{results.length ? results.map((topic) => { const maintenance = isMaintenanceTopic(topic.id, data.revisions); const isConfirming = confirmDeleteId === topic.id; return <div className="search-result" key={topic.id}><div className="subject-avatar">{topic.subject.slice(0, 1).toUpperCase()}</div><div><strong>{topic.title}</strong><span>{topic.subject} · added {formatDate(localDateKey(new Date(topic.createdAt), tz))}</span></div><em className={maintenance ? 'status-maintenance' : ''}>{maintenance ? 'Maintenance' : 'In progress'}</em><div className="topic-manage-actions">{isConfirming ? <div className="delete-confirm-wrap"><span>Delete?</span><Button variant="danger" className="btn-xs" onClick={async () => { await store.deleteTopic(topic.id); setConfirmDeleteId(null); }}>Yes</Button><Button variant="quiet" className="btn-xs" onClick={() => setConfirmDeleteId(null)}>No</Button></div> : <><button className="action-icon-btn" onClick={() => onEditTopic(topic)} title="Edit study" aria-label="Edit study"><Icon name="edit" /></button><button className="action-icon-btn danger" onClick={() => setConfirmDeleteId(topic.id)} title="Delete study" aria-label="Delete study"><Icon name="trash" /></button></>}</div></div>; }) : <div className="no-results"><Icon name="search" /><h2>No studies found</h2><p>Try a different subject or title.</p></div>}</div></>;
}

function SettingsPage() {
  const data = useData();
  const user = getUserSession();
  const [message, setMessage] = useState('');
  const [resetText, setResetText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = async (changes: Parameters<typeof store.updateSettings>[0]) => { await store.updateSettings(changes); setMessage('Settings saved'); setTimeout(() => setMessage(''), 1800); };
  const download = () => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([store.exportData()], { type: 'application/json' })); link.download = `retain-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href); };
  const importFile = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = async () => { const result = await store.importData(String(reader.result)); setMessage(result.ok ? 'Import restored successfully' : result.message); }; reader.readAsText(file); };
  const handleReset = async () => {
    if (resetText.trim().toUpperCase() !== 'RESET RETAIN' || isResetting) return;
    setIsResetting(true);
    await store.reset();
    setResetText('');
    setIsResetting(false);
    setMessage('Retain has been reset');
    setTimeout(() => setMessage(''), 3000);
  };
  const isResetValid = resetText.trim().toUpperCase() === 'RESET RETAIN';
  return <><header className="page-header"><div><span className="eyebrow">Make it yours</span><h1>Settings</h1><p className="subtitle">Small choices for a calmer study practice.</p></div>{message && <span className="save-message">{message}</span>}</header><div className="settings-layout">{authEnabled && <section className="settings-section"><span className="eyebrow">Account</span><h2>Your profile</h2><div className="setting-row"><div><strong>Signed in as</strong><small>{user?.email || 'Authenticated user'}</small></div><Button variant="secondary" onClick={logout}><Icon name="logout" /> Sign out</Button></div></section>}<section className="settings-section"><span className="eyebrow">Appearance</span><h2>How Retain feels</h2><div className="setting-row"><div><strong>Theme</strong><small>Choose a light, dark, or system surface.</small></div><select value={data.settings.theme} onChange={(event) => save({ theme: event.target.value as 'system' | 'light' | 'dark' })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div><div className="setting-row"><div><strong>Animations</strong><small>Use subtle movement when moving through the app.</small></div><button className={`toggle ${data.settings.animationsEnabled ? 'on' : ''}`} onClick={() => save({ animationsEnabled: !data.settings.animationsEnabled })} aria-label="Toggle animations"><i /></button></div></section><section className="settings-section"><span className="eyebrow">Study</span><h2>Your daily rhythm</h2><div className="setting-row"><div><strong>Daily target</strong><small>A comfort signal for optional work, never a limit.</small></div><div className="number-stepper"><button onClick={() => save({ dailyTarget: Math.max(1, data.settings.dailyTarget - 1) })}>−</button><span>{data.settings.dailyTarget}</span><button onClick={() => save({ dailyTarget: Math.min(100, data.settings.dailyTarget + 1) })}>+</button></div></div><div className="setting-row"><div><strong>Timezone</strong><small>Due dates follow your local calendar.</small></div><input className="timezone-input" value={data.settings.timezone} onChange={(event) => { if (isValidTimezone(event.target.value)) save({ timezone: event.target.value }); }} /></div></section><section className="settings-section"><span className="eyebrow">Your data</span><h2>Portable by design</h2><p className="section-copy">Export a complete JSON copy of your studies, or restore one later. Your data stays in this browser.</p><div className="data-actions"><Button onClick={download}><Icon name="download" /> Export data</Button><Button onClick={() => fileRef.current?.click()}><Icon name="upload" /> Import data</Button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => importFile(event.target.files?.[0])} /></div></section><section className="settings-section danger-zone"><span className="eyebrow">Danger zone</span><h2>Start over</h2><p className="section-copy">This removes all studies and history from this browser. Export first if you may want to come back to it.</p><div className="reset-row"><input value={resetText} disabled={isResetting} onChange={(event) => setResetText(event.target.value)} placeholder="Type RESET RETAIN" aria-label="Type RESET RETAIN to confirm reset" /><Button variant="danger" disabled={!isResetValid || isResetting} onClick={handleReset}>{isResetting ? 'Resetting…' : 'Reset Retain'}</Button></div></section></div></>;
}

function RetainApp() {
  const data = useData();
  const user = getUserSession();
  const [page, setPage] = useState<Page>('dashboard');
  const [addOpen, setAddOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  useEffect(() => { void store.hydrateFromApi(); }, []);
  useEffect(() => { document.documentElement.dataset.theme = data.settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : data.settings.theme; document.documentElement.dataset.motion = data.settings.animationsEnabled ? 'on' : 'off'; }, [data.settings.theme, data.settings.animationsEnabled]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.target as HTMLElement).matches('input, textarea, select')) return; if (event.key.toLowerCase() === 'n') { event.preventDefault(); setAddOpen(true); } if (event.key === '/') { event.preventDefault(); setPage('search'); } if (event.key === 'Escape') { setAddOpen(false); setEditingTopic(null); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  return <div className="app-shell"><a href="#main" className="skip-link">Skip to content</a><nav className="topbar"><button className="brand" onClick={() => setPage('dashboard')} aria-label="Go to Today"><span className="brand-mark">r</span><span>retain</span></button><div className="nav-links">{([['dashboard', 'Today', 'sun'], ['statistics', 'Statistics', 'chart'], ['search', 'Search', 'search'], ['settings', 'Settings', 'gear']] as const).map(([key, label, icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)} aria-label={label}><Icon name={icon} />{label}</button>)}</div><TopbarSyncIndicator />{authEnabled && <div className="user-profile-badge" title={user?.email || 'Signed in'}><span className="user-avatar"><Icon name="user" /></span><span className="user-email">{user?.email || 'Account'}</span><button className="logout-button" onClick={logout} title="Sign out" aria-label="Sign out"><Icon name="logout" /></button></div>}<button className="theme-toggle-btn" onClick={() => { const nextTheme = data.settings.theme === 'dark' ? 'light' : 'dark'; void store.updateSettings({ theme: nextTheme }); }} title={`Switch to ${data.settings.theme === 'dark' ? 'light' : 'dark'} mode`} aria-label="Toggle theme"><Icon name={data.settings.theme === 'dark' ? 'sun' : 'moon'} /></button><button className="mobile-add" onClick={() => setAddOpen(true)} aria-label="Add study"><Icon name="plus" /></button></nav><main id="main" className="main-content">{page === 'dashboard' && <Dashboard onAdd={() => setAddOpen(true)} onEditTopic={(topic) => setEditingTopic(topic)} />}{page === 'statistics' && <StatisticsPage />}{page === 'search' && <SearchPage onEditTopic={(topic) => setEditingTopic(topic)} />}{page === 'settings' && <SettingsPage />}</main>{addOpen && <AddStudyDialog onClose={() => setAddOpen(false)} />}{editingTopic && <EditStudyDialog topic={editingTopic} onClose={() => setEditingTopic(null)} />}<footer className="footer">Retain <span>·</span> quiet progress, remembered <small>v1.0</small></footer></div>;
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState('gvenkatesh.on@gmail.com');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const res = await loginWithPassword(email, password);
    setBusy(false);
    if (res.ok) {
      onAuthenticated();
    } else {
      setError(res.message || 'Invalid email or password.');
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark">r</span>
          <span>retain</span>
        </div>
        <span className="eyebrow">Private study space</span>
        <h1>Keep your progress close.</h1>
        <p>Sign in with your email and password to continue to your revision plan.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gvenkatesh.on@gmail.com"
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow" />
          </Button>
        </form>
        <small>Private local authentication</small>
      </div>
    </div>
  );
}

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>(authEnabled ? 'loading' : 'authenticated');

  useEffect(() => {
    if (!authEnabled) return;
    let cancelled = false;
    void (async () => {
      const valid = await checkAuth();
      if (!cancelled) setAuthState(valid ? 'authenticated' : 'unauthenticated');
    })();
    return () => { cancelled = true; };
  }, []);

  if (!authEnabled) return <RetainApp />;
  if (authState === 'loading') return <div className="auth-screen"><div className="auth-loading">Checking your secure session…</div></div>;
  if (authState === 'unauthenticated') return <LoginScreen onAuthenticated={() => setAuthState('authenticated')} />;
  return <RetainApp />;
}
