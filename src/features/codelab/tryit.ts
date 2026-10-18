import type { LangId } from './languages';

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
