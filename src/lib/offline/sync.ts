import { supabase } from '../supabase';
import { idb } from './store';

// A durable outbox of learner actions. Everything a student does offline lands here first and is
// replayed in order when the connection returns. Each RPC is idempotent server-side.
export type QueueItem =
  | { type: 'complete_lesson'; id: string; userId: string; lessonId: string; courseId: string; seconds: number; at: string }
  | {
      type: 'submit_quiz';
      id: string; // also the attempt client_id (idempotency key)
      userId: string;
      quizId: string;
      courseId: string;
      answers: Record<string, string[]>;
      startedAt: string;
      at: string;
    }
  | { type: 'save_note'; id: string; userId: string; lessonId: string; courseId: string; body: string; at: string };

export interface SyncFailure {
  item: QueueItem;
  error: string;
  at: string;
}

const QUEUE = 'queue';
const FAILURES = 'queue-failures';
type Listener = (state: SyncState) => void;
export interface SyncState {
  pending: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  lastResults: Record<string, unknown>;
}

let state: SyncState = { pending: 0, syncing: false, lastSyncedAt: null, lastResults: {} };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(state));
let afterSync: (() => void) | null = null;

export function onSyncState(l: Listener) {
  listeners.add(l);
  l(state);
  return () => void listeners.delete(l);
}

export function setAfterSync(fn: () => void) {
  afterSync = fn;
}

async function readQueue(): Promise<QueueItem[]> {
  return (await idb.get<QueueItem[]>(QUEUE)) ?? [];
}

export async function refreshPending() {
  state = { ...state, pending: (await readQueue()).length };
  emit();
}

export async function enqueue(item: QueueItem) {
  await idb.update<QueueItem[]>(QUEUE, (q) => {
    const list = q ?? [];
    // Only the latest note for a lesson matters.
    const filtered = item.type === 'save_note' ? list.filter((i) => !(i.type === 'save_note' && i.lessonId === item.lessonId)) : list;
    return [...filtered, item];
  });
  await refreshPending();
  if (navigator.onLine) void flush();
}

export async function getFailures() {
  return (await idb.get<SyncFailure[]>(FAILURES)) ?? [];
}

function isNetworkError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return /Failed to fetch|NetworkError|Load failed|fetch failed|ERR_INTERNET|timeout/i.test(m);
}

async function run(item: QueueItem) {
  switch (item.type) {
    case 'complete_lesson': {
      const { data, error } = await supabase.rpc('complete_lesson', {
        p_lesson_id: item.lessonId,
        p_seconds: item.seconds,
        p_completed_at: item.at,
      });
      if (error) throw error;
      return data;
    }
    case 'submit_quiz': {
      const { data, error } = await supabase.rpc('submit_quiz', {
        p_quiz_id: item.quizId,
        p_answers: item.answers,
        p_client_id: item.id,
        p_started_at: item.startedAt,
        p_offline: true,
      });
      if (error) throw error;
      return data;
    }
    case 'save_note': {
      const { error } = await supabase
        .from('lesson_notes')
        .upsert({ user_id: item.userId, lesson_id: item.lessonId, course_id: item.courseId, body: item.body, updated_at: item.at });
      if (error) throw error;
      return null;
    }
  }
}

let running: Promise<void> | null = null;

/** Replays queued actions for the signed-in user. Safe to call often. */
export function flush(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid || !navigator.onLine) return;
    state = { ...state, syncing: true };
    emit();
    let processed = 0;
    try {
      for (;;) {
        const queue = await readQueue();
        const item = queue.find((i) => i.userId === uid);
        if (!item) break;
        try {
          const result = await run(item);
          state.lastResults[item.id] = result;
        } catch (e) {
          if (isNetworkError(e)) break; // try again later, keep order
          const failure: SyncFailure = { item, error: e instanceof Error ? e.message : String(e), at: new Date().toISOString() };
          await idb.update<SyncFailure[]>(FAILURES, (f) => [...(f ?? []), failure].slice(-50));
        }
        await idb.update<QueueItem[]>(QUEUE, (q) => (q ?? []).filter((i) => i.id !== item.id));
        processed += 1;
      }
    } finally {
      state = { ...state, syncing: false, lastSyncedAt: processed ? new Date().toISOString() : state.lastSyncedAt };
      await refreshPending();
      if (processed && afterSync) afterSync();
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

export function startSyncLoop() {
  void refreshPending();
  window.addEventListener('online', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush();
  });
  setInterval(() => void flush(), 60_000);
  void flush();
}
