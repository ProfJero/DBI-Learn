import type { Database, SqlJsStatic } from 'sql.js';

export type OutLine = { kind: 'log' | 'error' | 'warn' | 'info' | 'system'; text: string };
export type SqlResult = { columns: string[]; values: unknown[][] };

let worker: Worker | null = null;
let seq = 0;

function getWorker() {
  worker ??= new Worker(new URL('./runtime.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

/**
 * Runs JavaScript, TypeScript or Python in a worker. Stops the run (and recycles the worker)
 * when it exceeds the time limit, which catches accidental infinite loops.
 */
export async function runInWorker(
  lang: 'javascript' | 'typescript' | 'python',
  code: string,
  { stdin = '', onOut, onStatus, timeoutMs = 8000 }: { stdin?: string; onOut: (l: OutLine) => void; onStatus?: (s: string) => void; timeoutMs?: number },
): Promise<{ ok: boolean; timedOut?: boolean }> {
  let source = code;
  if (lang === 'typescript') {
    try {
      const { transform } = await import('sucrase');
      source = transform(code, { transforms: ['typescript'], disableESTransforms: true }).code;
    } catch (e) {
      onOut({ kind: 'error', text: `TypeScript error: ${(e as Error).message}` });
      return { ok: false };
    }
  }
  const id = ++seq;
  const w = getWorker();
  return new Promise((resolve) => {
    let started = lang !== 'python';
    let timer = started ? setTimeout(stop, timeoutMs) : undefined;
    function stop() {
      w.terminate();
      worker = null;
      w.removeEventListener('message', onMsg);
      onOut({ kind: 'error', text: `⏱️ Stopped after ${timeoutMs / 1000} seconds. Is there a loop that never ends?` });
      resolve({ ok: false, timedOut: true });
    }
    function onMsg(e: MessageEvent) {
      const m = e.data as { id: number; type: string; kind?: OutLine['kind']; text?: string; error?: boolean };
      if (m.id !== id) return;
      if (m.type === 'status') {
        onStatus?.(m.text ?? '');
        // Python's clock starts once the interpreter is ready, not while it downloads.
        if (!m.text && !started) {
          started = true;
          timer = setTimeout(stop, timeoutMs);
        }
      } else if (m.type === 'out') onOut({ kind: m.kind ?? 'log', text: m.text ?? '' });
      else if (m.type === 'done') {
        clearTimeout(timer);
        w.removeEventListener('message', onMsg);
        resolve({ ok: !m.error });
      }
    }
    w.addEventListener('message', onMsg);
    w.postMessage({ id, lang: lang === 'python' ? 'python' : 'javascript', code: source, stdin });
  });
}

export function stopWorker() {
  worker?.terminate();
  worker = null;
}

// ---------------------------------------------------------------------------
// Web preview
// ---------------------------------------------------------------------------

/** Script injected before learner code: forwards console output and errors to the Code Lab. */
const BRIDGE = `<script>(function(){
  var send=function(kind,args){try{parent.postMessage({__dbiLab:1,kind:kind,text:Array.prototype.map.call(args,function(a){
    if(typeof a==='string')return a;try{return JSON.stringify(a)}catch(e){return String(a)}}).join(' ')},'*')}catch(e){}};
  ['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o.apply(console,arguments)}});
  window.addEventListener('error',function(e){send('error',[e.message+(e.lineno?' (line '+e.lineno+')':'')])});
  window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled promise: '+(e.reason&&e.reason.message||e.reason)])});
  window.__dbiReport=function(results){parent.postMessage({__dbiLab:1,kind:'tests',results:results},'*')};
})();</script>`;

/** Combines the three web files into one document for the sandboxed preview iframe. */
export function buildWebDoc(files: Record<string, string>, testScript?: string) {
  const html = files['index.html'] ?? '';
  const css = `<style>${files['style.css'] ?? ''}</style>`;
  // Close the script tag safely if a learner types "</script>" inside a string.
  const js = `<script>${(files['script.js'] ?? '').replace(/<\/script/gi, '<\\/script')}\n//# sourceURL=script.js</script>`;
  const tests = testScript ? `<script>window.addEventListener('load',function(){setTimeout(function(){${testScript}},50)})</script>` : '';
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BRIDGE}${css}`;
  if (/<html[\s>]/i.test(html)) {
    let doc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + head) : html.replace(/<html[^>]*>/i, (m) => `${m}<head>${head}</head>`);
    doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${js}${tests}</body>`) : doc + js + tests;
    return doc;
  }
  return `<!doctype html><html><head>${head}</head><body>${html}${js}${tests}</body></html>`;
}

// ---------------------------------------------------------------------------
// SQL — SQLite compiled to WebAssembly, bundled so it works offline
// ---------------------------------------------------------------------------
let sqlJs: Promise<SqlJsStatic> | null = null;

const SCHOOL_DB = `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, class TEXT, gender TEXT, age INTEGER);
CREATE TABLE subjects (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE scores (student_id INTEGER REFERENCES students(id), subject_id INTEGER REFERENCES subjects(id), term INTEGER, mark INTEGER);
INSERT INTO students VALUES
 (1,'Ama Mensah','JHS 3','F',15),(2,'Kofi Boateng','JHS 3','M',15),(3,'Esi Owusu','SHS 1','F',16),
 (4,'Yaw Asante','SHS 1','M',17),(5,'Akosua Darko','JHS 2','F',14),(6,'Kwame Adjei','SHS 2','M',17),
 (7,'Abena Ofori','SHS 2','F',16),(8,'Kojo Appiah','JHS 2','M',13),(9,'Adwoa Sarpong','SHS 3','F',18),(10,'Kwesi Ansah','SHS 3','M',18);
INSERT INTO subjects VALUES (1,'Mathematics'),(2,'English'),(3,'Integrated Science'),(4,'Computing'),(5,'Social Studies');
`;
function scoreRows() {
  // Deterministic marks so challenge answers never change.
  const rows: string[] = [];
  for (let s = 1; s <= 10; s++) for (let sub = 1; sub <= 5; sub++) for (let t = 1; t <= 2; t++) rows.push(`(${s},${sub},${t},${40 + ((s * 37 + sub * 17 + t * 11) % 59)})`);
  return `INSERT INTO scores VALUES ${rows.join(',')};`;
}

export async function openSchoolDb(): Promise<Database> {
  sqlJs ??= (async () => {
    const [{ default: init }, { default: wasmUrl }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm-browser.wasm?url')]);
    return init({ locateFile: () => wasmUrl });
  })();
  const SQL = await sqlJs;
  const db = new SQL.Database();
  db.exec(SCHOOL_DB + scoreRows());
  return db;
}

export async function runSql(code: string): Promise<{ results: SqlResult[]; error?: string }> {
  const db = await openSchoolDb();
  try {
    return { results: db.exec(code) as SqlResult[] };
  } catch (e) {
    let msg = (e as Error).message;
    if (/no such table/.test(msg)) msg += '\n💡 The tables are: students, subjects, scores.';
    else if (/no such column/.test(msg)) msg += '\n💡 Check the column name. students(id, name, class, gender, age), subjects(id, name), scores(student_id, subject_id, term, mark).';
    else if (/syntax error/.test(msg)) msg += '\n💡 Check commas between columns and that keywords are spelt correctly.';
    return { results: [], error: msg };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Formatting (Prettier, loaded only when the learner presses Format)
// ---------------------------------------------------------------------------
export async function formatCode(code: string, lang: string) {
  const prettier = await import('prettier/standalone');
  const parser = lang === 'html' ? 'html' : lang === 'css' ? 'css' : lang === 'typescript' ? 'typescript' : 'babel';
  const plugins = await Promise.all(
    lang === 'html'
      ? [import('prettier/plugins/html'), import('prettier/plugins/postcss'), import('prettier/plugins/babel'), import('prettier/plugins/estree')]
      : lang === 'css'
        ? [import('prettier/plugins/postcss')]
        : lang === 'typescript'
          ? [import('prettier/plugins/typescript'), import('prettier/plugins/estree')]
          : [import('prettier/plugins/babel'), import('prettier/plugins/estree')],
  );
  return prettier.format(code, { parser, plugins: plugins as never, singleQuote: true, printWidth: 80 });
}
