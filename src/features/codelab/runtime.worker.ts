/// <reference lib="webworker" />
// Runs learner JavaScript and Python off the main thread, so an endless loop can be stopped
// by terminating the worker instead of freezing the app.

type Out = { kind: 'log' | 'error' | 'warn' | 'info'; text: string };
type Req = { id: number; lang: 'javascript' | 'python'; code: string; stdin: string };

const PYODIDE = 'https://cdn.jsdelivr.net/npm/pyodide@0.29.5/';

const post = (id: number, msg: Record<string, unknown>) => (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, ...msg });

function format(v: unknown, depth = 0): string {
  if (typeof v === 'string') return depth ? JSON.stringify(v) : v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === 'function') return `ƒ ${v.name || 'anonymous'}()`;
  if (Array.isArray(v)) return depth > 2 ? '[…]' : `[ ${v.map((x) => format(x, depth + 1)).join(', ')} ]`;
  if (v && typeof v === 'object') {
    if (depth > 2) return '{…}';
    const entries = Object.entries(v).map(([k, x]) => `${k}: ${format(x, depth + 1)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return String(v);
}

// Learner code has no business with the app's offline database.
for (const k of ['indexedDB', 'caches']) {
  try {
    Object.defineProperty(self, k, { value: undefined, configurable: false });
  } catch {
    /* ignore */
  }
}

async function runJs(id: number, code: string) {
  const out = (kind: Out['kind']) => (...args: unknown[]) => post(id, { type: 'out', kind, text: args.map((a) => format(a)).join(' ') });
  const fakeConsole = { log: out('log'), info: out('info'), warn: out('warn'), error: out('error'), debug: out('log'), table: out('log') };
  try {
    const fn = new Function('console', `"use strict";\nreturn (async () => {\n${code}\n})();`);
    await fn(fakeConsole);
    post(id, { type: 'done' });
  } catch (e) {
    post(id, { type: 'out', kind: 'error', text: friendlyJsError(e) });
    post(id, { type: 'done', error: true });
  }
}

function friendlyJsError(e: unknown) {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  if (/is not defined/.test(msg)) return `${msg}\n💡 Check the spelling, or create the variable with let/const before using it.`;
  if (/is not a function/.test(msg)) return `${msg}\n💡 You are calling something that is not a function. Check the name and the brackets.`;
  if (/Unexpected token|Unexpected end/.test(msg)) return `${msg}\n💡 A bracket, quote or comma is probably missing.`;
  return msg;
}

type Pyodide = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (o: { batched: (s: string) => void }) => void;
  setStderr: (o: { batched: (s: string) => void }) => void;
  setStdin: (o: { stdin: () => string | null; isatty?: boolean }) => void;
};
let pyodide: Promise<Pyodide> | null = null;

async function runPython(id: number, code: string, stdin: string) {
  if (!pyodide) {
    post(id, { type: 'status', text: 'Starting Python (first time only — about 10 MB)…' });
    pyodide = import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`).then((m: { loadPyodide: (o: { indexURL: string }) => Promise<Pyodide> }) => m.loadPyodide({ indexURL: PYODIDE }));
    pyodide.catch(() => (pyodide = null));
  }
  let py: Pyodide;
  try {
    py = await pyodide;
  } catch {
    post(id, { type: 'out', kind: 'error', text: 'Python could not start. Connect to the internet once so it can be saved for offline use.' });
    post(id, { type: 'done', error: true });
    return;
  }
  post(id, { type: 'status', text: '' });
  const lines = stdin.length ? stdin.replace(/\r/g, '').split('\n') : [];
  py.setStdout({ batched: (s) => post(id, { type: 'out', kind: 'log', text: s }) });
  py.setStderr({ batched: (s) => post(id, { type: 'out', kind: 'error', text: s }) });
  py.setStdin({ stdin: () => (lines.length ? lines.shift()! : null), isatty: false });
  try {
    // Fresh globals each run so old variables don't leak between runs.
    await py.runPythonAsync(`import sys\n_g = {"__name__": "__main__"}\nexec(compile(${JSON.stringify(code)}, "main.py", "exec"), _g)`);
    post(id, { type: 'done' });
  } catch (e) {
    post(id, { type: 'out', kind: 'error', text: friendlyPyError(String((e as Error).message ?? e)) });
    post(id, { type: 'done', error: true });
  }
}

function friendlyPyError(raw: string) {
  // Drop Pyodide's internal frames; keep the learner's lines.
  const lines = raw.split('\n');
  const start = lines.findIndex((l) => l.includes('File "main.py"'));
  const msg = (start >= 0 ? ['Traceback (most recent call last):', ...lines.slice(start)] : lines).join('\n').trim();
  const last = lines.filter(Boolean).pop() ?? '';
  let tip = '';
  if (last.startsWith('EOFError')) tip = 'Your program asked for input(). Type each answer on its own line in the Input box, then Run again.';
  else if (last.startsWith('IndentationError')) tip = 'Lines inside if/for/def must be indented by the same number of spaces (use 4).';
  else if (last.startsWith('NameError')) tip = 'Python does not know this name. Check the spelling, or give the variable a value first.';
  else if (last.startsWith('SyntaxError')) tip = 'Check for a missing colon ( : ), bracket or quote on the line shown.';
  else if (last.startsWith('TypeError') && /str.*int|int.*str/.test(last)) tip = 'You are mixing text and numbers. Use int() to turn text into a number, or str() for the other way.';
  else if (last.startsWith('ZeroDivisionError')) tip = 'You cannot divide by zero.';
  return tip ? `${msg}\n💡 ${tip}` : msg;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, lang, code, stdin } = e.data;
  void (lang === 'python' ? runPython(id, code, stdin) : runJs(id, code));
};
