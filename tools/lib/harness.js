"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REQUIRED_META_FIELDS = [
  "title",
  "date",
  "slug",
  "tagline",
  "genre",
  "controls",
  "sessionLength",
  "description",
];

function repoRoot() {
  return path.resolve(__dirname, "..", "..");
}

function gamesRoot() {
  return path.join(repoRoot(), "games");
}

function normalizeSlashes(value) {
  return value.split(path.sep).join("/");
}

function listGameDirectories() {
  const root = gamesRoot();
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeRead(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function validateMeta(meta, dirName) {
  const errors = [];

  for (const field of REQUIRED_META_FIELDS) {
    if (!(field in meta)) {
      errors.push(`Missing meta field: ${field}`);
      continue;
    }

    if (typeof meta[field] !== "string" || meta[field].trim() === "") {
      errors.push(`Meta field must be a non-empty string: ${field}`);
    }
  }

  if (meta.date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
    errors.push("Meta date must use YYYY-MM-DD format");
  }

  if (meta.slug && !/^[a-z0-9-]+$/.test(meta.slug)) {
    errors.push("Meta slug must use lowercase letters, digits, and hyphens only");
  }

  if (meta.date && meta.slug) {
    const expectedPrefix = `${meta.date}-${meta.slug}`;
    if (dirName !== expectedPrefix) {
      errors.push(`Directory name must match ${expectedPrefix}`);
    }
  }

  return errors;
}

function findDisallowedExternalReferences(contents) {
  const errors = [];
  const externalPatterns = [
    /https?:\/\//i,
    /src=["']\/(?!\/)/i,
    /href=["']\/(?!\/)/i,
    /url\(["']?\/(?!\/)/i,
  ];

  for (const pattern of externalPatterns) {
    if (pattern.test(contents)) {
      errors.push(`Disallowed absolute or external reference matched: ${pattern}`);
    }
  }

  return errors;
}

function findDisallowedAssetReferences(contents) {
  const errors = [];
  const assetPattern = /\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg)\b/i;
  if (assetPattern.test(contents)) {
    errors.push("Disallowed external asset type referenced");
  }
  return errors;
}

function parseJavaScript(filePath) {
  const contents = safeRead(filePath);
  vm.createScript(contents, { filename: filePath });
}

function validateGameDirectory(gameDir) {
  const errors = [];
  const dirName = path.basename(gameDir);
  const requiredFiles = ["index.html", "style.css", "script.js", "meta.json"];

  for (const fileName of requiredFiles) {
    const filePath = path.join(gameDir, fileName);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing required file: ${normalizeSlashes(path.relative(repoRoot(), filePath))}`);
    }
  }

  if (errors.length > 0) {
    return errors;
  }

  const htmlPath = path.join(gameDir, "index.html");
  const cssPath = path.join(gameDir, "style.css");
  const jsPath = path.join(gameDir, "script.js");
  const metaPath = path.join(gameDir, "meta.json");

  const meta = readJson(metaPath);
  errors.push(...validateMeta(meta, dirName));

  const html = safeRead(htmlPath);
  const css = safeRead(cssPath);
  const js = safeRead(jsPath);

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    errors.push("index.html must include a viewport meta tag");
  }

  if (!/style\.css/.test(html)) {
    errors.push("index.html must reference style.css");
  }

  if (!/script\.js/.test(html)) {
    errors.push("index.html must reference script.js");
  }

  for (const contents of [html, css, js]) {
    errors.push(...findDisallowedExternalReferences(contents));
    errors.push(...findDisallowedAssetReferences(contents));
  }

  if (css.trim() === "") {
    errors.push("style.css must not be empty");
  }

  if (js.trim() === "") {
    errors.push("script.js must not be empty");
  }

  try {
    parseJavaScript(jsPath);
  } catch (error) {
    errors.push(`script.js failed to parse: ${error.message}`);
  }

  return errors;
}

function collectGameEntries() {
  return listGameDirectories().map((gameDir) => {
    const dirName = path.basename(gameDir);
    const meta = readJson(path.join(gameDir, "meta.json"));
    return {
      dirName,
      href: `./games/${dirName}/index.html`,
      meta,
    };
  });
}

function sortEntriesNewestFirst(entries) {
  return [...entries].sort((left, right) => {
    if (left.meta.date === right.meta.date) {
      return left.dirName < right.dirName ? 1 : -1;
    }
    return left.meta.date < right.meta.date ? 1 : -1;
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCatalogHtml(entries) {
  const entryCount = entries.length;
  const latestEntry = entryCount > 0 ? entries[0] : null;
  const statusLabel = entryCount > 0
    ? `${entryCount} published game${entryCount === 1 ? "" : "s"}`
    : "Waiting for first published entry";

  const cards = entries.length
    ? entries
        .map(({ href, meta }) => {
          return [
            '<article class="game-card">',
            '  <div class="game-meta-row">',
            `    <p class="game-date">${escapeHtml(meta.date)}</p>`,
            `    <p class="game-meta">${escapeHtml(meta.genre)}</p>`,
            `    <p class="game-meta">${escapeHtml(meta.controls)}</p>`,
            `    <p class="game-meta">${escapeHtml(meta.sessionLength)}</p>`,
            "  </div>",
            `  <h2>${escapeHtml(meta.title)}</h2>`,
            `  <p class="game-tagline">${escapeHtml(meta.tagline)}</p>`,
            `  <p class="game-description">${escapeHtml(meta.description)}</p>`,
            `  <a class="game-link" href="${escapeHtml(href)}">Play</a>`,
            "</article>",
          ].join("\n");
        })
        .join("\n")
    : [
        '<article class="empty-state">',
        '  <div class="game-meta-row">',
        '    <p class="game-meta">No entries yet</p>',
        '    <p class="game-meta">Catalog ready</p>',
        "  </div>",
        "  <h3>Nothing has been generated yet.</h3>",
        "  <p>The first game will appear here once a daily folder is created with <strong>index.html</strong>, <strong>style.css</strong>, <strong>script.js</strong>, and <strong>meta.json</strong>.</p>",
        "</article>",
      ].join("\n");

  return `<!doctype html>
<!-- Generated by tools/build-catalog.js. Edit tools/lib/harness.js to change catalog layout or styling. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily One-Game Pipeline</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f4f6;
      --panel: #ffffff;
      --panel-muted: #f8f9fb;
      --ink: #171717;
      --muted: #5f6670;
      --line: #d8dde3;
      --line-strong: #b8c0c9;
      --accent: #20242a;
      --chip: #eef1f4;
      --chip-ink: #47505a;
      --radius: 16px;
      --radius-sm: 999px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    main {
      width: min(1100px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 24px 0 48px;
    }
    .shell {
      display: grid;
      gap: 18px;
    }
    .hero,
    .section-head,
    .game-card,
    .empty-state,
    .stat {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
    }
    .hero {
      padding: 22px;
    }
    .eyebrow,
    .section-label,
    .stat-label {
      margin: 0;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    h1 {
      margin: 10px 0 12px;
      font-size: clamp(2rem, 4vw, 3.2rem);
      line-height: 0.98;
    }
    .hero-summary {
      margin: 0;
      color: var(--muted);
      max-width: 60ch;
      line-height: 1.6;
    }
    .hero-top {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      background: var(--chip);
      color: var(--chip-ink);
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
    }
    .stats {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: 18px;
    }
    .stat {
      padding: 16px;
      background: var(--panel-muted);
    }
    .stat-value {
      margin: 8px 0 0;
      font-size: clamp(1.5rem, 3vw, 2rem);
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .stat-note {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.45;
    }
    .section-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 20px;
    }
    .section-head h2 {
      margin: 6px 0 0;
      font-size: 1.3rem;
    }
    .section-copy {
      margin: 6px 0 0;
      color: var(--muted);
      line-height: 1.5;
      max-width: 56ch;
    }
    .game-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .game-card,
    .empty-state {
      padding: 18px;
    }
    .game-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }
    .game-date,
    .game-meta {
      margin: 0;
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      background: var(--chip);
      color: var(--chip-ink);
      font-size: 0.82rem;
      font-weight: 600;
    }
    .game-card h2 {
      margin: 0 0 8px;
      font-size: 1.25rem;
      line-height: 1.15;
    }
    .game-tagline {
      margin: 0 0 10px;
      color: var(--ink);
      font-weight: 600;
    }
    .game-description {
      margin: 0 0 18px;
      color: var(--muted);
      line-height: 1.5;
    }
    .game-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--accent);
      background: var(--accent);
      color: #f8fafc;
      text-decoration: none;
      font-weight: 700;
    }
    .empty-state {
      background: var(--panel-muted);
    }
    .empty-state h3 {
      margin: 0 0 8px;
      font-size: 1.1rem;
    }
    .empty-state p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }
    .empty-state strong {
      color: var(--ink);
    }
    a:focus-visible {
      outline: 2px solid var(--line-strong);
      outline-offset: 2px;
    }
    .game-link:hover,
    .game-link:focus-visible {
      background: #2c3138;
      border-color: #2c3138;
    }
    @media (max-width: 760px) {
      main {
        width: min(100vw - 24px, 1100px);
        padding: 12px 0 36px;
      }
      .hero-top,
      .section-head {
        flex-direction: column;
        align-items: start;
      }
      .stats {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <div class="shell">
      <section class="hero">
        <div class="hero-top">
          <div>
            <p class="eyebrow">Game Archive</p>
            <h1>Daily One-Game Pipeline</h1>
          </div>
          <p class="status-chip">${escapeHtml(statusLabel)}</p>
        </div>
        <p class="hero-summary">One small mobile-first web game per day. Static files only, no external assets, and a catalog rebuilt from readable metadata.</p>
        <section class="stats" aria-label="Repository summary">
          <article class="stat">
            <p class="stat-label">Games</p>
            <p class="stat-value">${escapeHtml(entryCount)}</p>
            <p class="stat-note">${entryCount > 0 ? "Published entries are rebuilt directly from game metadata." : "The archive is ready for the first daily release."}</p>
          </article>
          <article class="stat">
            <p class="stat-label">Latest</p>
            <p class="stat-value">${latestEntry ? escapeHtml(latestEntry.meta.date) : "Pending"}</p>
            <p class="stat-note">${latestEntry ? escapeHtml(latestEntry.meta.title) : "No game has been published yet."}</p>
          </article>
          <article class="stat">
            <p class="stat-label">Format</p>
            <p class="stat-value">Static</p>
            <p class="stat-note">Plain HTML, CSS, and JavaScript with mobile-first play.</p>
          </article>
        </section>
      </section>
      <section class="section-head">
        <div>
          <p class="section-label">Catalog</p>
          <h2>Latest Games</h2>
          <p class="section-copy">Each entry stays compact, readable, and directly playable from local static files.</p>
        </div>
      </section>
      <section class="game-grid">
${cards}
      </section>
    </div>
  </main>
</body>
</html>
`;
}

module.exports = {
  REQUIRED_META_FIELDS,
  buildCatalogHtml,
  collectGameEntries,
  gamesRoot,
  listGameDirectories,
  normalizeSlashes,
  repoRoot,
  sortEntriesNewestFirst,
  validateGameDirectory,
};
