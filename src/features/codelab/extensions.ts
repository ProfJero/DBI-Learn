import { autocompletion, closeBrackets, completeAnyWord, snippetCompletion, type Completion, type CompletionSource } from '@codemirror/autocomplete';
import { bracketMatching, syntaxTree } from '@codemirror/language';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { abbreviationTracker, expandAbbreviation } from '@emmetio/codemirror6-plugin';
import { indentationMarkers } from '@replit/codemirror-indentation-markers';
import { colorPicker } from '@replit/codemirror-css-color-picker';
import { emmetSyntax, type FileLang } from './languages';

/**
 * The Code Lab "marketplace": editor features learners switch on and off, modelled on the
 * VS Code extensions most beginners install. All run locally — nothing is downloaded at runtime.
 */
export type ExtensionId =
  | 'emmet'
  | 'intellisense'
  | 'snippets'
  | 'autoclose'
  | 'errorlens'
  | 'indentguides'
  | 'colors'
  | 'brackets'
  | 'prettier'
  | 'liveserver'
  | 'wordwrap'
  | 'vim';

export type ExtensionInfo = { id: ExtensionId; name: string; publisher: string; description: string; icon: string; defaultOn: boolean; langs?: FileLang[] };

export const EXTENSIONS: ExtensionInfo[] = [
  { id: 'emmet', name: 'Emmet', publisher: 'emmetio', icon: '⚡', defaultOn: true, langs: ['html', 'css'], description: 'Type short codes like ul>li*3 or .card and press Tab to expand them into full HTML/CSS.' },
  { id: 'intellisense', name: 'IntelliSense', publisher: 'DBI Learn', icon: '💡', defaultOn: true, description: 'Suggestions as you type: tags, properties, keywords and words already in your file.' },
  { id: 'snippets', name: 'Starter Snippets', publisher: 'DBI Learn', icon: '🧩', defaultOn: true, description: 'Ready-made blocks: type “for”, “def”, “func” or “!” and pick from the list.' },
  { id: 'autoclose', name: 'Auto Close', publisher: 'DBI Learn', icon: '🔒', defaultOn: true, description: 'Closes brackets, quotes and HTML tags for you.' },
  { id: 'errorlens', name: 'Error Lens', publisher: 'DBI Learn', icon: '🔴', defaultOn: true, description: 'Underlines mistakes in your code and explains them right where they happen.' },
  { id: 'indentguides', name: 'Indent Guides', publisher: 'replit', icon: '📏', defaultOn: true, description: 'Draws faint lines so you can see which code is inside which block.' },
  { id: 'colors', name: 'Color Picker', publisher: 'replit', icon: '🎨', defaultOn: true, langs: ['css', 'html'], description: 'Shows a colour swatch next to CSS colours. Click it to pick a new colour.' },
  { id: 'brackets', name: 'Bracket Pair Highlighter', publisher: 'DBI Learn', icon: '🧷', defaultOn: true, description: 'Highlights the matching bracket when your cursor is next to one.' },
  { id: 'prettier', name: 'Prettier – Code formatter', publisher: 'prettier', icon: '✨', defaultOn: true, description: 'Tidies your code with one click (Format) or Shift+Alt+F.', langs: ['html', 'css', 'javascript', 'typescript'] },
  { id: 'liveserver', name: 'Live Server', publisher: 'DBI Learn', icon: '📡', defaultOn: true, description: 'Refreshes the web preview automatically while you type.', langs: ['html', 'css', 'javascript'] },
  { id: 'wordwrap', name: 'Word Wrap', publisher: 'DBI Learn', icon: '↩️', defaultOn: true, description: 'Wraps long lines so you never scroll sideways — best on phones.' },
  { id: 'vim', name: 'Vim', publisher: 'replit', icon: '⌨️', defaultOn: false, description: 'Vim keyboard controls for advanced users. Leave off if you are not sure.' },
];

export type CodeLabSettings = { enabled: Record<ExtensionId, boolean>; fontSize: number; theme: 'light' | 'dark' };

const KEY = 'dbi:codelab:settings';
export function loadSettings(): CodeLabSettings {
  const defaults: CodeLabSettings = {
    enabled: Object.fromEntries(EXTENSIONS.map((e) => [e.id, e.defaultOn])) as Record<ExtensionId, boolean>,
    fontSize: 15,
    theme: typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CodeLabSettings> | null;
    return saved ? { ...defaults, ...saved, enabled: { ...defaults.enabled, ...saved.enabled } } : defaults;
  } catch {
    return defaults;
  }
}
export function saveSettings(s: CodeLabSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

const SNIPPETS: Partial<Record<FileLang, Completion[]>> = {
  html: [
    snippetCompletion('<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${Document}</title>\n</head>\n<body>\n  ${}\n</body>\n</html>', { label: '!', detail: 'HTML page skeleton', type: 'keyword' }),
    snippetCompletion('<a href="${#}">${link text}</a>', { label: 'link', detail: '<a> link', type: 'keyword' }),
    snippetCompletion('<img src="${url}" alt="${description}">', { label: 'img', detail: 'image', type: 'keyword' }),
    snippetCompletion('<form>\n  <label for="${name}">${Name}</label>\n  <input id="${name}" name="${name}">\n  <button type="submit">Send</button>\n</form>', { label: 'form', detail: 'simple form', type: 'keyword' }),
  ],
  css: [
    snippetCompletion('display: flex;\njustify-content: ${center};\nalign-items: ${center};', { label: 'flex', detail: 'flexbox centre', type: 'keyword' }),
    snippetCompletion('display: grid;\ngrid-template-columns: repeat(${3}, 1fr);\ngap: ${1rem};', { label: 'grid', detail: 'grid columns', type: 'keyword' }),
    snippetCompletion('@media (max-width: ${600}px) {\n  ${}\n}', { label: '@media', detail: 'phone styles', type: 'keyword' }),
  ],
  javascript: jsSnippets(),
  typescript: jsSnippets(),
  python: [
    snippetCompletion('for ${item} in ${items}:\n    ${pass}', { label: 'for', detail: 'for loop', type: 'keyword' }),
    snippetCompletion('for ${i} in range(${10}):\n    ${pass}', { label: 'forr', detail: 'for … in range', type: 'keyword' }),
    snippetCompletion('def ${name}(${params}):\n    ${pass}', { label: 'def', detail: 'function', type: 'keyword' }),
    snippetCompletion('if ${condition}:\n    ${pass}\nelse:\n    ${pass}', { label: 'ifelse', detail: 'if / else', type: 'keyword' }),
    snippetCompletion('while ${condition}:\n    ${pass}', { label: 'while', detail: 'while loop', type: 'keyword' }),
    snippetCompletion('class ${Name}:\n    def __init__(self, ${args}):\n        ${pass}', { label: 'class', detail: 'class', type: 'keyword' }),
    snippetCompletion('print(f"${text} {${value}}")', { label: 'printf', detail: 'print with f-string', type: 'function' }),
  ],
  sql: [
    snippetCompletion('SELECT ${*}\nFROM ${students}\nWHERE ${condition};', { label: 'sel', detail: 'SELECT … WHERE', type: 'keyword' }),
    snippetCompletion('SELECT ${column}, COUNT(*)\nFROM ${table}\nGROUP BY ${column};', { label: 'group', detail: 'GROUP BY count', type: 'keyword' }),
  ],
};
function jsSnippets() {
  return [
    snippetCompletion('for (let ${i} = 0; ${i} < ${10}; ${i}++) {\n  ${}\n}', { label: 'for', detail: 'for loop', type: 'keyword' }),
    snippetCompletion('function ${name}(${params}) {\n  ${}\n}', { label: 'func', detail: 'function', type: 'keyword' }),
    snippetCompletion('const ${name} = (${params}) => {\n  ${}\n};', { label: 'arrow', detail: 'arrow function', type: 'keyword' }),
    snippetCompletion('if (${condition}) {\n  ${}\n} else {\n  ${}\n}', { label: 'ifelse', detail: 'if / else', type: 'keyword' }),
    snippetCompletion('console.log(${});', { label: 'log', detail: 'console.log', type: 'function' }),
    snippetCompletion("document.querySelector('${selector}')", { label: 'qs', detail: 'querySelector', type: 'function' }),
    snippetCompletion("${el}.addEventListener('${click}', (event) => {\n  ${}\n});", { label: 'listen', detail: 'event listener', type: 'function' }),
  ];
}

/** Syntax errors from the parse tree — works for every language without extra downloads. */
function syntaxErrors(lang: FileLang) {
  return linter(
    (view): Diagnostic[] => {
      const found: Diagnostic[] = [];
      syntaxTree(view.state).iterate({
        enter: (n) => {
          if (n.type.isError && found.length < 20) {
            const from = n.from;
            const to = Math.max(n.to, Math.min(from + 1, view.state.doc.length));
            const line = view.state.doc.lineAt(from);
            found.push({ from, to, severity: 'error', message: hint(lang, line.text) });
          }
        },
      });
      if (lang === 'javascript') {
        // The JS parser is forgiving; ask the engine for an exact message without running the code.
        try {
          new Function(view.state.doc.toString());
        } catch (e) {
          if (e instanceof SyntaxError && !found.length) found.push({ from: 0, to: Math.min(1, view.state.doc.length), severity: 'error', message: e.message });
        }
      }
      return found;
    },
    { delay: 600 },
  );
}
function hint(lang: FileLang, line: string) {
  if (lang === 'python' && /^\s*(if|for|while|def|elif|else|class|try|except)\b[^:]*$/.test(line)) return 'Something is missing here — Python needs a colon ( : ) at the end of this line.';
  if (/[([{]/.test(line) && !/[)\]}]/.test(line)) return 'A bracket may not be closed. Check ( ) [ ] { } come in pairs.';
  if ((line.match(/"/g)?.length ?? 0) % 2 === 1 || (line.match(/'/g)?.length ?? 0) % 2 === 1) return 'A quote may not be closed. Strings need a quote at both ends.';
  return 'This part of the code is not written correctly. Check for typos or missing symbols.';
}

/** Builds the editor extensions for a file from the learner's settings. */
export function buildExtensions(lang: FileLang, s: CodeLabSettings, opts: { onFormat?: () => void; onRun?: () => void }): Extension[] {
  const on = (id: ExtensionId) => s.enabled[id] && (!EXTENSIONS.find((e) => e.id === id)!.langs || EXTENSIONS.find((e) => e.id === id)!.langs!.includes(lang));
  const ext: Extension[] = [];
  const keys: { key: string; run: (v: EditorView) => boolean; preventDefault?: boolean }[] = [];
  if (opts.onRun) keys.push({ key: 'Mod-Enter', run: () => (opts.onRun!(), true) }, { key: 'Mod-s', run: () => (opts.onRun!(), true), preventDefault: true });
  if (opts.onFormat && on('prettier')) keys.push({ key: 'Shift-Alt-f', run: () => (opts.onFormat!(), true) });

  const syntax = emmetSyntax(lang);
  if (on('emmet') && syntax) {
    ext.push(abbreviationTracker({ syntax: syntax as never }));
    keys.push({ key: 'Tab', run: expandAbbreviation });
  }
  ext.push(keymap.of(keys));

  const sources: CompletionSource[] = [];
  if (on('snippets') && SNIPPETS[lang]) {
    const list = SNIPPETS[lang]!;
    sources.push((ctx) => {
      const word = ctx.matchBefore(/[\w!@]*/);
      if (!word || (word.from === word.to && !ctx.explicit)) return null;
      return { from: word.from, options: list, validFor: /^[\w!@]*$/ };
    });
  }
  if (on('intellisense')) {
    sources.push(completeAnyWord);
    ext.push(autocompletion({ activateOnTyping: true, icons: true, defaultKeymap: true, closeOnBlur: true }));
  } else if (sources.length) {
    ext.push(autocompletion({ activateOnTyping: true }));
  }
  // Language completions come from the language data; extra sources are added alongside them.
  if (sources.length) ext.push(...sources.map((src) => completionData(src)));
  if (on('autoclose')) ext.push(closeBrackets());
  if (on('errorlens') && lang !== 'sql') ext.push(syntaxErrors(lang), lintGutter());
  if (on('indentguides')) ext.push(indentationMarkers({ thickness: 1 }));
  if (on('colors')) ext.push(colorPicker);
  if (on('brackets')) ext.push(bracketMatching());
  if (on('wordwrap')) ext.push(EditorView.lineWrapping);
  return ext;
}

function completionData(source: CompletionSource): Extension {
  return EditorState.languageData.of(() => [{ autocomplete: source }]);
}
