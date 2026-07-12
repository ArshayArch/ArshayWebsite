# arshaykathpalia — personal site

A zero-dependency static site. All content lives in `website-content/`;
the generator (`site/build.js`, Node stdlib only, no npm packages) reads it
and writes the finished site to `dist/`.

## Build

```
node site/build.js
```

That's the whole build. `dist/` is disposable — never edit it by hand.

## Updating content (no code changes needed)

| To add…            | Do this, then rebuild                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| A new essay        | Drop `my-essay.md` into `website-content/writing/` (`# Title`, optional `date: YYYY-MM-DD` line, then body). It gets its own page + an index entry. |
| A thought/fragment | Add a paragraph to `website-content/thoughts.md` (optionally starting `[YYYY-MM-DD]`). |
| A book             | Add `- Title \| Author \| note` to `website-content/books.md`.               |
| A real URL         | Replace a `TODO` in `website-content/links.md` (SiteGrab, ThinkingPartner, socials). Pending rows go live automatically. |
| A new CV           | Overwrite `website-content/profile/CV.pdf`.                                  |
| Project images     | Drop numbered files (`01-name.jpg`) into that project's `images/` folder — they render as figures in filename order, captions from the filename. |
| A new project      | Add a folder `website-content/portfolio/project-NN-slug/` with `description.md` + `images/`, then register it in `PROJECT_META` at the top of `site/build.js` (slug, sheet number, kind, year, place). |

The three confirmed project descriptions (Architecture Centre, Podcast
Studio, SiteGrab) are used verbatim — the generator never rewrites them.

`RIBA_Application_Profile.md` is private reference material and is **not**
published by the build. Keep it that way.

## Deploying on Render (static site)

1. Push this repo to GitHub/GitLab.
2. Render dashboard → **New → Static Site** → connect the repo.
3. Settings:
   - **Build command:** `node site/build.js`
   - **Publish directory:** `dist`
4. Add your custom domain under Settings → Custom Domains.

Every push rebuilds and redeploys automatically.

## Local preview

```
node site/serve.js
```

then open http://localhost:8087.
