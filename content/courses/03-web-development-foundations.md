---
slug: web-development-foundations
title: "Web Development Foundations: HTML & CSS"
subtitle: Build and publish your own responsive website from scratch — no experience needed.
category: software-development
level: beginner
hours: 10
featured: true
tags: [html, css, web design, responsive, flexbox, portfolio]
outcomes:
  - Explain how websites work and what HTML, CSS and JavaScript each do
  - Structure web pages with semantic HTML — headings, lists, links, images and forms
  - Style pages with CSS colours, fonts, spacing and the box model
  - Build modern layouts with Flexbox and CSS Grid
  - Make websites responsive so they look great on phones
  - Publish a personal portfolio website online for free
requirements:
  - Basic computer skills (see Digital Literacy Essentials)
  - A computer with a browser. A free code editor such as VS Code is recommended, but you can practise in an online editor like CodePen
description: |
  Every website you visit — from news sites to online shops — is built with three languages: HTML for structure, CSS for style and JavaScript for interaction. This course teaches the first two in depth, so you can build beautiful, responsive pages yourself.

  You will write real code from the very first lesson, and finish by publishing your own portfolio website on the internet. Web development is one of the most in-demand digital skills in Ghana and around the world, and it can lead to freelance work, internships and a career in tech.
---

# Module: How the web works and your first page
Understand what happens when you open a website, then write your first HTML.

## Lesson: How websites work (8 min)
When you type `www.example.com` into a browser and press Enter, a lot happens in less than a second:

1. Your browser asks a **DNS server** (the internet's phone book) for the **IP address** of `example.com` — something like `93.184.216.34`.
2. The browser sends a **request** over the internet to the **web server** at that address.
3. The server sends back a **response**: files of HTML, CSS, JavaScript and images.
4. Your browser reads those files and **renders** (draws) the page on your screen.

This is called the **client–server** model. Your browser is the *client*; the computer storing the website is the *server*.

### The three languages of the web
| Language | Job | Analogy (a house) |
|---|---|---|
| **HTML** — HyperText Markup Language | Structure and content | The walls, rooms and doors |
| **CSS** — Cascading Style Sheets | Appearance and layout | The paint, furniture and decoration |
| **JavaScript** | Behaviour and interactivity | The electricity — lights, switches, the doorbell |

### Front end and back end
- **Front-end** developers build what users see in the browser (HTML, CSS, JavaScript).
- **Back-end** developers build the server side: databases, logins, payments (with languages like Python, PHP, Node.js).
- **Full-stack** developers do both.

### Tools you need
- A **browser** — Chrome or Firefox, with built-in **Developer Tools** (press `F12`).
- A **code editor** — VS Code is free and popular. On a phone or shared computer you can use **CodePen.io** in the browser.

> [!TIP]
> Right-click any web page and choose **View page source** to see its HTML. Every website is a learning resource!

> [!TRY]
> Open any website, press `F12`, and click the **Elements** tab. Hover over the code and watch parts of the page highlight.

## Lesson: Your first HTML page (10 min)
HTML uses **tags** to mark up content. Most tags come in pairs: an **opening tag** `<p>` and a **closing tag** `</p>`. Together with the content they form an **element**.

```html
<p>This is a paragraph.</p>
```

### The basic page structure
Create a file called `index.html` and type:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My First Website</title>
  </head>
  <body>
    <h1>Hello, world!</h1>
    <p>My name is Ama and I am learning web development with DBI Learn.</p>
  </body>
</html>
```

Save it and double-click the file — it opens in your browser. 🎉 You've built a web page!

### What each part means
- `<!DOCTYPE html>` tells the browser this is a modern HTML5 document.
- `<html lang="en">` wraps the whole page; `lang` helps screen readers and search engines.
- `<head>` contains information *about* the page — it is not shown on the page itself.
- `<meta charset="UTF-8">` makes sure symbols like ₵ and é display correctly.
- The `viewport` meta tag makes the page work properly on phones.
- `<title>` is the text in the browser tab and in Google results.
- `<body>` contains everything visible.

### Attributes
Tags can have **attributes** that give extra information, written as `name="value"` inside the opening tag:

```html
<html lang="en">
<a href="https://dbi-learn.pages.dev">Visit DBI Learn</a>
```

### Comments
```html
<!-- This is a comment. Browsers ignore it. -->
```
Use comments to leave notes for yourself and other developers.

> [!WARNING]
> Forgetting a closing tag is the most common beginner mistake. Indent your code neatly so you can see which tags belong together.

> [!TRY]
> Change the heading to your own name and add two more paragraphs: one about your school and one about what you want to build.

## Lesson: Text, headings and lists (9 min)
Well-structured text is easier to read for people *and* for search engines and screen readers.

### Headings
HTML has six heading levels:

```html
<h1>Main page title</h1>
<h2>Section heading</h2>
<h3>Sub-section heading</h3>
```

Use only **one `<h1>`** per page, and don't skip levels (don't jump from h2 to h4). Never choose a heading just because of its size — you'll control size with CSS.

### Paragraphs and line breaks
- `<p>` for paragraphs.
- `<br>` for a line break inside a paragraph (e.g. an address). It has no closing tag.
- `<hr>` draws a horizontal line between sections.

### Emphasis
- `<strong>` — important text (bold by default)
- `<em>` — emphasised text (italic by default)

```html
<p><strong>Warning:</strong> the deadline is <em>Friday</em>.</p>
```

### Lists
**Unordered list** (bullets):
```html
<ul>
  <li>HTML</li>
  <li>CSS</li>
  <li>JavaScript</li>
</ul>
```

**Ordered list** (numbers):
```html
<ol>
  <li>Plan your website</li>
  <li>Write the HTML</li>
  <li>Style it with CSS</li>
</ol>
```

Lists can be nested: put a whole `<ul>` inside an `<li>`.

> [!TRY]
> Create an "About me" page with an `<h1>` (your name), an `<h2>` called "My skills" followed by a bulleted list, and an `<h2>` called "My goals" followed by a numbered list.

## Quiz: Practice — HTML basics {kind=practice pass=60}
### Q: Which tag creates the largest, most important heading?
- [x] `<h1>`
- [ ] `<h6>`
- [ ] `<head>`
- [ ] `<heading>`
> `<h1>` is the top-level heading. `<head>` is the invisible information section of the page.

### Q(tf): The content inside `<head>` is displayed on the page.
= false
> The head contains information about the page (title, meta tags, CSS links), not visible content.

### Q: Which tag creates a bulleted list?
- [ ] `<ol>`
- [x] `<ul>`
- [ ] `<li>`
- [ ] `<list>`
> `<ul>` is an unordered (bulleted) list; `<li>` is each item inside it.

## Quiz: Module 1 quiz — The web and HTML {pass=70}
### Q: What does DNS do?
- [ ] Draws the web page on screen
- [x] Converts a domain name into an IP address
- [ ] Stores your passwords
- [ ] Styles the page with colours
> DNS is like a phone book that finds the server address for a domain name.

### Q: Which language controls the appearance (colours, fonts, layout) of a web page?
- [ ] HTML
- [x] CSS
- [ ] DNS
- [ ] HTTP
> CSS styles the page; HTML provides structure.

### Q: What is the purpose of `<meta name="viewport" content="width=device-width, initial-scale=1.0">`?
- [ ] It adds a picture to the page
- [ ] It sets the page title
- [x] It makes the page display correctly on mobile devices
- [ ] It links to a CSS file
> Without the viewport tag, phones show a zoomed-out desktop version.

### Q(multiple): Which of these are good heading practices?
- [x] Use only one `<h1>` per page
- [x] Don't skip heading levels
- [ ] Choose headings based on how big they look
- [ ] Put every paragraph in an `<h3>`
> Headings describe structure. Size is controlled with CSS.

### Q(short): What attribute of the `<a>` tag holds the link's destination? (attribute name)
= href | href=""
> `href` stands for "hypertext reference".

# Module: Links, images, tables and forms
Add the building blocks that make pages useful and interactive.

## Lesson: Links and images (9 min)
### Links
The anchor tag `<a>` creates links. The `href` attribute is the destination:

```html
<a href="https://www.ghana.gov.gh">Government of Ghana</a>
<a href="about.html">About me</a>
<a href="#contact">Jump to contact section</a>
<a href="mailto:hello@example.com">Email me</a>
<a href="tel:+233240000000">Call me</a>
```

- **Absolute URL** — full address to another website.
- **Relative URL** — a file on your own site, like `about.html` or `images/photo.jpg`.
- `#contact` jumps to an element with `id="contact"` on the same page.

To open a link in a new tab, add `target="_blank" rel="noopener"`.

### Images
```html
<img src="images/kente.jpg" alt="Colourful kente cloth with gold and green patterns" width="600">
```

- `src` — the path to the image file.
- `alt` — **alternative text** describing the image. It's read aloud by screen readers for blind users, shown if the image fails to load, and helps Google understand your page. Never skip it!
- `<img>` has **no closing tag**.

### Choosing image formats
| Format | Best for |
|---|---|
| **JPG** | Photos |
| **PNG** | Logos, images needing transparency |
| **SVG** | Icons and logos that must stay sharp at any size |
| **WebP** | Modern format — smaller files for photos and graphics |

Large images make websites slow — especially on mobile data. Resize photos to the size you need (often under 1,600px wide) and compress them before uploading.

### Figures with captions
```html
<figure>
  <img src="images/team.jpg" alt="Our coding club after a workshop">
  <figcaption>Coding club, Ayeldu — March 2026</figcaption>
</figure>
```

> [!TRY]
> Add a profile photo with good alt text to your About page, plus links to your email and to a website you admire.

## Lesson: Tables for data (8 min)
Use HTML tables for **tabular data** — timetables, price lists, results — not for page layout.

```html
<table>
  <caption>SHS 2 Science Timetable</caption>
  <thead>
    <tr>
      <th>Day</th>
      <th>Subject</th>
      <th>Time</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Monday</td>
      <td>Physics</td>
      <td>8:00 – 9:30</td>
    </tr>
    <tr>
      <td>Tuesday</td>
      <td>Chemistry</td>
      <td>10:00 – 11:30</td>
    </tr>
  </tbody>
</table>
```

### The table tags
- `<table>` wraps the whole table.
- `<caption>` gives it a title (good for accessibility).
- `<thead>` and `<tbody>` group the header and body rows.
- `<tr>` is a **table row**.
- `<th>` is a **header cell** (bold and centred by default).
- `<td>` is a **data cell**.

### Spanning cells
- `colspan="2"` makes a cell stretch across two columns.
- `rowspan="2"` makes a cell stretch down two rows.

```html
<td colspan="3">Break</td>
```

> [!TIP]
> Tables can overflow on small phone screens. Wrap them in a `<div style="overflow-x:auto">` so users can scroll sideways.

> [!TRY]
> Build a table of your weekly timetable or a price list for a small shop, with a caption, a header row and at least five rows.

## Lesson: Forms (10 min)
Forms collect information from visitors: sign-ups, contact messages, orders, surveys.

```html
<form action="/subscribe" method="post">
  <label for="name">Full name</label>
  <input type="text" id="name" name="name" required>

  <label for="email">Email</label>
  <input type="email" id="email" name="email" required placeholder="you@example.com">

  <label for="track">Which track interests you?</label>
  <select id="track" name="track">
    <option>Web development</option>
    <option>Data analysis</option>
    <option>Graphic design</option>
  </select>

  <label for="message">Message</label>
  <textarea id="message" name="message" rows="4"></textarea>

  <label><input type="checkbox" name="updates"> Send me updates</label>

  <button type="submit">Send</button>
</form>
```

### Useful input types
`text`, `email`, `password`, `number`, `tel`, `date`, `checkbox`, `radio`, `file`, `range`, `color`. On phones, `type="email"` and `type="tel"` show the right keyboard automatically.

### Labels matter
Always connect a `<label>` to its input with matching `for` and `id`. Clicking the label focuses the input, and screen readers announce what each field is for.

### Built-in validation
- `required` — the field can't be empty.
- `minlength`, `maxlength` — text length.
- `min`, `max` — number range.
- `pattern` — a format rule.

The browser checks these before sending. (Servers must still check everything again — never trust the browser alone.)

### Radio buttons
Radio buttons with the same `name` form a group where only one can be chosen:

```html
<input type="radio" id="m" name="level" value="beginner"><label for="m">Beginner</label>
<input type="radio" id="i" name="level" value="intermediate"><label for="i">Intermediate</label>
```

> [!TRY]
> Build a "Join our coding club" form with name, email, age (number 10–25), preferred day (radio buttons) and a submit button.

## Quiz: Module 2 quiz — Links, images, tables and forms {pass=70}
### Q: Why is the `alt` attribute important on images?
- [ ] It makes the image load faster
- [x] It describes the image for screen readers and when it can't load
- [ ] It sets the image width
- [ ] It adds a caption below the image
> Alt text makes images accessible and helps search engines.

### Q: Which tag defines a header cell in a table?
- [ ] `<td>`
- [ ] `<tr>`
- [x] `<th>`
- [ ] `<thead>`
> `<th>` is a header cell; `<thead>` is the group that contains header rows.

### Q: Which input type shows an email keyboard on phones and checks for an @?
- [ ] text
- [x] email
- [ ] mail
- [ ] address
> `type="email"` gives the right keyboard and basic validation.

### Q(tf): Radio buttons that share the same `name` attribute let the user choose only one option.
= true
> Sharing a name makes them one group with a single choice.

### Q: Which link jumps to the element with `id="contact"` on the same page?
- [ ] `<a href="contact">`
- [x] `<a href="#contact">`
- [ ] `<a id="contact">`
- [ ] `<a href="contact.html#">`
> A hash followed by an id links to that element.

# Module: Styling with CSS
Bring pages to life with colour, typography, spacing and layout.

## Lesson: CSS basics — selectors, colours and fonts (10 min)
CSS is written as **rules**. Each rule has a **selector** (what to style) and **declarations** (how to style it):

```css
h1 {
  color: #0b7be8;
  font-size: 2.5rem;
}
```

### Adding CSS to your page
The best way is an external stylesheet. Create `style.css` and link it inside `<head>`:

```html
<link rel="stylesheet" href="style.css">
```

### Selectors
```css
p { }            /* every <p> element */
.card { }        /* every element with class="card" */
#header { }      /* the one element with id="header" */
nav a { }        /* <a> elements inside <nav> */
a:hover { }      /* links when the mouse is over them */
```

Use **classes** for most styling — you can reuse them on many elements: `<div class="card">`.

### Colours
```css
color: green;                 /* named colour */
color: #03c14b;               /* hex code */
color: rgb(3, 193, 75);       /* red, green, blue */
background-color: rgba(0, 0, 0, 0.5); /* with 50% transparency */
```

Make sure text has enough **contrast** against its background so everyone can read it.

### Typography
```css
body {
  font-family: "Inter", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #1f242d;
}
```

- List backup fonts after a comma in case the first isn't available.
- `line-height` of 1.5–1.7 makes paragraphs much easier to read.
- Free web fonts are available from Google Fonts.

### Units
- `px` — fixed pixels.
- `rem` — relative to the root font size (1rem = 16px by default). Great for scalable designs.
- `%` — relative to the parent element.
- `vw` / `vh` — percentage of the screen width/height.

### The cascade
When several rules target the same element, CSS decides which wins by **specificity** (id > class > element) and **order** (later rules win). That's the "cascading" in Cascading Style Sheets.

> [!TRY]
> Create `style.css`, link it to your page, and set a font, a text colour, and a coloured `h1`. Add a hover colour to your links.

## Lesson: The box model and spacing (9 min)
Every element on a web page is a rectangular **box**. Understanding this box is the key to layout.

```
┌─────────────── margin ───────────────┐
│  ┌──────────── border ────────────┐  │
│  │  ┌───────── padding ────────┐  │  │
│  │  │         content          │  │  │
│  │  └──────────────────────────┘  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- **Content** — the text or image.
- **Padding** — space *inside* the border, around the content.
- **Border** — a line around the padding.
- **Margin** — space *outside* the border, separating it from other elements.

```css
.card {
  padding: 24px;
  border: 1px solid #d5dae2;
  border-radius: 16px;
  margin: 16px 0;
  background: white;
}
```

### Shorthand values
- `margin: 10px;` — all four sides.
- `margin: 10px 20px;` — top/bottom 10px, left/right 20px.
- `margin: 10px 20px 30px 40px;` — top, right, bottom, left (clockwise).

### box-sizing: the one rule everyone uses
By default, padding and border are *added* to an element's width, which makes sizes confusing. Add this to the top of every stylesheet:

```css
*, *::before, *::after {
  box-sizing: border-box;
}
```

Now `width: 300px` means the whole box is 300px.

### Centring a block
```css
.container {
  max-width: 1100px;
  margin: 0 auto;     /* auto left/right margins centre it */
  padding: 0 16px;
}
```

### Block vs inline
- **Block** elements (`div`, `p`, `h1`, `section`) start on a new line and take full width.
- **Inline** elements (`a`, `strong`, `span`, `img`) sit inside a line of text.

> [!TIP]
> Open Developer Tools (`F12`), select an element and look at the **box model diagram** in the Styles panel. It shows exact margin, border and padding sizes.

> [!TRY]
> Wrap your page content in `<div class="container">` and style it to be centred with a maximum width. Turn your skills list into a `.card`.

## Lesson: Layout with Flexbox and Grid (11 min)
Modern CSS gives us two powerful layout tools.

### Flexbox — for one direction (a row *or* a column)
```css
.navbar {
  display: flex;
  justify-content: space-between;   /* spread along the main axis */
  align-items: center;              /* centre on the cross axis */
  gap: 16px;                        /* space between items */
}
```

```html
<nav class="navbar">
  <a href="/" class="logo">Ama.dev</a>
  <div class="links">
    <a href="#about">About</a>
    <a href="#projects">Projects</a>
    <a href="#contact">Contact</a>
  </div>
</nav>
```

Key Flexbox properties:
- `flex-direction: row | column`
- `justify-content: flex-start | center | space-between | space-around`
- `align-items: stretch | center | flex-start | flex-end`
- `flex-wrap: wrap` — let items move to the next line
- `flex: 1` on a child — let it grow to fill space

### CSS Grid — for two directions (rows *and* columns)
```css
.projects {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
```

`1fr` means "one fraction of the free space", so `repeat(3, 1fr)` creates three equal columns.

An even better version automatically fits as many columns as there is room for:

```css
.projects {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}
```

On a wide screen you get four columns; on a phone, one — with no extra code!

### Which should I use?
- **Flexbox:** navigation bars, buttons in a row, centring things, small components.
- **Grid:** whole-page layouts, card galleries, anything with rows and columns.

They work together — a grid of cards, each card using flexbox inside.

> [!TIP]
> To centre anything perfectly inside a box: `display: grid; place-items: center;`

> [!TRY]
> Create a "Projects" section with six cards in a responsive grid using `repeat(auto-fit, minmax(250px, 1fr))`. Resize your browser and watch the columns adapt.

## Quiz: Module 3 quiz — CSS {pass=70}
### Q: Which selector targets every element with `class="card"`?
- [ ] #card
- [x] .card
- [ ] card
- [ ] *card
> A dot selects classes; a hash selects ids.

### Q: In the box model, what is the space between the content and the border called?
- [ ] Margin
- [x] Padding
- [ ] Gap
- [ ] Outline
> Padding is inside the border; margin is outside.

### Q: What does `margin: 0 auto;` do to a block element with a set max-width?
- [ ] Removes all spacing
- [x] Centres it horizontally
- [ ] Makes it full width
- [ ] Aligns it to the right
> Automatic left and right margins split the free space equally.

### Q(multiple): Which are good uses of Flexbox?
- [x] A navigation bar with links in a row
- [x] Centring a button inside a box
- [ ] A complex magazine layout with rows and columns
- [x] A row of buttons with equal gaps
> Flexbox excels at one-dimensional layouts. Two-dimensional layouts suit Grid.

### Q(short): In `grid-template-columns: repeat(3, 1fr);` what does the unit "fr" stand for?
= fraction | fractional unit | fraction unit | fr fraction
> "fr" is one fraction of the available space.

# Module: Responsive design and going live
Make your site work on every screen, then publish it to the world.

## Lesson: Responsive design and media queries (10 min)
Most people in Ghana browse the web on their phones. A **responsive** website adapts its layout to any screen size.

### Mobile-first thinking
Write your CSS for small screens first, then add rules for bigger screens. Small screens get a simple, single-column layout; larger screens get more columns.

### Media queries
A **media query** applies CSS only when a condition is true:

```css
/* Default: phones */
.projects {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

/* Tablets and up */
@media (min-width: 640px) {
  .projects { grid-template-columns: repeat(2, 1fr); }
}

/* Laptops and up */
@media (min-width: 1024px) {
  .projects { grid-template-columns: repeat(3, 1fr); }
}
```

### Flexible images and text
```css
img {
  max-width: 100%;
  height: auto;
}

h1 {
  font-size: clamp(2rem, 5vw, 3.5rem);
}
```

- `max-width: 100%` stops images from overflowing small screens.
- `clamp(min, preferred, max)` lets text grow with the screen but stay within limits.

### Touch-friendly design
- Make buttons and links at least **44 × 44 pixels** so they're easy to tap.
- Don't rely on hover effects — phones don't have a mouse.
- Keep forms short and use the right input types.

### Test on real sizes
In Chrome Developer Tools, click the **device toolbar** icon (or `Ctrl + Shift + M`) to preview your site as a phone, tablet or laptop.

> [!TRY]
> Add media queries to your projects grid so it shows 1 column on phones, 2 on tablets and 3 on laptops. Test it in the device toolbar.

## Lesson: Accessibility and semantic HTML (9 min)
An **accessible** website works for everyone — including people who are blind, have low vision, are deaf, or can't use a mouse. It's also better for search engines and for everyone on a slow phone.

### Use semantic elements
Instead of building everything with `<div>`, use elements that describe their purpose:

```html
<header>Site logo and navigation</header>
<nav>Main links</nav>
<main>
  <section id="about">...</section>
  <article>A blog post or project</article>
</main>
<aside>Related information</aside>
<footer>Contact and copyright</footer>
```

Screen readers let users jump straight to `<nav>` or `<main>`, and search engines understand your page better.

### Accessibility checklist
- ✅ Every image has meaningful `alt` text (use `alt=""` for purely decorative images).
- ✅ Text has strong colour contrast.
- ✅ Every form input has a `<label>`.
- ✅ Links describe where they go — "Download the timetable", not "click here".
- ✅ You can use the whole site with the **Tab** key; focused elements are visible.
- ✅ Use real `<button>` elements for actions, not clickable `<div>`s.
- ✅ Set `lang="en"` on the `<html>` tag.

### Performance is accessibility too
Many visitors are on mobile data. Keep pages light: compress images, avoid huge background videos, and use system or few web fonts.

> [!TIP]
> In Chrome Developer Tools, the **Lighthouse** tab scores your page for performance, accessibility, best practices and SEO, and tells you exactly what to fix.

> [!TRY]
> Replace the `<div>`s in your page with semantic elements and run a Lighthouse accessibility audit. Aim for a score above 90.

## Lesson: Project — publish your portfolio website (12 min)
Time to put it all together and go live! A portfolio website shows employers and clients who you are and what you can do.

### What to include
1. **Header & navigation** — your name/logo and links to sections.
2. **Hero section** — a photo, your name, a one-line summary ("Aspiring front-end developer from Ayeldu, Ghana").
3. **About** — a short paragraph about you and your goals.
4. **Skills** — a list or set of badges (HTML, CSS, Excel…).
5. **Projects** — cards with an image, title, short description and link for each project.
6. **Certificates** — link to your verified DBI Learn certificates.
7. **Contact** — email link, phone and a simple contact form or social links.
8. **Footer** — copyright and a "back to top" link.

### Folder structure
```
portfolio/
├── index.html
├── style.css
└── images/
    ├── profile.webp
    └── project-1.webp
```

### Publishing for free
Several services host static websites for free:

- **GitHub Pages** — create a free GitHub account, create a repository named `yourusername.github.io`, upload your files, and your site is live at `https://yourusername.github.io`.
- **Netlify Drop** or **Cloudflare Pages** — drag and drop your project folder into the website and get a live link in seconds.

### Before you launch: checklist
- [ ] All links work and open the right pages
- [ ] Images have alt text and are compressed
- [ ] It looks good on a phone (test in the device toolbar *and* on a real phone)
- [ ] No spelling mistakes — ask a friend to read it
- [ ] The `<title>` and a `<meta name="description">` are set

> [!TIP]
> Share your live link in your CV, on LinkedIn and in the DBI Learn discussions. Real projects impress employers far more than a list of skills.

> [!TRY]
> Build and publish your portfolio. Post the link in the course discussion so classmates can give you feedback.

## Quiz: Module 4 quiz — Responsive and live {pass=70}
### Q: Which CSS rule stops images from overflowing small screens?
- [x] img { max-width: 100%; height: auto; }
- [ ] img { width: 2000px; }
- [ ] img { float: left; }
- [ ] img { display: none; }
> max-width: 100% keeps the image inside its container.

### Q: What does `@media (min-width: 1024px) { ... }` do?
- [ ] Applies the CSS only on screens narrower than 1024px
- [x] Applies the CSS only on screens 1024px wide or wider
- [ ] Sets every screen to 1024px wide
- [ ] Hides the page on large screens
> min-width rules apply at that width and above — perfect for mobile-first CSS.

### Q(multiple): Which are semantic HTML elements?
- [x] `<nav>`
- [x] `<main>`
- [x] `<footer>`
- [ ] `<div>`
> `<div>` is a generic container with no meaning; the others describe their role.

### Q: Which link text is most accessible?
- [ ] Click here
- [ ] Read more
- [x] Download the 2026 term calendar (PDF)
- [ ] Link
> Descriptive link text tells users exactly where the link goes.

### Q(tf): GitHub Pages can host a static HTML and CSS website for free.
= true
> GitHub Pages, Netlify and Cloudflare Pages all offer free static hosting.

# Final: Final exam — Web Development Foundations {pass=70 attempts=3 time=30}
### Q: Which of these correctly describes HTML, CSS and JavaScript?
- [x] Structure, style, behaviour
- [ ] Style, structure, database
- [ ] Behaviour, style, server
- [ ] Database, structure, style
> HTML structures content, CSS styles it and JavaScript adds interactivity.

### Q: Which is the correct way to link an external stylesheet?
- [ ] `<style src="style.css">`
- [x] `<link rel="stylesheet" href="style.css">`
- [ ] `<css href="style.css">`
- [ ] `<script href="style.css">`
> The `<link>` tag with rel="stylesheet" goes inside the `<head>`.

### Q: Which tag is used for the most important heading on a page?
- [ ] `<header>`
- [ ] `<head>`
- [x] `<h1>`
- [ ] `<title>`
> `<h1>` is the main visible heading; `<title>` appears only in the browser tab.

### Q: Given `<p class="intro" id="first">`, which selector has the HIGHEST specificity?
- [ ] p
- [ ] .intro
- [x] #first
- [ ] They are all equal
> Id selectors are more specific than classes, which are more specific than element selectors.

### Q: What does `padding: 10px 20px;` set?
- [x] 10px top and bottom, 20px left and right
- [ ] 10px left and right, 20px top and bottom
- [ ] 10px top, 20px bottom
- [ ] 10px on all sides plus a 20px border
> With two values, the first is vertical and the second horizontal.

### Q: Which CSS creates a responsive grid that fits as many 250px-wide columns as possible?
- [ ] grid-template-columns: 250px;
- [x] grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
- [ ] display: flex; width: 250px;
- [ ] columns: 250px auto;
> auto-fit with minmax adapts the number of columns to the screen.

### Q(tf): A `<label>` should be connected to its input using matching `for` and `id` attributes.
= true
> This lets users click the label and lets screen readers announce the field.

### Q(multiple): Which practices make a website faster on mobile data?
- [x] Compressing and resizing images
- [x] Using modern formats such as WebP
- [ ] Adding a large autoplay background video
- [ ] Loading ten different web fonts
> Lighter pages load faster and cost visitors less data.

### Q: What does the `alt` attribute on an `<img>` provide?
- [ ] An alternative image if the first fails
- [x] A text description of the image
- [ ] The image's alignment
- [ ] A tooltip only for mouse users
> Alt text describes the image for screen readers and search engines.

### Q: Which `justify-content` value spreads flex items so the first is at the start and the last at the end?
- [ ] center
- [ ] flex-start
- [x] space-between
- [ ] stretch
> space-between puts equal space between items, with none at the edges.

### Q(short): Which CSS property, set to border-box, makes padding and border included in an element's width? (property name)
= box-sizing | box-sizing: border-box
> `box-sizing: border-box` makes sizing predictable.

### Q: Which tool in Chrome DevTools audits a page for performance and accessibility?
- [ ] Console
- [ ] Network
- [x] Lighthouse
- [ ] Sources
> Lighthouse gives scores and specific recommendations.
