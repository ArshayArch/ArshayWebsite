#!/usr/bin/env node
/*
 * build.js — zero-dependency static site generator for arshaykathpalia
 *
 * Reads everything from ../website-content/ and writes a complete site
 * to ../dist/. No npm packages: Node's standard library only, so this
 * builds identically today and in five years.
 *
 * Usage:  node site/build.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "website-content");
const DIST = path.join(ROOT, "dist");
const ASSETS = path.join(__dirname, "assets");

/* ---------------------------------------------------------------- utils */

const read = (p) => fs.readFileSync(p, "utf8");
const exists = fs.existsSync;

function write(rel, html) {
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}

function copy(src, destRel) {
  const dest = path.join(DIST, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function stripComments(md) {
  return md.replace(/<!--[\s\S]*?-->/g, "");
}

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/* Minimal markdown: headings, paragraphs, lists, bold, italic, links.
   Deliberately small — the content files are structurally simple. */
function inlineMd(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function md(text) {
  const blocks = stripComments(text).split(/\n\s*\n/);
  const out = [];
  for (const raw of blocks) {
    const b = raw.trim();
    if (!b) continue;
    const h = b.match(/^(#{1,4})\s+(.*)$/);
    if (h && !b.includes("\n")) {
      const n = h[1].length;
      out.push(`<h${n}>${inlineMd(h[2])}</h${n}>`);
    } else if (b.split("\n").every((l) => /^[-*]\s+/.test(l.trim()))) {
      const items = b
        .split("\n")
        .map((l) => `<li>${inlineMd(l.trim().replace(/^[-*]\s+/, ""))}</li>`)
        .join("");
      out.push(`<ul>${items}</ul>`);
    } else {
      out.push(`<p>${inlineMd(b.replace(/\n/g, " "))}</p>`);
    }
  }
  return out.join("\n");
}

/* Parse "- Name | URL | description" list files (links.md) */
function parsePipeList(text) {
  const lines = stripComments(text).split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      current = { title: h[1].trim(), items: [] };
      sections.push(current);
      continue;
    }
    const m = line.match(/^[-*]\s+(.*)$/);
    if (m && current) {
      const parts = m[1].split("|").map((s) => s.trim());
      if (parts.length >= 2) {
        current.items.push({
          name: parts[0],
          url: parts[1],
          desc: parts[2] || "",
        });
      }
    }
  }
  return sections;
}

/* ------------------------------------------------------------- content */

const bioRaw = stripComments(read(path.join(CONTENT, "profile", "bio.md")));
const bioParts = bioRaw.split(/^#\s+Long Bio\s*$/m);
const shortBio = bioParts[0].replace(/^#\s+Short Bio\s*$/m, "").trim();
const longBio = (bioParts[1] || "").trim();

const PROJECT_META = {
  "project-01-architecture-centre": {
    slug: "architecture-centre",
    sheet: "AK-P01",
    kind: "Cultural / civic",
    year: "2025",
    place: "Oxford, UK",
    mapLabel: "ARCH CENTRE",
    tagline: "Restraint beside a historic building, conviction intact.",
  },
  "project-02-podcast-studio": {
    slug: "podcast-studio",
    sheet: "AK-P02",
    kind: "Adaptive reuse",
    year: "2024",
    place: "Oxford, UK",
    mapLabel: "PODCAST STUDIO",
    tagline: "A threshold between the grounded church and the open air.",
  },
  "project-03-sitegrab": {
    slug: "sitegrab",
    sheet: "AK-P03",
    kind: "Computational tool",
    year: "2025–",
    place: "FastAPI · Docker · OSM",
    mapLabel: "SITEGRAB",
    tagline: "An area name in. A working model out.",
  },
  "project-04-night-club": {
    slug: "night-club",
    sheet: "AK-P04",
    kind: "Temporary / event",
    year: "2025",
    place: "Jericho canal, Oxford, UK",
    mapLabel: "NIGHT CLUB",
    tagline: "Loudest on the street, quietest in the mirror.",
  },
  "project-05-one-space-office": {
    slug: "one-space-office",
    sheet: "AK-P05",
    kind: "Workplace / idea project",
    year: "2021",
    place: "Dubai, UAE — Mendrisio year",
    mapLabel: "ONE SPACE",
    tagline: "One idea, made responsible for every decision.",
  },
};

function loadProjects() {
  const dir = path.join(CONTENT, "portfolio");
  const projects = [];
  for (const folder of Object.keys(PROJECT_META)) {
    const pdir = path.join(dir, folder);
    if (!exists(pdir)) continue;
    // description.md is authored content — used verbatim, never rewritten.
    const descFile = ["description.md", "Description.md"]
      .map((f) => path.join(pdir, f))
      .find(exists);
    if (!descFile) continue;
    const raw = stripComments(read(descFile)).trim();
    const lines = raw.split("\n");
    const title = (lines[0] || "").replace(/^#\s*/, "").trim();
    // second non-empty line is the subtitle in all five files
    const rest = lines.slice(1).join("\n").trim();
    const firstBlockEnd = rest.indexOf("\n\n");
    const subtitle = rest.slice(0, firstBlockEnd === -1 ? undefined : firstBlockEnd).trim();
    const body = firstBlockEnd === -1 ? "" : rest.slice(firstBlockEnd).trim();
    const imgDir = path.join(pdir, "images");
    const images = exists(imgDir)
      ? fs
          .readdirSync(imgDir)
          .filter((f) => /\.(jpe?g|png|webp|svg)$/i.test(f))
          .sort()
          .map((f) => ({
            file: f,
            src: `assets/img/${PROJECT_META[folder].slug}/${f}`,
            caption: f
              .replace(/^\d+-/, "")
              .replace(/\.(jpe?g|png|webp|svg)$/i, "")
              .replace(/-/g, " "),
          }))
      : [];
    projects.push({
      folder,
      ...PROJECT_META[folder],
      title,
      subtitle,
      body,
      images,
    });
  }
  return projects;
}

function loadEssays() {
  const dir = path.join(CONTENT, "writing");
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((f) => {
      const raw = stripComments(read(path.join(dir, f))).trim();
      const lines = raw.split("\n");
      const title = (lines[0] || "").replace(/^#\s*/, "").trim() || f;
      let date = "";
      let bodyStart = 1;
      const dm = (lines[1] || "").match(/^date:\s*(.*)$/i);
      if (dm) {
        date = dm[1].trim();
        bodyStart = 2;
      }
      const body = lines.slice(bodyStart).join("\n").trim();
      const slug = f.replace(/\.md$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return { title, date, body, slug };
    })
    .filter((e) => e.body.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function loadThoughts() {
  const p = path.join(CONTENT, "thoughts.md");
  if (!exists(p)) return [];
  const text = stripComments(read(p)).replace(/^#\s+Thoughts\s*$/m, "");
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const dm = b.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*/);
      return {
        date: dm ? dm[1] : "",
        text: dm ? b.slice(dm[0].length) : b,
      };
    });
}

/* books.md: "## Read" / "## Currently Reading" / "## Recommended" sections,
   entries "- Title | Author | note". A cover renders only when a matching
   image exists at website-content/books/covers/<slug-of-title>.{png,jpg} —
   run `node site/fetch-covers.js` to pull real covers from Open Library.
   Entries without a cover file render as text rows, never a placeholder. */
function loadBooks() {
  const p = path.join(CONTENT, "books.md");
  if (!exists(p)) return [];
  const coverDir = path.join(CONTENT, "books", "covers");
  const coverFor = (title) => {
    if (!exists(coverDir)) return null;
    const slug = slugify(title);
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
      const f = `${slug}.${ext}`;
      if (exists(path.join(coverDir, f))) return { file: f, src: `assets/img/books/${f}` };
    }
    return null;
  };
  const sections = [];
  let current = null;
  for (const line of stripComments(read(p)).split("\n")) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      current = { title: h[1].trim(), items: [] };
      sections.push(current);
      continue;
    }
    const m = line.match(/^[-*]\s+(.*)$/);
    if (m && current) {
      const parts = m[1].split("|").map((s) => s.trim());
      if (!parts[0]) continue;
      current.items.push({
        title: parts[0],
        author: parts[1] || "",
        note: parts[2] || "",
        cover: coverFor(parts[0]),
      });
    }
  }
  return sections;
}

const projects = loadProjects();
const essays = loadEssays();
const thoughts = loadThoughts();
const books = loadBooks();
const totalBooks = books.reduce((n, s) => n + s.items.length, 0);
const linkSections = exists(path.join(CONTENT, "links.md"))
  ? parsePipeList(read(path.join(CONTENT, "links.md")))
  : [];

const projectLinks = linkSections.find((s) => /project/i.test(s.title))?.items || [];
const socialLinks = linkSections.find((s) => /social/i.test(s.title))?.items || [];

/* --------------------------------------------------------------- layout */

/* Books joins the nav only once books.md has real entries — same rule as
   every other section: nothing ships empty. */
const NAV = [
  { href: "index.html", label: "Home", id: "home" },
  { href: "portfolio.html", label: "Portfolio", id: "portfolio" },
  { href: "writing.html", label: "Writing", id: "writing" },
  ...(totalBooks ? [{ href: "books.html", label: "Books", id: "books" }] : []),
  { href: "about.html", label: "CV / About", id: "about" },
];

/* The site graph used by the syntax map on the home page.
   Edges mirror the real hyperlink structure — the map is honest. */
function siteGraph() {
  const nodes = [
    { id: "home", label: "HOME", href: "index.html", kind: "page" },
    { id: "portfolio", label: "PORTFOLIO", href: "portfolio.html", kind: "page" },
    { id: "writing", label: "WRITING", href: "writing.html", kind: "page" },
    ...(totalBooks ? [{ id: "books", label: "BOOKS", href: "books.html", kind: "page" }] : []),
    { id: "about", label: "CV / ABOUT", href: "about.html", kind: "page" },
    { id: "cv", label: "CV.PDF", href: "Arshay_Kathpalia_CV.pdf", kind: "file" },
    ...projects.map((p) => ({
      id: p.slug,
      label: (p.mapLabel || p.title).toUpperCase().slice(0, 18),
      href: `portfolio-${p.slug}.html`,
      kind: "project",
    })),
    ...essays.map((e) => ({
      id: `essay-${e.slug}`,
      label: e.title.toUpperCase().slice(0, 18),
      href: `writing-${e.slug}.html`,
      kind: "essay",
    })),
  ];
  const edges = [
    ["home", "portfolio"],
    ["home", "writing"],
    ["home", "about"],
    ["portfolio", "writing"],
    ["portfolio", "about"],
    ["writing", "about"],
    ...(totalBooks
      ? [["home", "books"], ["portfolio", "books"], ["writing", "books"], ["books", "about"]]
      : []),
    ["about", "cv"],
    ...projects.map((p) => ["portfolio", p.slug]),
    ...essays.map((e) => ["writing", `essay-${e.slug}`]),
  ];
  return { nodes, edges };
}

function page({ id, title, desc, sheet, body, extraHead = "" }) {
  const navHtml = NAV.map(
    (n) =>
      `<a href="${n.href}"${n.id === id ? ' aria-current="page"' : ""}>${n.label}</a>`
  ).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/main.css">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
${extraHead}
</head>
<body data-page="${id}">
<header class="titlebar">
  <a class="wordmark" href="index.html">ARSHAY&nbsp;KATHPALIA</a>
  <nav class="nav">${navHtml}</nav>
  <a class="cv-chip" href="Arshay_Kathpalia_CV.pdf" download>CV&nbsp;↓</a>
</header>
<main id="sheet" class="sheet">
${body}
</main>
<footer class="stamp">
  <div class="stamp-cell"><span class="k">SHEET</span><span>${sheet}</span></div>
  <div class="stamp-cell"><span class="k">PROJECT</span><span>PERSONAL SITE — LONDON / DUBAI</span></div>
  <div class="stamp-cell"><span class="k">DRAWN BY</span><span>ARSHAY KATHPALIA</span></div>
  <div class="stamp-cell"><span class="k">CONTACT</span><span><a class="mailto" data-u="kathpaliaarshay" data-d="gmail.com" href="#">email</a></span></div>
  <div class="stamp-cell grow"><span class="k">NOTE</span><span class="thread" id="thread"></span></div>
</footer>
<script src="assets/site.js" defer></script>
</body>
</html>`;
}

/* ----------------------------------------------------------------- home */

function homePage() {
  const graph = siteGraph();
  const works = projects
    .map(
      (p, i) => `
  <a class="work-row" href="portfolio-${p.slug}.html">
    <span class="fig">P${String(i + 1).padStart(2, "0")}</span>
    <span class="work-title">${esc(p.title)}</span>
    <span class="work-kind">${esc(p.kind)}</span>
    <span class="work-year">${esc(p.year)}</span>
  </a>`
    )
    .join("");

  const body = `
<section class="hero">
  <div class="hero-text">
    <p class="over">PART 1 ARCHITECTURAL ASSISTANT · OXFORD BROOKES · EX-OLGIATI, MENDRISIO</p>
    <h1>Architecture, physics and philosophy,<br>held in the same hand.</h1>
    <div class="hero-bio">${md(shortBio)}</div>
    <p class="hero-links">
      <a class="btn" href="full-portfolio.pdf" target="_blank" rel="noopener">Portfolio (PDF) →</a>
      <a class="btn ghost" href="Arshay_Kathpalia_CV.pdf" download>Download CV (PDF)</a>
    </p>
  </div>
  <figure class="syntax-map" aria-label="A Space Syntax justified graph of this website. Every page is a node; every link is a line. Values are computed, not decorative.">
    <div id="syntaxmap"></div>
    <figcaption>
      <span class="k">FIG 00</span> Justified permeability graph of this website, drawn from its real link structure — the dissertation method, applied to the site itself. Hover to interrogate; click to travel.
      <span id="map-readout" class="readout" aria-live="polite"></span>
    </figcaption>
  </figure>
</section>

<section class="band">
  <h2><span class="fig">01</span>Selected works</h2>
  <div class="work-list">${works}</div>
</section>

<section class="band cols">
  <div>
    <h2><span class="fig">02</span>The other half</h2>
    <p>The physics and philosophy are not a hobby running alongside the architecture. Feynman, Deutsch and Popper set the method — bold guesses, honest attempts to break them. Pallasmaa, Zumthor and Merleau-Ponty set the subject — how space is felt, not only how it is built. The dissertation put both to work at once: Space Syntax analysis and phenomenological fieldwork across three Dubai sites, nominated for the RIBA Architecture Today Prize.</p>
    <p><a href="writing.html">Writing &amp; thinking →</a></p>
  </div>
  <div>
    <h2><span class="fig">03</span>Tools I build</h2>
    <p>The discipline should build more of its own tools rather than only using the ones it is handed. SiteGrab turns an area name alone into a working Rhino model or a layered CAD file — geocoding, projection detection, OSM extraction, all automated.</p>
    <p><a href="portfolio-sitegrab.html">SiteGrab →</a></p>
  </div>
</section>`;

  return page({
    id: "home",
    title: "Arshay Kathpalia — architecture, physics, philosophy",
    desc: "Part 1 architectural assistant working where philosophy, physics and architecture meet. Portfolio, writing and tools.",
    sheet: "AK-00 HOME",
    body,
    extraHead: `<script>window.__SITE_GRAPH__=${JSON.stringify(graph)}</script><script src="assets/syntax-map.js" defer></script>`,
  });
}

/* ------------------------------------------------------------ portfolio */

function portfolioIndex() {
  const cards = projects
    .map((p, i) => {
      const heroImg = p.images[0];
      const img = heroImg
        ? `<img src="${heroImg.src}" alt="${esc(p.title)} — ${esc(heroImg.caption)}" loading="lazy">`
        : p.slug === "sitegrab"
          ? `<img src="assets/img/sitegrab/pipeline.svg" alt="SiteGrab pipeline diagram" loading="lazy" style="object-fit:contain;background:#fff;padding:12px">`
          : `<div class="ph">DRAWINGS PENDING</div>`;
      return `
  <a class="card" href="portfolio-${p.slug}.html">
    <div class="card-img">${img}</div>
    <div class="card-meta">
      <span class="fig">P${String(i + 1).padStart(2, "0")}</span>
      <h3>${esc(p.title)}</h3>
      <p class="sub">${esc(p.subtitle)}</p>
      <p class="tag">${esc(p.kind)} · ${esc(p.year)}</p>
    </div>
  </a>`;
    })
    .join("");

  const body = `
<section class="band">
  <h1><span class="fig">P—</span>Portfolio</h1>
  <p class="lede">Five projects. Three buildings, one temporary structure, one piece of software — the last treated with the same weight as the first four, because building the tools is part of the work.</p>
  <div class="cards">${cards}</div>
  <p class="aside">The complete document, with full drawing sets: <a href="full-portfolio.pdf" target="_blank" rel="noopener">full portfolio (PDF, 47&nbsp;MB)</a>.</p>
</section>`;
  return page({
    id: "portfolio",
    title: "Portfolio — Arshay Kathpalia",
    desc: "Architecture Centre Oxford, Podcast Studio, SiteGrab, Pop-Up Night Club, One Space Office.",
    sheet: "AK-P00 PORTFOLIO",
    body,
  });
}

function projectPage(p, i) {
  const figures = p.images
    .map(
      (im, j) => `
  <figure class="plate">
    <img src="${im.src}" alt="${esc(p.title)} — ${esc(im.caption)}" loading="lazy">
    <figcaption><span class="k">FIG ${String(j + 1).padStart(2, "0")}</span> ${esc(im.caption)}</figcaption>
  </figure>`
    )
    .join("");

  // SiteGrab: no PDF plates — a generated pipeline diagram instead (clearly a diagram, not fake imagery)
  const sitegrabDiagram =
    p.slug === "sitegrab"
      ? `
  <figure class="plate">
    <object type="image/svg+xml" data="assets/img/sitegrab/pipeline.svg" aria-label="SiteGrab pipeline diagram">
      <img src="assets/img/sitegrab/pipeline.svg" alt="SiteGrab pipeline diagram">
    </object>
    <figcaption><span class="k">FIG 01</span> pipeline, drawn from the code’s actual stages</figcaption>
  </figure>`
      : "";

  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];

  const body = `
<article class="project">
  <header class="project-head">
    <div>
      <p class="over">${esc(p.kind).toUpperCase()} · ${esc(p.place).toUpperCase()} · ${esc(p.year)}</p>
      <h1>${esc(p.title)}</h1>
      <p class="sub">${esc(p.subtitle)}</p>
    </div>
    <div class="scalebar" aria-hidden="true"><span>0</span><span>1</span><span>3</span><span>6</span><span>10</span></div>
  </header>
  <div class="project-body">${md(p.body)}</div>
  <div class="plates">${figures || sitegrabDiagram}</div>
  <nav class="pager">
    <a href="portfolio-${prev.slug}.html">← ${esc(prev.title)}</a>
    <a href="portfolio.html">Index</a>
    <a href="portfolio-${next.slug}.html">${esc(next.title)} →</a>
  </nav>
</article>`;
  return page({
    id: "portfolio",
    title: `${p.title} — Arshay Kathpalia`,
    desc: p.subtitle || p.tagline,
    sheet: `${p.sheet} ${p.slug.toUpperCase()}`,
    body,
  });
}

/* -------------------------------------------------------------- writing */

function writingPage() {
  const essayList = essays.length
    ? essays
        .map(
          (e) => `
  <a class="work-row" href="writing-${e.slug}.html">
    <span class="fig">W</span>
    <span class="work-title">${esc(e.title)}</span>
    <span class="work-year">${esc(e.date)}</span>
  </a>`
        )
        .join("")
    : `
  <div class="placeholder">
    <span class="k">PLACEHOLDER — ESSAYS</span>
    <p>Longer written work lives here. Drop <code>.md</code> files into <code>website-content/writing/</code> and rebuild; each becomes its own page.</p>
  </div>`;

  const thoughtsHtml = thoughts.length
    ? `<div class="fragments">${thoughts
        .map(
          (t) => `
  <div class="fragment">
    ${t.date ? `<span class="k">${esc(t.date)}</span>` : ""}
    <p>${inlineMd(t.text)}</p>
  </div>`
        )
        .join("")}</div>`
    : `
  <div class="placeholder">
    <span class="k">PLACEHOLDER — FRAGMENTS</span>
    <p>Short working notes — questions in progress. Add paragraphs to <code>website-content/thoughts.md</code> and rebuild.</p>
  </div>`;

  const booksHtml = totalBooks
    ? `<div class="work-list">
  <a class="work-row" href="books.html">
    <span class="fig">B—</span>
    <span class="work-title">The reading room has its own sheet</span>
    <span class="work-year">${totalBooks} BOOK${totalBooks === 1 ? "" : "S"} →</span>
  </a></div>`
    : `
  <div class="placeholder">
    <span class="k">PLACEHOLDER — READING ROOM</span>
    <p>The books doing real work on me. Add lines to <code>website-content/books.md</code> and rebuild.</p>
  </div>`;

  const body = `
<section class="band">
  <h1><span class="fig">W—</span>Writing &amp; thinking</h1>
  <p class="lede">What is space, actually — and what does it mean for something to be real to a person standing inside it? Physics and philosophy put the question in front of me; architecture is where it has to be answered in stone, timber and light. The dissertation held both at once: visibility graph analysis and axial mapping against phenomenological fieldwork across three Dubai sites, reading Pallasmaa, Zumthor, Merleau-Ponty, Norberg-Schulz and Bachelard against what I actually measured. Nominated for the RIBA Architecture Today Prize.</p>

  <h2><span class="fig">01</span>Essays</h2>
  ${essayList}

  <h2><span class="fig">02</span>Fragments</h2>
  ${thoughtsHtml}

  <h2><span class="fig">03</span>Reading room</h2>
  ${booksHtml}
</section>`;
  return page({
    id: "writing",
    title: "Writing — Arshay Kathpalia",
    desc: "Essays, fragments and reading on phenomenology, physics and the philosophy of architecture.",
    sheet: "AK-W00 WRITING",
    body,
  });
}

function essayPage(e) {
  const body = `
<article class="project essay">
  <header class="project-head">
    <div>
      <p class="over">ESSAY${e.date ? " · " + esc(e.date).toUpperCase() : ""}</p>
      <h1>${esc(e.title)}</h1>
    </div>
  </header>
  <div class="project-body">${md(e.body)}</div>
  <nav class="pager"><a href="writing.html">← Writing index</a></nav>
</article>`;
  return page({
    id: "writing",
    title: `${e.title} — Arshay Kathpalia`,
    desc: e.title,
    sheet: `AK-W ${e.slug.toUpperCase()}`,
    body,
  });
}

/* ---------------------------------------------------------------- books */

function booksPage() {
  let fig = 0;
  const sectionsHtml = books
    .map((sec, si) => {
      const plated = sec.items.filter((b) => b.cover);
      const unplated = sec.items.filter((b) => !b.cover);

      const shelf = plated.length
        ? `<div class="bookshelf">${plated
            .map((b) => {
              fig += 1;
              return `
  <figure class="book-plate">
    <div class="book-cover"><img src="${b.cover.src}" alt="Cover of ${esc(b.title)}${b.author ? " by " + esc(b.author) : ""}" loading="lazy"></div>
    <figcaption>
      <span class="k">FIG B${String(fig).padStart(2, "0")}</span>
      <span class="bp-title">${esc(b.title)}</span>
      ${b.author ? `<span class="bp-author">${esc(b.author)}</span>` : ""}
      ${b.note ? `<span class="bp-note">${esc(b.note)}</span>` : ""}
    </figcaption>
  </figure>`;
            })
            .join("")}</div>`
        : "";

      // entries with no verified cover are listed honestly as text —
      // never a stand-in image next to the wrong title
      const rows = unplated.length
        ? `<ul class="books unplated">${unplated
            .map(
              (b) =>
                `<li><span class="k">UNPLATED</span><strong>${esc(b.title)}</strong>${b.author ? ` — ${esc(b.author)}` : ""}${b.note ? `<span class="note">${esc(b.note)}</span>` : ""}</li>`
            )
            .join("")}</ul>`
        : "";

      const empty = !sec.items.length
        ? `
  <div class="placeholder">
    <span class="k">SECTION EMPTY — NOTHING LISTED YET</span>
    <p>No titles under “${esc(sec.title)}” so far. Lines added beneath this heading in <code>website-content/books.md</code> appear here on the next build.</p>
  </div>`
        : "";

      return `
  <h2><span class="fig">${String(si + 1).padStart(2, "0")}</span>${esc(sec.title)}</h2>
  ${shelf}${rows}${empty}`;
    })
    .join("\n");

  const body = `
<section class="band">
  <h1><span class="fig">B—</span>Books</h1>
  <p class="lede">The reading room, drawn to plate. Each cover is catalogued as a figure; titles without a verified cover are listed in text until the right edition is confirmed.</p>
  ${sectionsHtml}
</section>`;
  return page({
    id: "books",
    title: "Books — Arshay Kathpalia",
    desc: "The reading room: read, currently reading, and recommended books.",
    sheet: "AK-B00 BOOKS",
    body,
  });
}

/* ---------------------------------------------------------------- about */

function aboutPage() {
  const projLinks = projectLinks
    .map((l) => {
      const pending = !l.url || l.url.toUpperCase() === "TODO";
      return pending
        ? `<div class="link-row pending"><span class="work-title">${esc(l.name)}</span><span class="work-kind">${esc(l.desc)}</span><span class="k">LINK PENDING</span></div>`
        : `<a class="link-row" href="${esc(l.url)}"><span class="work-title">${esc(l.name)}</span><span class="work-kind">${esc(l.desc)}</span><span class="k">↗</span></a>`;
    })
    .join("");

  const socials = socialLinks
    .map((l) => {
      const pending = !l.url || l.url.toUpperCase() === "TODO";
      if (l.url.startsWith("mailto:"))
        return `<span class="chip"><a class="mailto" data-u="kathpaliaarshay" data-d="gmail.com" href="#">Email</a></span>`;
      return pending
        ? `<span class="chip pending">${esc(l.name)} — pending</span>`
        : `<span class="chip"><a href="${esc(l.url)}">${esc(l.name)}</a></span>`;
    })
    .join("");

  const body = `
<section class="band cols about-top">
  <div>
    <h1><span class="fig">CV</span>About</h1>
    <div class="longbio">${md(longBio)}</div>
  </div>
  <aside class="cv-panel">
    <div class="cv-box">
      <p class="over">CURRICULUM VITAE</p>
      <p>One page. Education, experience, software, languages.</p>
      <a class="btn" href="Arshay_Kathpalia_CV.pdf" download>Download CV (PDF) ↓</a>
    </div>
    <div class="cv-box">
      <p class="over">AT A GLANCE</p>
      <ul class="facts">
        <li>BA (Hons) Architecture — Oxford Brookes, RIBA/ARB Part 1</li>
        <li>Year under Valerio Olgiati — USI Mendrisio, taught in Italian</li>
        <li>Dissertation nominated — RIBA Architecture Today Prize</li>
        <li>Internship — Emaar, Dubai (masterplanning, documentation)</li>
        <li>Freelance visualisation practice — 2022–present</li>
        <li>English · Italian · Hindi</li>
        <li>London &amp; Dubai</li>
      </ul>
    </div>
    <div class="cv-box">
      <p class="over">CONTACT</p>
      <p><a class="mailto" data-u="kathpaliaarshay" data-d="gmail.com" href="#">Write to me</a> — the address assembles on click; scrapers get nothing.</p>
      <p class="chips">${socials}</p>
    </div>
  </aside>
</section>

<section class="band">
  <h2><span class="fig">04</span>Projects with their own weight</h2>
  <div class="work-list">${projLinks}</div>
  <p class="aside">URLs pending in <code>website-content/links.md</code> — the rows above go live the moment real links replace the TODOs.</p>
</section>`;
  return page({
    id: "about",
    title: "CV / About — Arshay Kathpalia",
    desc: "Part 1 architectural assistant. Oxford Brookes, Mendrisio under Olgiati, Emaar Dubai. Download the CV.",
    sheet: "AK-CV ABOUT",
    body,
  });
}

/* ---------------------------------------------------------------- build */

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// static assets
for (const f of fs.readdirSync(ASSETS)) copy(path.join(ASSETS, f), `assets/${f}`);

// content files
copy(path.join(CONTENT, "profile", "CV.pdf"), "Arshay_Kathpalia_CV.pdf");
copy(path.join(CONTENT, "portfolio", "full-portfolio.pdf"), "full-portfolio.pdf");
for (const p of projects) {
  const imgDir = path.join(CONTENT, "portfolio", p.folder, "images");
  if (!exists(imgDir)) continue;
  for (const f of fs.readdirSync(imgDir)) {
    if (/\.(jpe?g|png|webp|svg)$/i.test(f)) copy(path.join(imgDir, f), `assets/img/${p.slug}/${f}`);
  }
}

// book covers (fetched by site/fetch-covers.js into website-content/books/covers/)
const coverDir = path.join(CONTENT, "books", "covers");
if (exists(coverDir)) {
  for (const f of fs.readdirSync(coverDir)) {
    if (/\.(jpe?g|png|webp)$/i.test(f)) copy(path.join(coverDir, f), `assets/img/books/${f}`);
  }
}

// generated sitegrab pipeline diagram lives with the other assets
if (exists(path.join(ASSETS, "sitegrab-pipeline.svg"))) {
  copy(path.join(ASSETS, "sitegrab-pipeline.svg"), "assets/img/sitegrab/pipeline.svg");
}

write("index.html", homePage());
write("portfolio.html", portfolioIndex());
projects.forEach((p, i) => write(`portfolio-${p.slug}.html`, projectPage(p, i)));
write("writing.html", writingPage());
essays.forEach((e) => write(`writing-${e.slug}.html`, essayPage(e)));
if (totalBooks) write("books.html", booksPage());
write("about.html", aboutPage());

console.log(
  `built: ${projects.length} projects, ${essays.length} essays, ${thoughts.length} fragments, ${totalBooks} books → dist/`
);
