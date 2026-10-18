import { idb } from '@/lib/offline/store';
import { supabase } from '@/lib/supabase';
import { CHALLENGES } from './challenges';
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

/**
 * Sends XP for challenges passed on this device that the server has not recorded yet —
 * passed offline, or the learner left the page before the request finished. Returns every completed id.
 */
export async function syncPracticeXp(uid: string) {
  const local = await getCompleted(uid);
  if (!navigator.onLine) return local;
  const { data, error } = await supabase.from('practice_completions').select('challenge_id').eq('user_id', uid);
  if (error) return local;
  const server = new Set((data ?? []).map((r) => r.challenge_id as string));
  for (const id of local) {
    const c = CHALLENGES.find((x) => x.id === id);
    if (c && !server.has(id)) {
      const { error: e } = await supabase.rpc('complete_practice', { p_challenge: c.id, p_language: c.lang, p_xp: c.xp });
      if (!e) server.add(id);
    }
  }
  server.forEach((id) => local.add(id));
  return local;
}
