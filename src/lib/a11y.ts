import { useSyncExternalStore } from 'react';

/** Reading and data preferences. Stored on the device so they apply before sign-in and offline. */
export type Prefs = {
  textSize: 'normal' | 'large' | 'xlarge';
  easyFont: boolean;
  reduceMotion: boolean;
  dataSaver: boolean;
  readRate: number;
};

const KEY = 'dbi:prefs';
const DEFAULTS: Prefs = { textSize: 'normal', easyFont: false, reduceMotion: false, dataSaver: false, readRate: 1 };
const SIZES: Record<Prefs['textSize'], string> = { normal: '100%', large: '112.5%', xlarge: '125%' };

let current: Prefs = read();
const listeners = new Set<() => void>();

function read(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

/** Applies preferences to <html>: Tailwind sizes are in rem, so one root font size scales the whole app. */
export function applyPrefs(p: Prefs = current) {
  const root = document.documentElement;
  root.style.fontSize = SIZES[p.textSize];
  root.classList.toggle('easy-font', p.easyFont);
  root.classList.toggle('reduce-motion', p.reduceMotion);
  root.classList.toggle('data-saver', p.dataSaver);
}

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode */
  }
  applyPrefs(current);
  listeners.forEach((l) => l());
}

export const getPrefs = () => current;

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** Saves data on slow or metered connections: the user's choice, or the browser's Save-Data hint. */
export function dataSaverOn() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return current.dataSaver || !!conn?.saveData;
}
