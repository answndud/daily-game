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
  const cards = entries.length
    ? entries
        .map(({ href, meta }) => {
          return [
            '<article class="game-card">',
            `  <p class="game-date">${escapeHtml(meta.date)}</p>`,
            `  <h2>${escapeHtml(meta.title)}</h2>`,
            `  <p class="game-tagline">${escapeHtml(meta.tagline)}</p>`,
            `  <p class="game-description">${escapeHtml(meta.description)}</p>`,
            `  <p class="game-meta">${escapeHtml(meta.genre)} · ${escapeHtml(meta.controls)} · ${escapeHtml(meta.sessionLength)}</p>`,
            `  <a class="game-link" href="${escapeHtml(href)}">Play</a>`,
            "</article>",
          ].join("\n");
        })
        .join("\n")
    : '<article class="empty-state"><p>No games have been generated yet.</p></article>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily One-Game Pipeline</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4efe7;
      --panel: #fffaf2;
      --ink: #1f1f1a;
      --muted: #6d675b;
      --accent: #cf5c36;
      --accent-2: #264653;
      --line: #e8dcc8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Trebuchet MS", "Gill Sans", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(207, 92, 54, 0.18), transparent 28%),
        linear-gradient(180deg, #f8f2e8 0%, var(--bg) 100%);
      color: var(--ink);
    }
    main {
      width: min(980px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    .hero {
      padding: 24px;
      border: 2px solid var(--line);
      border-radius: 24px;
      background: rgba(255, 250, 242, 0.85);
      box-shadow: 0 18px 50px rgba(38, 70, 83, 0.08);
    }
    .eyebrow {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    h1 {
      margin: 0;
      font-size: clamp(2rem, 5vw, 3.6rem);
      line-height: 0.95;
    }
    .hero p:last-child {
      margin-bottom: 0;
      color: var(--muted);
      max-width: 62ch;
      line-height: 1.55;
    }
    .game-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      margin-top: 24px;
    }
    .game-card, .empty-state {
      background: var(--panel);
      border: 2px solid var(--line);
      border-radius: 20px;
      padding: 18px;
      box-shadow: 0 12px 30px rgba(38, 70, 83, 0.08);
    }
    .game-date, .game-meta {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .game-card h2 {
      margin: 0 0 8px;
      font-size: 1.35rem;
    }
    .game-tagline {
      margin: 0 0 10px;
      color: var(--accent-2);
      font-weight: 700;
    }
    .game-description {
      margin: 0 0 16px;
      line-height: 1.5;
    }
    .game-link {
      display: inline-block;
      padding: 10px 14px;
      border-radius: 999px;
      background: var(--accent);
      color: #fff8f2;
      text-decoration: none;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">Codex Harness</p>
      <h1>Daily One-Game Pipeline</h1>
      <p>One small mobile-first web game per day. Static files only, no external assets, rebuilt from metadata.</p>
    </section>
    <section class="game-grid">
${cards}
    </section>
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
