#!/usr/bin/env node
/*
 * fetch-covers.js — pulls real cover art for the books in
 * website-content/books.md from Open Library (no auth, no npm packages).
 *
 * For each "- Title | Author | note" entry it queries the Open Library
 * search API, accepts a result only when both the title and the author
 * genuinely match, downloads the large cover, and saves it as
 * website-content/books/covers/<slug-of-title>.png — the filename
 * site/build.js looks for.
 *
 * Honesty rules, deliberate:
 *   - no confident match  → the book is reported, never given a guessed
 *     or placeholder cover; build.js lists it as text until fixed.
 *   - entries missing an author or a title are skipped and reported
 *     (e.g. an author noted before the actual title is confirmed).
 *   - existing cover files are kept (delete one to re-fetch, or --force).
 *
 * Usage:  node site/fetch-covers.js [--force]
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BOOKS_MD = path.join(ROOT, "website-content", "books.md");
const COVER_DIR = path.join(ROOT, "website-content", "books", "covers");
const FORCE = process.argv.includes("--force");
const UA = "arshaykathpalia-site-build (kathpaliaarshay@gmail.com)";

const slugify = (s) =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* loose normalisation for matching only — never shown anywhere */
const norm = (s) =>
  s.toLowerCase().replace(/['’":;,.!?()\-–—]/g, " ").replace(/\s+/g, " ").trim();

function get(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": UA } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          return resolve(get(new URL(res.headers.location, url).href, redirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function parseBooks() {
  const text = fs.readFileSync(BOOKS_MD, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const items = [];
  let section = "";
  for (const line of text.split("\n")) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) { section = h[1].trim(); continue; }
    const m = line.match(/^[-*]\s+(.*)$/);
    if (!m) continue;
    const parts = m[1].split("|").map((s) => s.trim());
    items.push({ section, title: parts[0] || "", author: parts[1] || "" });
  }
  return items;
}

/* Find the right edition's cover id, or null.

   Only an EXACT normalised title match counts — never a prefix — so
   adaptations, summaries and spin-offs ("… adapted for Young Adults",
   "Summary of …") can never shadow the real book. Works are often
   catalogued under their original-language title (Frankl's is German),
   so when a work's own title doesn't match we walk its editions and
   match the edition titles instead, preferring English printings. */
async function findCover(title, author) {
  const t = norm(title);
  const surname = norm(author).split(" ").pop();
  const authorOk = (d) =>
    (d.author_name || []).some((a) => norm(a).split(" ").includes(surname));

  const q =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(`${title} ${author}`)}` +
    `&limit=10&fields=key,title,author_name,cover_i,edition_count`;
  const docs = (JSON.parse((await get(q)).toString()).docs || []).filter(authorOk);

  // exact work-title match with its own cover: done
  const direct = docs.find((d) => d.title && norm(d.title) === t && d.cover_i);
  if (direct) return { coverId: direct.cover_i, via: direct.title };

  // otherwise inspect the editions of the biggest matching works
  const byEditions = [...docs].sort((a, b) => (b.edition_count || 0) - (a.edition_count || 0));
  for (const work of byEditions.slice(0, 3)) {
    if (!work.key) continue;
    const eds =
      JSON.parse((await get(`https://openlibrary.org${work.key}/editions.json?limit=200`)).toString())
        .entries || [];
    const hits = eds.filter(
      (e) => e.title && norm(e.title) === t && Array.isArray(e.covers) && e.covers.some((c) => c > 0)
    );
    if (!hits.length) continue;
    // prefer recent English printings — old library scans make poor plates
    const year = (e) => {
      const m = (e.publish_date || "").match(/\d{4}/);
      return m ? Number(m[0]) : 0;
    };
    const english = hits.filter((e) =>
      (e.languages || []).some((l) => l.key === "/languages/eng")
    );
    const pool = english.length ? english : hits;
    const ed = pool.sort((a, b) => year(b) - year(a))[0];
    return { coverId: ed.covers.find((c) => c > 0), via: `${work.title} → edition ${ed.title}` };
  }
  return null;
}

function jpgToPng(jpgPath, pngPath) {
  // dev-time convenience only (this script never runs on Render);
  // System.Drawing ships with Windows PowerShell.
  execFileSync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Add-Type -AssemblyName System.Drawing; ` +
      `$i = [System.Drawing.Image]::FromFile('${jpgPath.replace(/'/g, "''")}'); ` +
      `$i.Save('${pngPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png); ` +
      `$i.Dispose()`,
  ]);
}

async function main() {
  const items = parseBooks();
  if (!items.length) {
    console.log("books.md has no entries yet — nothing to fetch.");
    return;
  }
  fs.mkdirSync(COVER_DIR, { recursive: true });

  const needManual = [];
  const skipped = [];
  let fetched = 0;
  let kept = 0;

  for (const b of items) {
    if (!b.title || !b.author) {
      skipped.push(b);
      continue;
    }
    const slug = slugify(b.title);
    const pngPath = path.join(COVER_DIR, `${slug}.png`);
    if (!FORCE && ["png", "jpg", "jpeg", "webp"].some((e) => fs.existsSync(path.join(COVER_DIR, `${slug}.${e}`)))) {
      kept += 1;
      continue;
    }
    process.stdout.write(`  ${b.title} — ${b.author} … `);
    try {
      const hit = await findCover(b.title, b.author);
      if (!hit) {
        console.log("no confident match");
        needManual.push(b);
        continue;
      }
      // ?default=false → 404 instead of a blank stand-in image
      const jpg = await get(`https://covers.openlibrary.org/b/id/${hit.coverId}-L.jpg?default=false`);
      if (jpg.length < 2000) throw new Error("cover image suspiciously small");
      const tmpJpg = path.join(COVER_DIR, `${slug}.tmp.jpg`);
      fs.writeFileSync(tmpJpg, jpg);
      try {
        jpgToPng(tmpJpg, pngPath);
        fs.unlinkSync(tmpJpg);
      } catch (e) {
        // conversion unavailable — keep the honest .jpg, build.js accepts it
        fs.renameSync(tmpJpg, path.join(COVER_DIR, `${slug}.jpg`));
      }
      console.log(`ok (${hit.via})`);
      fetched += 1;
    } catch (e) {
      console.log(`failed: ${e.message}`);
      needManual.push(b);
    }
  }

  console.log(`\ncovers: ${fetched} fetched, ${kept} already present.`);
  if (skipped.length) {
    console.log("skipped (title or author missing — confirm before fetching):");
    for (const b of skipped) console.log(`  - [${b.section}] ${b.title || b.author}`);
  }
  if (needManual.length) {
    console.log("need a cover added manually to website-content/books/covers/:");
    for (const b of needManual) console.log(`  - [${b.section}] ${b.title} — ${b.author} (${slugify(b.title)}.png)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
