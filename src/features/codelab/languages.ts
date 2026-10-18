import type { Extension } from '@codemirror/state';

export type LangId = 'web' | 'javascript' | 'typescript' | 'python' | 'sql';
export type FileLang = 'html' | 'css' | 'javascript' | 'typescript' | 'python' | 'sql';

export type LanguageDef = {
  id: LangId;
  label: string;
  /** Short, friendly description for JHS/SHS learners. */
  blurb: string;
  emoji: string;
  color: string;
  files: { name: string; lang: FileLang }[];
  starter: Record<string, string>;
};

export const LANGUAGES: LanguageDef[] = [
  {
    id: 'web',
    label: 'HTML, CSS & JavaScript',
    blurb: 'Build web pages and see them live as you type.',
    emoji: '🌐',
    color: '#e34c26',
    files: [
      { name: 'index.html', lang: 'html' },
      { name: 'style.css', lang: 'css' },
      { name: 'script.js', lang: 'javascript' },
    ],
    starter: {
      'index.html': `<!-- Tip: type  h1  or  ul>li*3  and press Tab (Emmet) -->
<main class="card">
  <h1>Akwaaba! 👋</h1>
  <p>Edit this page and watch the preview change.</p>
  <button id="btn">Click me</button>
</main>
`,
      'style.css': `body {
  font-family: system-ui, sans-serif;
  background: #f0fdf4;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
}
.card {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 10px 30px rgb(3 193 75 / 0.15);
  text-align: center;
}
button {
  background: #03c14b;
  color: white;
  border: 0;
  padding: 0.7rem 1.4rem;
  border-radius: 999px;
  font-size: 1rem;
}
`,
      'script.js': `const btn = document.querySelector('#btn');
let clicks = 0;
btn.addEventListener('click', () => {
  clicks++;
  btn.textContent = 'Clicked ' + clicks + ' times';
  console.log('Button clicked', clicks);
});
`,
    },
  },
  {
    id: 'python',
    label: 'Python',
    blurb: 'The friendly language used for science, data and AI.',
    emoji: '🐍',
    color: '#3776ab',
    files: [{ name: 'main.py', lang: 'python' }],
    starter: {
      'main.py': `# Python runs right here in your browser.
name = input("What is your name? ")
print(f"Hello, {name}! Welcome to DBI Learn.")

scores = [72, 85, 90, 64]
average = sum(scores) / len(scores)
print("Average score:", round(average, 1))
`,
    },
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    blurb: 'The language of the web. Practise logic and functions.',
    emoji: '⚡',
    color: '#f7df1e',
    files: [{ name: 'main.js', lang: 'javascript' }],
    starter: {
      'main.js': `// Press Run (or Ctrl+Enter) to see the output below.
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('Ama'));

const fruits = ['mango', 'pawpaw', 'orange'];
fruits.forEach((f, i) => console.log(i + 1, f));
`,
    },
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    blurb: 'JavaScript with types — used by professional teams.',
    emoji: '🔷',
    color: '#3178c6',
    files: [{ name: 'main.ts', lang: 'typescript' }],
    starter: {
      'main.ts': `type Student = { name: string; score: number };

const students: Student[] = [
  { name: 'Kofi', score: 78 },
  { name: 'Esi', score: 91 },
];

const best = students.reduce((a, b) => (a.score > b.score ? a : b));
console.log(\`Top student: \${best.name} (\${best.score})\`);
`,
    },
  },
  {
    id: 'sql',
    label: 'SQL (databases)',
    blurb: 'Ask questions of data in a sample school database.',
    emoji: '🗃️',
    color: '#0b7be8',
    files: [{ name: 'query.sql', lang: 'sql' }],
    starter: {
      'query.sql': `-- Tables: students, subjects, scores. Try changing the query!
SELECT s.name, s.class, ROUND(AVG(sc.mark), 1) AS average
FROM students s
JOIN scores sc ON sc.student_id = s.id
GROUP BY s.id
ORDER BY average DESC;
`,
    },
  },
];

export const languageById = (id: string) => LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0]!;

/** Loads the CodeMirror language support lazily so each language only costs bytes when used. */
export async function loadLanguage(lang: FileLang): Promise<Extension> {
  switch (lang) {
    case 'html':
      return (await import('@codemirror/lang-html')).html({ autoCloseTags: true });
    case 'css':
      return (await import('@codemirror/lang-css')).css();
    case 'javascript':
      return (await import('@codemirror/lang-javascript')).javascript();
    case 'typescript':
      return (await import('@codemirror/lang-javascript')).javascript({ typescript: true });
    case 'python':
      return (await import('@codemirror/lang-python')).python();
    case 'sql': {
      const { sql, SQLite } = await import('@codemirror/lang-sql');
      return sql({
        dialect: SQLite,
        upperCaseKeywords: true,
        schema: { students: ['id', 'name', 'class', 'gender', 'age'], subjects: ['id', 'name'], scores: ['student_id', 'subject_id', 'term', 'mark'] },
      });
    }
  }
}

export const emmetSyntax = (lang: FileLang) => (lang === 'html' ? 'html' : lang === 'css' ? 'css' : null);
