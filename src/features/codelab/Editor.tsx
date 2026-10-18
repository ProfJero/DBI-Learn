import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { buildExtensions, type CodeLabSettings } from './extensions';
import { loadLanguage, type FileLang } from './languages';

const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#1f2937' },
  '.cm-gutters': { backgroundColor: '#f8fafc', color: '#94a3b8', borderRight: '1px solid #e2e8f0' },
  '.cm-activeLine': { backgroundColor: '#f0fdf4' },
  '.cm-activeLineGutter': { backgroundColor: '#dcfce7', color: '#166534' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#bfdbfe !important' },
});
const base = EditorView.theme({
  '&': { height: '100%' },
  // No ligatures: beginners must see the real characters (<!-- not an arrow).
  '.cm-scroller': { fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace", lineHeight: '1.6', fontVariantLigatures: 'none' },
  '.cm-content': { paddingBottom: '40vh' },
  '.cm-tooltip-autocomplete ul li': { padding: '4px 8px !important' },
});

export type EditorHandle = { view: EditorView | null };

/**
 * CodeMirror 6 editor. Settings changes are applied through compartments so the
 * document, undo history and cursor survive toggling an extension.
 */
export function CodeEditor({
  value,
  lang,
  settings,
  onChange,
  onRun,
  onFormat,
  handle,
  label,
}: {
  value: string;
  lang: FileLang;
  settings: CodeLabSettings;
  onChange: (v: string) => void;
  onRun?: () => void;
  onFormat?: () => void;
  handle?: React.MutableRefObject<EditorHandle>;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const comps = useRef({ lang: new Compartment(), feat: new Compartment(), theme: new Compartment(), vim: new Compartment(), size: new Compartment() });
  const cb = useRef({ onChange, onRun, onFormat });
  cb.current = { onChange, onRun, onFormat };

  useEffect(() => {
    const c = comps.current;
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          c.vim.of([]),
          basicSetup,
          base,
          c.lang.of([]),
          c.feat.of([]),
          c.theme.of([]),
          c.size.of([]),
          EditorView.contentAttributes.of({ 'aria-label': label, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cb.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    if (handle) handle.current.view = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is created once; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value changes (switching file, loading a project, resetting).
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    void loadLanguage(lang).then((ext) => {
      if (!cancelled) view.current?.dispatch({ effects: comps.current.lang.reconfigure(ext) });
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    const c = comps.current;
    const run = () => cb.current.onRun?.();
    const format = () => cb.current.onFormat?.();
    view.current?.dispatch({
      effects: [
        c.feat.reconfigure(buildExtensions(lang, settings, { onRun: run, onFormat: format })),
        c.theme.reconfigure(settings.theme === 'dark' ? oneDark : lightTheme),
        c.size.reconfigure(EditorView.theme({ '&': { fontSize: `${settings.fontSize}px` } })),
      ],
    });
    let cancelled = false;
    if (settings.enabled.vim) {
      void import('@replit/codemirror-vim').then(({ vim }) => !cancelled && view.current?.dispatch({ effects: c.vim.reconfigure(vim()) }));
    } else {
      view.current?.dispatch({ effects: c.vim.reconfigure([]) });
    }
    return () => {
      cancelled = true;
    };
  }, [lang, settings]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}

/** Inserts text at the cursor — used by the on-screen symbol bar on phones. */
export function insertAtCursor(view: EditorView | null, text: string) {
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '<': '>' };
  const close = pairs[text];
  view.dispatch({
    changes: { from, to, insert: close ? text + view.state.sliceDoc(from, to) + close : text },
    selection: { anchor: from + text.length },
  });
  view.focus();
}
