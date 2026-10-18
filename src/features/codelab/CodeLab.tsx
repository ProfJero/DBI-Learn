import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Eraser,
  FolderOpen,
  Lightbulb,
  Minus,
  Moon,
  Play,
  Plus,
  Puzzle,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Sun,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Markdown } from '@/components/Markdown';
import { Button, Input, Modal } from '@/components/ui';
import { cn, uuid } from '@/lib/utils';
import { CodeEditor, insertAtCursor, type EditorHandle } from './Editor';
import { EXTENSIONS, loadSettings, saveSettings, type CodeLabSettings } from './extensions';
import { languageById, type FileLang, type LangId } from './languages';
import { buildWebDoc, formatCode, runInWorker, runSql, stopWorker, type OutLine, type SqlResult } from './runners';
import { CHALLENGES, challengeById, jsHarness, pythonHarness, webHarness, type Challenge } from './challenges';
import { getDraft, listProjects, markCompleted, saveProject, setDraft, clearDraft, deleteProject, type Project } from './projects';

type Pane = 'task' | 'code' | 'output';
const SYMBOLS = ['<', '>', '/', '=', '"', "'", '(', ')', '{', '}', '[', ']', ';', ':', '.', '#', '+', '-', '*'];

export function CodeLab() {
  const { id: challengeId } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const uid = session!.user.id;
  const qc = useQueryClient();

  const challenge = challengeId ? challengeById(challengeId) : undefined;
  const lang = languageById(challenge?.lang ?? params.get('lang') ?? 'web');
  const projectId = params.get('project');
  const draftId = challenge ? `challenge:${challenge.id}` : projectId ? `project:${projectId}` : params.get('tryit') ? `tryit:${lang.id}` : `free:${lang.id}`;
  const starter = useMemo(() => challenge?.starter ?? lang.starter, [challenge, lang]);

  const [files, setFiles] = useState<Record<string, string>>(starter);
  const [active, setActive] = useState(lang.files[0]!.name);
  const [stdin, setStdin] = useState(challenge?.stdin ?? '');
  const [ready, setReady] = useState(false);
  const [settings, setSettingsState] = useState<CodeLabSettings>(loadSettings);
  const [out, setOut] = useState<OutLine[]>([]);
  const [sql, setSql] = useState<SqlResult[] | null>(null);
  const [tests, setTests] = useState<boolean[] | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [doc, setDoc] = useState('');
  const [docKey, setDocKey] = useState(0);
  const [pane, setPane] = useState<Pane>(challenge ? 'task' : 'code');
  const [showExt, setShowExt] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [hints, setHints] = useState(0);
  const [project, setProject] = useState<Project | null>(null);
  const editor = useRef<EditorHandle>({ view: null });
  const frame = useRef<HTMLIFrameElement>(null);
  const awarded = useRef(false);

  const setSettings = (s: CodeLabSettings) => {
    setSettingsState(s);
    saveSettings(s);
  };

  // Load: lesson "Try it" hand-off → saved project → autosaved draft → starter code.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    awarded.current = false;
    setOut([]);
    setSql(null);
    setTests(null);
    setDoc('');
    setHints(0);
    void (async () => {
      const tryit = (location.state as { tryit?: { file: string; code: string } } | null)?.tryit;
      let next: Record<string, string> = { ...starter };
      let nextStdin = challenge?.stdin ?? '';
      let proj: Project | null = null;
      if (projectId) proj = (await listProjects(uid)).find((p) => p.id === projectId) ?? null;
      if (tryit) {
        next = lang.id === 'web' ? { 'index.html': '', 'style.css': '', 'script.js': '', [tryit.file]: tryit.code } : { [tryit.file]: tryit.code };
      } else if (proj) {
        next = proj.files;
        nextStdin = proj.stdin ?? '';
      } else {
        const d = await getDraft(uid, draftId);
        if (d) {
          next = { ...starter, ...d.files };
          nextStdin = d.stdin ?? nextStdin;
        }
      }
      if (cancelled) return;
      setProject(proj);
      setFiles(next);
      setStdin(nextStdin);
      setActive(tryit?.file && lang.files.some((f) => f.name === tryit.file) ? tryit.file : lang.files[0]!.name);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  // Autosave so nothing is lost if the phone locks or the tab closes.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void setDraft(uid, draftId, { files, stdin }), 700);
    return () => clearTimeout(t);
  }, [files, stdin, ready, uid, draftId]);

  // Console bridge from the web preview iframe.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow || !e.data?.__dbiLab) return;
      if (e.data.kind === 'tests') {
        const r = e.data.results as boolean[];
        setTests(r);
        void onTestsDone(r);
      } else setOut((o) => [...o.slice(-300), { kind: e.data.kind, text: e.data.text }]);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge]);

  async function onTestsDone(results: boolean[]) {
    if (!challenge || !results.length || !results.every(Boolean) || awarded.current) return;
    awarded.current = true;
    await markCompleted(uid, challenge.id);
    void confetti({ particleCount: 120, spread: 75, origin: { y: 0.7 }, colors: ['#03c14b', '#0b7be8', '#ffffff'] });
    if (!navigator.onLine) {
      toast.success('Challenge passed! 🎉 Your XP is added next time you are online.');
      return;
    }
    const { data } = await supabase.rpc('complete_practice', { p_challenge: challenge.id, p_language: challenge.lang, p_xp: challenge.xp });
    const res = data as { new: boolean; xp: number } | null;
    toast.success(res?.new ? `Challenge passed! +${res.xp} XP 🎉` : 'Challenge passed again — great practice! 🎉');
    void qc.invalidateQueries({ queryKey: ['codelab-done'] });
    void qc.invalidateQueries({ queryKey: ['profile'] });
  }

  const run = useCallback(async () => {
    setTests(null);
    setOut([]);
    setSql(null);
    setPane('output');
    if (lang.id === 'web') {
      setDoc(buildWebDoc(files, challenge?.checks ? webHarness(challenge.checks) : undefined));
      setDocKey((k) => k + 1);
      return;
    }
    setRunning(true);
    try {
      if (lang.id === 'sql') {
        const code = files['query.sql'] ?? '';
        const res = await runSql(code);
        if (res.error) setOut([{ kind: 'error', text: res.error }]);
        setSql(res.results);
        if (!res.error && !res.results.length) setOut([{ kind: 'system', text: 'Query ran. It did not return any rows.' }]);
        if (challenge?.expectedSql && !res.error) {
          const exp = await runSql(challenge.expectedSql);
          const r = [sqlMatches(res.results.at(-1), exp.results[0], !!challenge.orderMatters)];
          setTests(r);
          void onTestsDone(r);
        }
        return;
      }
      const file = lang.files[0]!.name;
      const src = files[file] ?? '';
      const testLines: boolean[] = [];
      const code = challenge?.checks ? (lang.id === 'python' ? pythonHarness(challenge.checks, src) : src + jsHarness(challenge.checks)) : src;
      const result = await runInWorker(lang.id as 'javascript' | 'typescript' | 'python', code, {
        stdin,
        onStatus: setStatus,
        onOut: (l) => {
          const lines = l.text.split('\n');
          const visible = lines.filter((line) => {
            const m = line.match(/^__TEST__::(\d+)::(pass|fail)$/);
            if (m) testLines[Number(m[1])] = m[2] === 'pass';
            return !m;
          });
          if (visible.join('').length || l.kind === 'error') setOut((o) => [...o.slice(-500), { ...l, text: visible.join('\n') }]);
        },
      });
      if (challenge?.checks) {
        const r = challenge.checks.map((_, i) => testLines[i] ?? false);
        setTests(r);
        void onTestsDone(r);
      }
      if (result.ok && !challenge) setOut((o) => (o.length ? o : [{ kind: 'system', text: 'Program finished with no output. Use print() / console.log() to show something.' }]));
    } finally {
      setRunning(false);
      setStatus('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, stdin, lang, challenge]);

  // Live Server: refresh the web preview while typing (challenges wait for "Run & check").
  const firstPreview = useRef(true);
  useEffect(() => {
    if (!ready || lang.id !== 'web' || challenge || !settings.enabled.liveserver) return;
    const t = setTimeout(
      () => {
        firstPreview.current = false;
        setDoc(buildWebDoc(files));
        setDocKey((k) => k + 1);
      },
      firstPreview.current ? 0 : 700,
    );
    return () => clearTimeout(t);
  }, [files, ready, lang.id, challenge, settings.enabled.liveserver]);

  const activeLang = lang.files.find((f) => f.name === active)?.lang ?? lang.files[0]!.lang;
  const canFormat = settings.enabled.prettier && ['html', 'css', 'javascript', 'typescript'].includes(activeLang);

  const format = useCallback(async () => {
    if (!canFormat) return;
    try {
      const pretty = await formatCode(files[active] ?? '', activeLang);
      setFiles((f) => ({ ...f, [active]: pretty }));
      toast.success('Code tidied ✨');
    } catch (e) {
      toast.error(`Could not format: ${String((e as Error).message).split('\n')[0]}`);
    }
  }, [canFormat, files, active, activeLang]);

  async function save(name: string) {
    const p: Project = { id: project?.id ?? uuid(), name, lang: lang.id, files, stdin, updated_at: '' };
    await saveProject(uid, p);
    setProject(p);
    if (!projectId) setParams({ lang: lang.id, project: p.id }, { replace: true });
    toast.success('Saved on this device');
  }

  function reset() {
    if (!confirm('Start again with the original code? Your changes will be lost.')) return;
    setFiles({ ...starter });
    setStdin(challenge?.stdin ?? '');
    void clearDraft(uid, draftId);
    setOut([]);
    setTests(null);
  }

  const output = (
    <OutputPanel
      langId={lang.id}
      doc={doc}
      docKey={docKey}
      frame={frame}
      out={out}
      sql={sql}
      status={status}
      stdin={stdin}
      setStdin={setStdin}
      clear={() => setOut([])}
      dark={settings.theme === 'dark'}
    />
  );

  return (
    <div className={cn('flex h-[100dvh] flex-col bg-white dark:bg-ink-950', settings.theme === 'dark' && 'dark')}>
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-ink-100 px-2 dark:border-ink-800 sm:px-4">
        <Link to="/app/practice" className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Back to practice">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-xl" aria-hidden>
          {lang.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink-900 dark:text-white">{challenge?.title ?? project?.name ?? `${lang.label} playground`}</p>
          <p className="hidden truncate text-xs text-ink-500 sm:block">{challenge ? `${challenge.level} · ${challenge.xp} XP` : 'Code Lab · saved automatically on this device'}</p>
        </div>
        <div className="flex items-center gap-1">
          {canFormat && (
            <button onClick={format} title="Format code (Shift+Alt+F)" className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800 md:inline-flex">
              <Sparkles className="h-4 w-4" /> Format
            </button>
          )}
          <IconBtn label="Extensions" onClick={() => setShowExt(true)}>
            <Puzzle className="h-5 w-5" />
          </IconBtn>
          {!challenge && (
            <IconBtn label="My projects" onClick={() => setShowProjects(true)}>
              <FolderOpen className="h-5 w-5" />
            </IconBtn>
          )}
          <IconBtn label="Start again" onClick={reset}>
            <RotateCcw className="h-5 w-5" />
          </IconBtn>
          {running ? (
            <Button
              variant="danger"
              icon={<Square className="h-4 w-4" />}
              onClick={() => {
                stopWorker();
                setRunning(false);
                setOut((o) => [...o, { kind: 'system', text: 'Stopped.' }]);
              }}
            >
              Stop
            </Button>
          ) : (
            <Button onClick={run} icon={<Play className="h-4 w-4 fill-current" />} title="Run (Ctrl+Enter)">
              {challenge ? 'Run & check' : 'Run'}
            </Button>
          )}
        </div>
      </header>

      {/* Phone tabs */}
      <div className="flex shrink-0 border-b border-ink-100 dark:border-ink-800 lg:hidden" role="tablist">
        {(challenge ? (['task', 'code', 'output'] as Pane[]) : (['code', 'output'] as Pane[])).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={pane === p}
            onClick={() => setPane(p)}
            className={cn('flex-1 py-2.5 text-sm font-semibold capitalize', pane === p ? 'border-b-2 border-brand-500 text-brand-700 dark:text-brand-300' : 'text-ink-500')}
          >
            {p === 'output' ? (lang.id === 'web' ? 'Preview' : 'Output') : p === 'task' ? 'Task' : 'Code'}
            {p === 'task' && tests && <span className="ml-1">{tests.every(Boolean) ? '✅' : `${tests.filter(Boolean).length}/${tests.length}`}</span>}
          </button>
        ))}
      </div>

      <div
        className={cn(
          'grid min-h-0 flex-1',
          challenge ? 'lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1.2fr)_minmax(0,1fr)]' : 'lg:grid-cols-2',
        )}
      >
        {challenge && (
          <aside className={cn('min-h-0 overflow-y-auto border-r border-ink-100 p-5 dark:border-ink-800', pane === 'task' ? 'block' : 'hidden', 'lg:block')}>
            <TaskPanel challenge={challenge} tests={tests} hints={hints} showHint={() => setHints((h) => h + 1)} onNext={(id) => navigate(`/app/practice/challenge/${id}`)} />
          </aside>
        )}

        <section className={cn('min-h-0 flex-col border-r border-ink-100 dark:border-ink-800', pane === 'code' ? 'flex' : 'hidden', 'lg:flex')}>
          {lang.files.length > 1 && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-100 bg-ink-50 px-2 pt-2 dark:border-ink-800 dark:bg-ink-900">
              {lang.files.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setActive(f.name)}
                  className={cn(
                    'whitespace-nowrap rounded-t-lg px-3 py-2 font-mono text-xs font-semibold',
                    active === f.name ? 'bg-white text-ink-900 dark:bg-ink-950 dark:text-white' : 'text-ink-500 hover:text-ink-800 dark:hover:text-ink-200',
                  )}
                >
                  <FileDot lang={f.lang} /> {f.name}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1">
            {ready && (
              <CodeEditor
                key={`${draftId}:${active}`}
                label={`${active} code editor`}
                value={files[active] ?? ''}
                lang={activeLang as FileLang}
                settings={settings}
                handle={editor}
                onChange={(v) => setFiles((f) => ({ ...f, [active]: v }))}
                onRun={run}
                onFormat={format}
              />
            )}
          </div>
          {/* Symbol bar: the keys that are hard to find on phone keyboards */}
          <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-ink-100 bg-ink-50 p-1.5 dark:border-ink-800 dark:bg-ink-900 lg:hidden" aria-label="Insert symbol">
            <button className="rounded-lg bg-white px-3 py-2 font-mono text-sm font-semibold shadow-sm dark:bg-ink-800" onClick={() => insertAtCursor(editor.current.view, '  ')}>
              Tab
            </button>
            {SYMBOLS.map((s) => (
              <button key={s} className="min-w-[2.5rem] rounded-lg bg-white px-2 py-2 font-mono text-base font-semibold shadow-sm dark:bg-ink-800 dark:text-white" onClick={() => insertAtCursor(editor.current.view, s)}>
                {s}
              </button>
            ))}
          </div>
        </section>

        <section className={cn('min-h-0', pane === 'output' ? 'flex' : 'hidden', 'flex-col lg:flex')}>
          {output}
          {challenge && tests && (
            <div className="shrink-0 border-t border-ink-100 p-3 dark:border-ink-800 lg:hidden">
              <TestList challenge={challenge} tests={tests} />
            </div>
          )}
        </section>
      </div>

      <ExtensionsDrawer open={showExt} onClose={() => setShowExt(false)} settings={settings} setSettings={setSettings} />
      {!challenge && <ProjectsModal open={showProjects} onClose={() => setShowProjects(false)} uid={uid} current={project} onSave={save} langId={lang.id} />}
    </div>
  );
}

function sqlMatches(got: SqlResult | undefined, exp: SqlResult | undefined, ordered: boolean) {
  if (!got || !exp) return false;
  if (got.columns.length !== exp.columns.length) return false;
  const rows = (r: SqlResult) => r.values.map((v) => JSON.stringify(v));
  const a = rows(got);
  const b = rows(exp);
  if (a.length !== b.length) return false;
  return ordered ? a.every((x, i) => x === b[i]) : [...a].sort().join('|') === [...b].sort().join('|');
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 hover:text-ink-800 dark:hover:bg-ink-800 dark:hover:text-ink-100">
      {children}
    </button>
  );
}

function FileDot({ lang }: { lang: FileLang }) {
  const c = { html: '#e34c26', css: '#264de4', javascript: '#f7df1e', typescript: '#3178c6', python: '#3776ab', sql: '#0b7be8' }[lang];
  return <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: c }} />;
}

function OutputPanel({
  langId,
  doc,
  docKey,
  frame,
  out,
  sql,
  status,
  stdin,
  setStdin,
  clear,
  dark,
}: {
  langId: LangId;
  doc: string;
  docKey: number;
  frame: React.RefObject<HTMLIFrameElement | null>;
  out: OutLine[];
  sql: SqlResult[] | null;
  status: string;
  stdin: string;
  setStdin: (s: string) => void;
  clear: () => void;
  dark: boolean;
}) {
  const consoleEl = (
    <div className={cn('flex min-h-0 flex-col', langId === 'web' ? 'h-40 shrink-0 border-t border-ink-100 dark:border-ink-800' : 'flex-1')}>
      <div className="flex shrink-0 items-center justify-between bg-ink-50 px-3 py-1.5 dark:bg-ink-900">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
          <Terminal className="h-3.5 w-3.5" /> {langId === 'sql' ? 'Messages' : 'Console'}
        </span>
        <button onClick={clear} className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 dark:hover:text-ink-200" aria-label="Clear console">
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
      <pre className={cn('min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[13px] leading-relaxed', dark ? 'bg-ink-950 text-ink-100' : 'bg-white text-ink-800')} aria-live="polite">
        {status && <div className="text-sky-500">{status}</div>}
        {out.map((l, i) => (
          <div key={i} className={cn(l.kind === 'error' && 'text-red-500', l.kind === 'warn' && 'text-amber-500', l.kind === 'system' && 'italic text-ink-400', l.kind === 'info' && 'text-sky-500')}>
            {l.text}
          </div>
        ))}
        {!out.length && !status && <span className="text-ink-400">{langId === 'web' ? 'console.log() messages appear here.' : 'Press Run to see the output here.'}</span>}
      </pre>
    </div>
  );

  return (
    <>
      {langId === 'web' && (
        <div className="min-h-0 flex-1 bg-white">
          {doc ? (
            <iframe key={docKey} ref={frame} title="Web page preview" srcDoc={doc} sandbox="allow-scripts allow-modals allow-forms" className="h-full w-full border-0 bg-white" />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-ink-400">Press Run to see your page.</div>
          )}
        </div>
      )}
      {langId === 'sql' && sql && sql.length > 0 && (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {sql.map((r, i) => (
            <div key={i} className="mb-4 overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500 dark:bg-ink-900">
                  <tr>
                    {r.columns.map((c) => (
                      <th key={c} className="px-3 py-2">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {r.values.slice(0, 500).map((row, j) => (
                    <tr key={j}>
                      {row.map((v, k) => (
                        <td key={k} className="px-3 py-1.5 font-mono text-[13px] dark:text-ink-100">
                          {v === null ? <span className="text-ink-400">NULL</span> : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-ink-100 px-3 py-1.5 text-xs text-ink-500 dark:border-ink-800">{r.values.length} rows</p>
            </div>
          ))}
        </div>
      )}
      {consoleEl}
      {langId === 'python' && (
        <div className="shrink-0 border-t border-ink-100 p-2 dark:border-ink-800">
          <label htmlFor="lab-stdin" className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Input — one answer per line for input()
          </label>
          <textarea
            id="lab-stdin"
            rows={2}
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-200 bg-white p-2 font-mono text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white"
            placeholder="e.g. Ama"
          />
        </div>
      )}
    </>
  );
}

function TestList({ challenge, tests }: { challenge: Challenge; tests: boolean[] | null }) {
  const names = challenge.checks?.map((c) => c.name) ?? ['Your result matches the expected table'];
  return (
    <ul className="space-y-1.5">
      {names.map((n, i) => {
        const r = tests?.[i];
        return (
          <li key={n} className="flex items-start gap-2 text-sm">
            {r === undefined ? <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" /> : r ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
            <span className={cn(r === false && 'text-red-600 dark:text-red-400', 'dark:text-ink-200')}>{n}</span>
          </li>
        );
      })}
    </ul>
  );
}

function TaskPanel({ challenge, tests, hints, showHint, onNext }: { challenge: Challenge; tests: boolean[] | null; hints: number; showHint: () => void; onNext: (id: string) => void }) {
  const passed = !!tests?.length && tests.every(Boolean);
  const next = nextOf(challenge);
  return (
    <div className="dark:text-ink-100">
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
        <BookOpen className="h-3.5 w-3.5" /> {challenge.level} · {challenge.xp} XP
      </span>
      <h1 className="mt-2 text-xl font-bold">{challenge.title}</h1>
      <Markdown className="mt-3">{challenge.task}</Markdown>
      <div className="mt-5 rounded-2xl border border-ink-100 p-4 dark:border-ink-800">
        <p className="mb-2 text-sm font-semibold">Checks</p>
        <TestList challenge={challenge} tests={tests} />
        {!tests && <p className="mt-2 text-xs text-ink-500">Press “Run &amp; check” to test your code.</p>}
      </div>
      {passed ? (
        <div className="mt-4 rounded-2xl bg-brand-50 p-4 text-brand-900 dark:bg-brand-950/50 dark:text-brand-100">
          <p className="flex items-center gap-2 font-bold">
            <Check className="h-5 w-5" /> Well done! Challenge complete.
          </p>
          {next && (
            <Button className="mt-3" onClick={() => onNext(next.id)}>
              Next: {next.title}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {challenge.hints.slice(0, hints).map((h, i) => (
            <div key={i} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
              <Markdown>{h}</Markdown>
            </div>
          ))}
          {hints < challenge.hints.length && (
            <Button variant="outline" size="sm" icon={<Lightbulb className="h-4 w-4" />} onClick={showHint}>
              {hints ? 'Another hint' : 'Show a hint'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** The next challenge in the same language, then the next one overall. */
function nextOf(c: Challenge) {
  const same = CHALLENGES.filter((x) => x.lang === c.lang);
  const i = same.findIndex((x) => x.id === c.id);
  return same[i + 1] ?? CHALLENGES[CHALLENGES.findIndex((x) => x.id === c.id) + 1];
}

function ExtensionsDrawer({ open, onClose, settings, setSettings }: { open: boolean; onClose: () => void; settings: CodeLabSettings; setSettings: (s: CodeLabSettings) => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ext-title"
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-ink-900 dark:text-ink-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 p-4 dark:border-ink-800">
          <h2 id="ext-title" className="flex items-center gap-2 text-lg font-bold">
            <Puzzle className="h-5 w-5 text-brand-500" /> Extensions
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Text size</span>
            <div className="flex items-center gap-2">
              <IconBtn label="Smaller text" onClick={() => setSettings({ ...settings, fontSize: Math.max(11, settings.fontSize - 1) })}>
                <Minus className="h-4 w-4" />
              </IconBtn>
              <span className="w-8 text-center font-mono text-sm">{settings.fontSize}</span>
              <IconBtn label="Bigger text" onClick={() => setSettings({ ...settings, fontSize: Math.min(26, settings.fontSize + 1) })}>
                <Plus className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Editor theme</span>
            <div className="inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSettings({ ...settings, theme: t })}
                  className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm capitalize', settings.theme === t && 'bg-white shadow-sm dark:bg-ink-700')}
                >
                  {t === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto dark:divide-ink-800">
          {EXTENSIONS.map((e) => {
            const on = settings.enabled[e.id];
            return (
              <li key={e.id} className="flex gap-3 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-2xl dark:bg-ink-800" aria-hidden>
                  {e.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {e.name} <span className="font-normal text-ink-400">· {e.publisher}</span>
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">{e.description}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={on}
                  aria-label={`${e.name} ${on ? 'on' : 'off'}`}
                  onClick={() => setSettings({ ...settings, enabled: { ...settings.enabled, [e.id]: !on } })}
                  className={cn('relative mt-1 h-6 w-11 shrink-0 rounded-full transition', on ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700')}
                >
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-ink-100 p-3 text-center text-xs text-ink-400 dark:border-ink-800">Shortcuts: Ctrl+Enter run · Tab expand Emmet · Ctrl+Space suggestions · Ctrl+F find</p>
      </div>
    </div>
  );
}

function ProjectsModal({ open, onClose, uid, current, onSave, langId }: { open: boolean; onClose: () => void; uid: string; current: Project | null; onSave: (name: string) => Promise<void>; langId: LangId }) {
  const navigate = useNavigate();
  const [list, setList] = useState<Project[]>([]);
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) {
      void listProjects(uid).then(setList);
      setName(current?.name ?? '');
    }
  }, [open, uid, current]);
  return (
    <Modal open={open} onClose={onClose} title="My projects">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await onSave(name.trim());
          setList(await listProjects(uid));
        }}
      >
        <Input aria-label="Project name" placeholder="Name this project, e.g. My portfolio" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" icon={<Save className="h-4 w-4" />}>
          Save
        </Button>
      </form>
      <p className="mt-2 text-xs text-ink-500">Projects are saved on this device and work offline.</p>
      <ul className="mt-4 divide-y divide-ink-100 dark:divide-ink-800">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="text-xl">{languageById(p.lang).emoji}</span>
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                onClose();
                navigate(`/app/practice/code?lang=${p.lang}&project=${p.id}`);
              }}
            >
              <span className="block truncate text-sm font-semibold">{p.name}</span>
              <span className="block text-xs text-ink-500">
                {languageById(p.lang).label} · {new Date(p.updated_at).toLocaleDateString()}
              </span>
            </button>
            <button
              aria-label={`Delete ${p.name}`}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
              onClick={async () => {
                if (!confirm(`Delete “${p.name}”?`)) return;
                await deleteProject(uid, p.id);
                setList(await listProjects(uid));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {!list.length && <li className="py-4 text-center text-sm text-ink-500">No saved projects yet.</li>}
      </ul>
      {current && (
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => {
            onClose();
            navigate(`/app/practice/code?lang=${langId}`);
          }}
        >
          New blank {languageById(langId).label} file
        </Button>
      )}
    </Modal>
  );
}
