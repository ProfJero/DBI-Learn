import { createStore, del, get, keys, set, update } from 'idb-keyval';

// One IndexedDB database for everything the app needs offline.
const kv = createStore('dbi-learn', 'kv');

export const idb = {
  get: <T>(key: string) => get<T>(key, kv),
  set: (key: string, value: unknown) => set(key, value, kv),
  del: (key: string) => del(key, kv),
  keys: async (prefix: string) => ((await keys(kv)) as string[]).filter((k) => k.startsWith(prefix)),
  update: <T>(key: string, fn: (old: T | undefined) => T) => update<T>(key, fn, kv),
};

/** Learner progress recorded on this device that may not have reached the server yet. */
export interface LocalProgress {
  lessons: string[];
  quizzes: Record<string, { percent: number; passed: boolean | null; at: string }>;
}

const progressKey = (userId: string, courseId: string) => `progress:${userId}:${courseId}`;

export async function getLocalProgress(userId: string, courseId: string): Promise<LocalProgress> {
  return (await idb.get<LocalProgress>(progressKey(userId, courseId))) ?? { lessons: [], quizzes: {} };
}

export async function markLessonLocal(userId: string, courseId: string, lessonId: string) {
  await idb.update<LocalProgress>(progressKey(userId, courseId), (old) => {
    const p = old ?? { lessons: [], quizzes: {} };
    if (!p.lessons.includes(lessonId)) p.lessons.push(lessonId);
    return p;
  });
}

export async function markQuizLocal(userId: string, courseId: string, quizId: string, percent: number, passed: boolean | null) {
  await idb.update<LocalProgress>(progressKey(userId, courseId), (old) => {
    const p = old ?? { lessons: [], quizzes: {} };
    const prev = p.quizzes[quizId];
    if (!prev || (passed && !prev.passed) || percent > prev.percent) p.quizzes[quizId] = { percent, passed, at: new Date().toISOString() };
    return p;
  });
}
