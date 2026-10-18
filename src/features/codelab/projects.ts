import { idb } from '@/lib/offline/store';
import type { LangId } from './languages';

/** Learner projects live on the device (IndexedDB) so the Code Lab works fully offline. */
export type Project = { id: string; name: string; lang: LangId; files: Record<string, string>; stdin?: string; updated_at: string };

const listKey = (uid: string) => `codelab:projects:${uid}`;
const draftKey = (uid: string, key: string) => `codelab:draft:${uid}:${key}`;

export async function listProjects(uid: string) {
  return ((await idb.get<Project[]>(listKey(uid))) ?? []).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function saveProject(uid: string, p: Project) {
  await idb.update<Project[]>(listKey(uid), (old) => [{ ...p, updated_at: new Date().toISOString() }, ...(old ?? []).filter((x) => x.id !== p.id)].slice(0, 100));
}

export async function deleteProject(uid: string, id: string) {
  await idb.update<Project[]>(listKey(uid), (old) => (old ?? []).filter((x) => x.id !== id));
}

export const getDraft = (uid: string, key: string) => idb.get<{ files: Record<string, string>; stdin?: string }>(draftKey(uid, key));
export const setDraft = (uid: string, key: string, d: { files: Record<string, string>; stdin?: string }) => idb.set(draftKey(uid, key), d);
export const clearDraft = (uid: string, key: string) => idb.del(draftKey(uid, key));

const doneKey = (uid: string) => `codelab:done:${uid}`;
export async function getCompleted(uid: string) {
  return new Set((await idb.get<string[]>(doneKey(uid))) ?? []);
}
export async function markCompleted(uid: string, id: string) {
  await idb.update<string[]>(doneKey(uid), (old) => Array.from(new Set([...(old ?? []), id])));
}

/** Hand-off from a lesson's "Try it" button to the Code Lab. */
export function tryItLink(lang: string, code: string) {
  const map: Record<string, { lang: LangId; file: string }> = {
    html: { lang: 'web', file: 'index.html' },
    css: { lang: 'web', file: 'style.css' },
    js: { lang: 'javascript', file: 'main.js' },
    javascript: { lang: 'javascript', file: 'main.js' },
    ts: { lang: 'typescript', file: 'main.ts' },
    typescript: { lang: 'typescript', file: 'main.ts' },
    py: { lang: 'python', file: 'main.py' },
    python: { lang: 'python', file: 'main.py' },
    sql: { lang: 'sql', file: 'query.sql' },
  };
  const m = map[lang.toLowerCase()];
  if (!m) return null;
  return { to: `/app/practice/code?lang=${m.lang}&tryit=1`, state: { tryit: { file: m.file, code } } };
}
