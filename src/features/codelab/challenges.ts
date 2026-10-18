import type { LangId } from './languages';

export type Check = { name: string; expr: string };
export type Challenge = {
  id: string;
  title: string;
  lang: LangId;
  level: 'Starter' | 'Explorer' | 'Builder';
  xp: number;
  /** Markdown instructions, short sentences for JHS/SHS readers. */
  task: string;
  starter: Record<string, string>;
  hints: string[];
  /** Web/JS: JS expressions; Python: Python expressions. Each must be true to pass. */
  checks?: Check[];
  /** SQL: the reference query; the learner's result must match it. */
  expectedSql?: string;
  orderMatters?: boolean;
  stdin?: string;
};

const web = (html: string, css = '', js = '') => ({ 'index.html': html, 'style.css': css, 'script.js': js });

export const CHALLENGES: Challenge[] = [
  // ---------------------------------------------------------------- Web
  {
    id: 'web-hello',
    title: 'Your first web page',
    lang: 'web',
    level: 'Starter',
    xp: 10,
    task: 'Make a page about yourself.\n\n1. Add an `h1` heading with your name.\n2. Add a paragraph `p` that says what you like.\n\n💡 Try Emmet: type `h1` then press **Tab**.',
    starter: web('<!-- Write your page here -->\n'),
    hints: ['Headings look like `<h1>Kofi</h1>`.', 'A paragraph looks like `<p>I like football.</p>`.'],
    checks: [
      { name: 'There is an h1 heading', expr: "!!document.querySelector('h1')" },
      { name: 'The heading is not empty', expr: "(document.querySelector('h1')?.textContent || '').trim().length > 1" },
      { name: 'There is a paragraph', expr: "(document.querySelector('p')?.textContent || '').trim().length > 3" },
    ],
  },
  {
    id: 'web-list',
    title: 'Favourite foods list',
    lang: 'web',
    level: 'Starter',
    xp: 10,
    task: 'Make a list of **at least 3** Ghanaian foods you love.\n\nUse a `ul` list with `li` items.\n\n⚡ Emmet shortcut: `ul>li*3` then **Tab**.',
    starter: web('<h2>My favourite foods</h2>\n'),
    hints: ['A list starts with `<ul>` and ends with `</ul>`.', 'Each food goes in its own `<li>…</li>`.'],
    checks: [
      { name: 'There is a ul list', expr: "!!document.querySelector('ul')" },
      { name: 'The list has 3 or more items', expr: "document.querySelectorAll('ul > li').length >= 3" },
      { name: 'No list item is empty', expr: "[...document.querySelectorAll('ul > li')].every(li => li.textContent.trim().length > 0)" },
    ],
  },
  {
    id: 'web-style',
    title: 'Style a card',
    lang: 'web',
    level: 'Explorer',
    xp: 15,
    task: 'Make the card look nice using **style.css**:\n\n1. Give `.card` a background colour.\n2. Give it rounded corners with `border-radius`.\n3. Add some `padding`.',
    starter: web('<div class="card">\n  <h2>Black Stars</h2>\n  <p>Ghana national football team.</p>\n</div>\n', '.card {\n  \n}\n'),
    hints: ['Inside `.card { }` write `background: #dcfce7;`', 'Rounded corners: `border-radius: 12px;`', 'Space inside: `padding: 16px;`'],
    checks: [
      { name: 'The card has a background colour', expr: "(() => { const b = getComputedStyle(document.querySelector('.card')).backgroundColor; return b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent'; })()" },
      { name: 'The card has rounded corners', expr: "parseFloat(getComputedStyle(document.querySelector('.card')).borderTopLeftRadius) > 0" },
      { name: 'The card has padding', expr: "parseFloat(getComputedStyle(document.querySelector('.card')).paddingTop) > 0" },
    ],
  },
  {
    id: 'web-link-image',
    title: 'Links and images',
    lang: 'web',
    level: 'Explorer',
    xp: 15,
    task: 'Add:\n\n1. A link (`a`) to `https://dbi.org.gh` with some text.\n2. An image (`img`) with an `alt` description.\n\nYou can use this image address: `/brand/emblem.png`',
    starter: web('<h1>Useful links</h1>\n'),
    hints: ['A link: `<a href="https://dbi.org.gh">Visit DBI</a>`', 'An image: `<img src="/brand/emblem.png" alt="DBI logo">`'],
    checks: [
      { name: 'There is a link with an address', expr: "!!document.querySelector('a[href^=\"http\"]')" },
      { name: 'The link has text', expr: "(document.querySelector('a')?.textContent || '').trim().length > 0" },
      { name: 'There is an image with alt text', expr: "!!document.querySelector('img[alt]:not([alt=\"\"])')" },
    ],
  },
  {
    id: 'web-counter',
    title: 'Click counter',
    lang: 'web',
    level: 'Builder',
    xp: 25,
    task: 'Make the button count clicks.\n\nWhen the button is clicked, the number in `#count` should go up by 1.\n\nWrite your code in **script.js**.',
    starter: web('<p>Clicks: <span id="count">0</span></p>\n<button id="add">Add one</button>\n', 'button { font-size: 1.2rem; padding: .5rem 1rem; }', "const button = document.querySelector('#add');\nconst count = document.querySelector('#count');\n\n// Your code here\n"),
    hints: ['Use `button.addEventListener(\'click\', () => { … })`.', 'Inside, change the text: `count.textContent = Number(count.textContent) + 1;`'],
    checks: [
      { name: 'Clicking once shows 1', expr: "(() => { const b = document.querySelector('#add'), c = document.querySelector('#count'); c.textContent = '0'; b.click(); return c.textContent.trim() === '1'; })()" },
      { name: 'Clicking three times shows 3', expr: "(() => { const b = document.querySelector('#add'), c = document.querySelector('#count'); c.textContent = '0'; b.click(); b.click(); b.click(); return c.textContent.trim() === '3'; })()" },
    ],
  },
  // ---------------------------------------------------------------- Python
  {
    id: 'py-hello',
    title: 'Say hello in Python',
    lang: 'python',
    level: 'Starter',
    xp: 10,
    task: 'Store your name in a variable called `name`, then print `Hello, ` followed by the name.\n\nExample output: `Hello, Ama`',
    starter: { 'main.py': '# Create the variable name\n\n# Print the greeting\n' },
    hints: ['A variable: `name = "Ama"`', 'Print: `print("Hello, " + name)` or `print(f"Hello, {name}")`'],
    checks: [
      { name: 'A variable called name exists', expr: "'name' in _g and isinstance(_g['name'], str) and len(_g['name']) > 0" },
      { name: 'The greeting was printed', expr: "('Hello, ' + _g.get('name', '?')) in _out" },
    ],
  },
  {
    id: 'py-average',
    title: 'Average score',
    lang: 'python',
    level: 'Explorer',
    xp: 15,
    task: 'Write a function `average(marks)` that returns the average of a list of numbers.\n\n`average([60, 70, 80])` should return `70`.',
    starter: { 'main.py': 'def average(marks):\n    # Your code here\n    pass\n\nprint(average([60, 70, 80]))\n' },
    hints: ['`sum(marks)` adds all the numbers.', '`len(marks)` counts them.', 'Return `sum(marks) / len(marks)`.'],
    checks: [
      { name: 'average([60, 70, 80]) is 70', expr: "_g['average']([60, 70, 80]) == 70" },
      { name: 'average([50, 100]) is 75', expr: "_g['average']([50, 100]) == 75" },
      { name: 'Works for one mark', expr: "_g['average']([42]) == 42" },
    ],
  },
  {
    id: 'py-grade',
    title: 'WASSCE-style grade',
    lang: 'python',
    level: 'Explorer',
    xp: 20,
    task: 'Write `grade(mark)` that returns:\n\n| Mark | Grade |\n|---|---|\n| 75 and above | `"A1"` |\n| 60 – 74 | `"B"` |\n| 50 – 59 | `"C"` |\n| below 50 | `"F"` |',
    starter: { 'main.py': 'def grade(mark):\n    # Use if / elif / else\n    pass\n\nprint(grade(80))\n' },
    hints: ['Start with the highest: `if mark >= 75: return "A1"`', 'Then `elif mark >= 60:` and so on.', 'Finish with `else: return "F"`'],
    checks: [
      { name: '80 gives A1', expr: "_g['grade'](80) == 'A1'" },
      { name: '75 gives A1', expr: "_g['grade'](75) == 'A1'" },
      { name: '65 gives B', expr: "_g['grade'](65) == 'B'" },
      { name: '50 gives C', expr: "_g['grade'](50) == 'C'" },
      { name: '30 gives F', expr: "_g['grade'](30) == 'F'" },
    ],
  },
  {
    id: 'py-times-table',
    title: 'Times table',
    lang: 'python',
    level: 'Builder',
    xp: 20,
    task: 'Ask for a number with `input()`, then print its times table from 1 to 12, like:\n\n```\n7 x 1 = 7\n7 x 2 = 14\n…\n7 x 12 = 84\n```\n\nThe Input box already contains `7`.',
    starter: { 'main.py': 'n = int(input("Number: "))\n\n# Use a for loop with range(1, 13)\n' },
    stdin: '7',
    hints: ['`for i in range(1, 13):`', "Inside the loop: `print(f\"{n} x {i} = {n * i}\")`"],
    checks: [
      { name: 'Prints 7 x 1 = 7', expr: "'7 x 1 = 7' in _out" },
      { name: 'Prints 7 x 12 = 84', expr: "'7 x 12 = 84' in _out" },
      { name: 'Prints 12 lines of the table', expr: "len([l for l in _out.splitlines() if ' x ' in l]) == 12" },
    ],
  },
  // ---------------------------------------------------------------- JavaScript
  {
    id: 'js-sum',
    title: 'Add two numbers',
    lang: 'javascript',
    level: 'Starter',
    xp: 10,
    task: 'Complete the function `add(a, b)` so it **returns** the sum of `a` and `b`.',
    starter: { 'main.js': 'function add(a, b) {\n  // Your code here\n}\n\nconsole.log(add(2, 3));\n' },
    hints: ['Use the `return` keyword.', '`return a + b;`'],
    checks: [
      { name: 'add(2, 3) is 5', expr: 'add(2, 3) === 5' },
      { name: 'add(-1, 1) is 0', expr: 'add(-1, 1) === 0' },
    ],
  },
  {
    id: 'js-even',
    title: 'Even or odd?',
    lang: 'javascript',
    level: 'Explorer',
    xp: 15,
    task: 'Write `isEven(n)` that returns `true` for even numbers and `false` for odd numbers.',
    starter: { 'main.js': 'function isEven(n) {\n  \n}\n\nconsole.log(isEven(4), isEven(7));\n' },
    hints: ['The remainder operator `%` helps: `n % 2` is 0 for even numbers.', '`return n % 2 === 0;`'],
    checks: [
      { name: 'isEven(4) is true', expr: 'isEven(4) === true' },
      { name: 'isEven(7) is false', expr: 'isEven(7) === false' },
      { name: 'isEven(0) is true', expr: 'isEven(0) === true' },
    ],
  },
  {
    id: 'js-cedis',
    title: 'Shopping total in cedis',
    lang: 'javascript',
    level: 'Builder',
    xp: 25,
    task: 'Write `total(items)` that adds up the `price × qty` of every item and returns the total.\n\n```js\ntotal([{ price: 5, qty: 2 }, { price: 1.5, qty: 4 }]) // 16\n```',
    starter: { 'main.js': 'function total(items) {\n  \n}\n\nconsole.log(total([{ price: 5, qty: 2 }, { price: 1.5, qty: 4 }]));\n' },
    hints: ['Start with `let sum = 0;`', 'Loop: `for (const item of items) { sum += item.price * item.qty; }`', 'Finally `return sum;`'],
    checks: [
      { name: 'Example basket is 16', expr: 'total([{ price: 5, qty: 2 }, { price: 1.5, qty: 4 }]) === 16' },
      { name: 'Empty basket is 0', expr: 'total([]) === 0' },
    ],
  },
  // ---------------------------------------------------------------- SQL
  {
    id: 'sql-all',
    title: 'See every student',
    lang: 'sql',
    level: 'Starter',
    xp: 10,
    task: 'Show **all columns** of the `students` table.',
    starter: { 'query.sql': '-- Write your query here\n' },
    hints: ['`SELECT * FROM students;`'],
    expectedSql: 'SELECT * FROM students',
  },
  {
    id: 'sql-shs',
    title: 'Only SHS students',
    lang: 'sql',
    level: 'Explorer',
    xp: 15,
    task: 'Show the `name` and `class` of students whose class starts with **SHS**, sorted by name (A–Z).',
    starter: { 'query.sql': 'SELECT name, class\nFROM students\n-- add WHERE and ORDER BY\n' },
    hints: ["Use `WHERE class LIKE 'SHS%'`", 'Sort with `ORDER BY name`'],
    expectedSql: "SELECT name, class FROM students WHERE class LIKE 'SHS%' ORDER BY name",
    orderMatters: true,
  },
  {
    id: 'sql-best-maths',
    title: 'Top 3 in Mathematics (term 1)',
    lang: 'sql',
    level: 'Builder',
    xp: 25,
    task: 'Show the `name` and `mark` of the **3 best students in Mathematics** (subject id 1) in **term 1**, highest mark first.',
    starter: { 'query.sql': 'SELECT s.name, sc.mark\nFROM scores sc\nJOIN students s ON s.id = sc.student_id\n' },
    hints: ['Filter: `WHERE sc.subject_id = 1 AND sc.term = 1`', 'Sort: `ORDER BY sc.mark DESC`', 'Limit: `LIMIT 3`'],
    expectedSql: 'SELECT s.name, sc.mark FROM scores sc JOIN students s ON s.id = sc.student_id WHERE sc.subject_id = 1 AND sc.term = 1 ORDER BY sc.mark DESC, s.name LIMIT 3',
    orderMatters: true,
  },
];

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);

/** Wraps learner Python in a test program. Prints marker lines the Code Lab reads back. */
export function pythonHarness(checks: Check[], src: string) {
  return `
import io as _io, contextlib as _cl
_ug = {"__name__": "__main__"}
_buf = _io.StringIO()
try:
    with _cl.redirect_stdout(_buf):
        exec(compile(${JSON.stringify(src)}, "main.py", "exec"), _ug)
finally:
    print(_buf.getvalue(), end="")
_out = _buf.getvalue()
for _i, _expr in enumerate(${JSON.stringify(checks.map((c) => c.expr))}):
    try:
        _ok = bool(eval(_expr, {"_g": _ug, "_out": _out}))
    except Exception:
        _ok = False
    print(f"__TEST__::{_i}::{'pass' if _ok else 'fail'}")
`;
}

/** Test harness appended to learner JavaScript (runs in the same scope as their code). */
export function jsHarness(checks: Check[]) {
  return `\n;${JSON.stringify(checks.map((c) => c.expr))}.forEach((expr, i) => {
  let ok = false;
  try { ok = !!eval(expr); } catch (e) { ok = false; }
  console.log('__TEST__::' + i + '::' + (ok ? 'pass' : 'fail'));
});`;
}

/** Test script for the web preview; reports through the bridge in the iframe. */
export function webHarness(checks: Check[]) {
  return `var r=${JSON.stringify(checks.map((c) => c.expr))}.map(function(expr){try{return !!eval(expr)}catch(e){return false}});window.__dbiReport(r);`;
}
