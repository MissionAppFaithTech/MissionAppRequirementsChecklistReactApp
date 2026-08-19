# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A static documentation site (no build step, no package manager, no tests) publishing the functional and
non-functional requirements specification for **Mission App**, a platform for raising church awareness of
missionary work. All content is in Portuguese (pt-BR). The published site lives at
https://missionappfaithtech.github.io/MissionAppRequirementsList/.

## Viewing changes

There is no build/lint/test tooling in this repo. To preview changes, just open `index.html` in a browser,
or serve the directory locally, e.g.:

```bash
python3 -m http.server 8000
```

## Deployment

Pushing to `main` triggers `.github/workflows/pages.yml`, which uploads the entire repo root as a GitHub
Pages artifact and deploys it — there is no build step in CI either. Whatever is committed is what ships.

## Architecture

**`index.html`** is a single, large monolithic document (~1500 lines) containing both the sidebar summary
nav and the full spec content. It was originally formatted with HTML Tidy (see the `generator` meta tag);
keep that indentation style in mind when hand-editing so diffs stay clean.

The document has two structurally-linked parts that must be kept in sync:

1. A `<nav id="requirements-nav">` sidebar containing `<ul>/<li><a href="#rf-N">` and `#rnf-N-M` links —
   this is both the table of contents and the search index (search matches against this nav's `<li>` text).
2. The `<main id="conteudo">` content, where top-level sections carry matching ids: `<h3 id="rf-N">` for
   each Functional Requirement (RF) and `<h3 id="rnf-N">` / `<h4 id="rnf-N-M">` for each Non-Functional
   Requirement (RNF) category/item.

**Important**: only these top-level section headings carry ids. Sub-items inside an RF section (e.g. the
`<h4>1.1 Login (RF 1.1)</h4>` headings inside RF-1) are plain headings with no id — they're not individually
addressable from the sidebar or scroll-spy, only the parent `<h3 id="rf-1">` is. When adding a new
requirement, add both the sidebar `<li><a href="#rf-N">…</a></li>` entry and the corresponding
`<h3 id="rf-N">`/`<h4 id="rnf-N-M">` in the content, using the existing numbering scheme (RF for functional,
NF/RNF for non-functional, sub-items like `RF 1.4.1` for further breakdown without a new id).

Mockup images referenced via `<figure><img src="img/...">` come from the project's Figma prototype (linked
in `README.md`) and live under `img/`.

**CSS** (`css/`) is split by responsibility and loaded in this order in `index.html`'s `<head>`:
- `base.css` — CSS custom properties (colors, spacing tokens) and reset.
- `layout.css` — the two-column `site-shell` grid (sidebar + content) and page header.
- `sidebar.css` — sidebar nav, search box, brand block styles.
- `content.css` — typography/spacing for the requirements prose itself.
- `components.css` — reusable widgets (mobile menu button, back-to-top button/tooltip, overlay).
- `responsive.css` — media queries at 1024px, 680px, and 420px breakpoints, loaded last so it can override.

**JS** (`js/`) is vanilla ES modules, no bundler. `main.js` is the entry point (loaded via
`<script type="module">`) and just wires up three independent features:
- `navigation.js` — mobile sidebar open/close (button + overlay + Escape key), and the back-to-top button
  that appears past `scrollY > 300` with a one-time tooltip.
- `search.js` — filters sidebar `<li>` items by accent-insensitive substring match (`normalizeText` strips
  diacritics via `NFD` normalization) against the `#doc-search` input; toggles `#search-empty` when nothing
  matches.
- `scroll-spy.js` — an `IntersectionObserver` over each linked section that highlights the corresponding
  sidebar link (`is-active` class) as the user scrolls.

Each module owns one concern and does its own `querySelector`/null-checking; there's no shared state or
framework between them.
