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
    ? `공개된 게임 ${entryCount}개`
    : "첫 게임 대기 중";

  const cards = entries.length
    ? entries
        .map(({ href, meta }) => {
          const label = `${meta.title} 게임 열기`;
          return [
            `<a class="game-card" href="${escapeHtml(href)}" aria-label="${escapeHtml(label)}">`,
            '  <div class="game-meta-row">',
            `    <p class="game-date">${escapeHtml(meta.date)}</p>`,
            `    <p class="game-meta">${escapeHtml(meta.genre)}</p>`,
            `    <p class="game-meta">${escapeHtml(meta.controls)}</p>`,
            `    <p class="game-meta">${escapeHtml(meta.sessionLength)}</p>`,
            "  </div>",
            `  <h2>${escapeHtml(meta.title)}</h2>`,
            `  <p class="game-tagline">${escapeHtml(meta.tagline)}</p>`,
            `  <p class="game-description">${escapeHtml(meta.description)}</p>`,
            "</a>",
          ].join("\n");
        })
        .join("\n")
    : [
        '<article class="empty-state">',
        '  <div class="game-meta-row">',
        '    <p class="game-meta">아직 항목 없음</p>',
        '    <p class="game-meta">카탈로그 준비 완료</p>',
        "  </div>",
        "  <h3>아직 생성된 게임이 없습니다.</h3>",
        "  <p>일일 게임 폴더에 <strong>index.html</strong>, <strong>style.css</strong>, <strong>script.js</strong>, <strong>meta.json</strong>이 만들어지면 첫 항목이 이곳에 표시됩니다.</p>",
        "</article>",
      ].join("\n");

  return `<!doctype html>
<!-- tools/build-catalog.js로 생성됨. 카탈로그 레이아웃이나 스타일을 바꾸려면 tools/lib/harness.js를 수정하세요. -->
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>데일리 원게임 파이프라인</title>
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
    .game-card {
      display: block;
      color: inherit;
      text-decoration: none;
      transition: border-color 140ms ease, transform 140ms ease, background 140ms ease;
    }
    .game-card:hover,
    .game-card:focus-visible {
      border-color: var(--line-strong);
      background: var(--panel-muted);
      transform: translateY(-1px);
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
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
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
            <p class="eyebrow">게임 아카이브</p>
            <h1>데일리 원게임 파이프라인</h1>
          </div>
          <p class="status-chip">${escapeHtml(statusLabel)}</p>
        </div>
        <p class="hero-summary">매일 작은 모바일 우선 웹게임 하나. 외부 에셋 없이 정적 파일만으로 동작하고, 사람이 읽을 수 있는 메타데이터를 기준으로 카탈로그를 다시 만듭니다.</p>
        <section class="stats" aria-label="저장소 요약">
          <article class="stat">
            <p class="stat-label">게임 수</p>
            <p class="stat-value">${escapeHtml(entryCount)}</p>
            <p class="stat-note">${entryCount > 0 ? "공개된 항목은 모두 게임 메타데이터에서 다시 생성됩니다." : "첫 일일 게임을 올릴 준비가 끝났습니다."}</p>
          </article>
          <article class="stat">
            <p class="stat-label">최신</p>
            <p class="stat-value">${latestEntry ? escapeHtml(latestEntry.meta.date) : "대기 중"}</p>
            <p class="stat-note">${latestEntry ? escapeHtml(latestEntry.meta.title) : "아직 공개된 게임이 없습니다."}</p>
          </article>
          <article class="stat">
            <p class="stat-label">형식</p>
            <p class="stat-value">정적 파일</p>
            <p class="stat-note">HTML, CSS, JavaScript만으로 모바일 우선 플레이를 제공합니다.</p>
          </article>
        </section>
      </section>
      <section class="section-head">
        <div>
          <p class="section-label">카탈로그</p>
          <h2>최신 게임</h2>
          <p class="section-copy">각 항목은 간결하고 읽기 쉬운 형태를 유지하며, 로컬 정적 파일만으로 바로 플레이할 수 있습니다.</p>
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
