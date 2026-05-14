"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");

const repoRoot = path.resolve(__dirname, "..");
const flagshipRoot = path.join(repoRoot, "flagship", "deep-station-recovery-log");
const requiredFiles = ["index.html", "style.css", "meta.json", "src/main.js"];

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function listJavaScriptFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listJavaScriptFiles(filePath);
      }
      return entry.name.endsWith(".js") ? [filePath] : [];
    });
}

async function main() {
  const errors = [];

  for (const file of requiredFiles) {
    const filePath = path.join(flagshipRoot, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing required flagship file: ${path.relative(repoRoot, filePath)}`);
    }
  }

  if (errors.length > 0) {
    report(errors);
  }

  const html = read(path.join(flagshipRoot, "index.html"));
  const css = read(path.join(flagshipRoot, "style.css"));
  const meta = JSON.parse(read(path.join(flagshipRoot, "meta.json")));

  for (const field of ["title", "date", "slug", "tagline", "genre", "controls", "sessionLength", "description"]) {
    if (typeof meta[field] !== "string" || meta[field].trim() === "") {
      errors.push(`Flagship meta field must be a non-empty string: ${field}`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date || "")) {
    errors.push("Flagship meta date must use YYYY-MM-DD format");
  }

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    errors.push("Flagship index.html must include a viewport meta tag");
  }
  if (!/style\.css/.test(html)) {
    errors.push("Flagship index.html must reference style.css");
  }
  if (!/type=["']module["'][^>]+src=["']\.\/src\/main\.js["']/.test(html)) {
    errors.push("Flagship index.html must reference ./src/main.js as a module");
  }

  const allText = [html, css, ...listJavaScriptFiles(path.join(flagshipRoot, "src")).map(read)].join("\n");
  const forbidden = [/https?:\/\//i, /src=["']\/(?!\/)/i, /href=["']\/(?!\/)/i, /\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg)\b/i];
  for (const pattern of forbidden) {
    if (pattern.test(allText)) {
      errors.push(`Disallowed flagship reference matched: ${pattern}`);
    }
  }

  for (const file of listJavaScriptFiles(path.join(flagshipRoot, "src"))) {
    try {
      execFileSync(process.execPath, ["--input-type=module", "--check"], {
        input: read(file),
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      errors.push(`JavaScript parse failed: ${path.relative(repoRoot, file)}\n${String(error.stderr || error.message)}`);
    }
  }

  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flagship-module-"));
  try {
    fs.cpSync(path.join(flagshipRoot, "src"), path.join(smokeRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(smokeRoot, "package.json"), JSON.stringify({ type: "module" }));
    const stateModule = await import(pathToFileURL(path.join(smokeRoot, "src", "state.js")).href);
    const records = { bestSector: 1, muted: true, runs: 0, logs: [] };
    const state = stateModule.createGameState(records);
    stateModule.startRun(state);
    if (state.phase !== "running" || state.sector.index !== 1) {
      errors.push("Flagship state smoke test failed to start sector 1");
    }
    stateModule.step(state, 1, 0);
    stateModule.scan(state);
    if (!Number.isFinite(state.oxygen) || !Number.isFinite(state.battery) || !Number.isFinite(state.integrity)) {
      errors.push("Flagship state smoke test produced invalid resource values");
    }
  } catch (error) {
    errors.push(`Flagship module smoke test failed: ${error.message}`);
  } finally {
    fs.rmSync(smokeRoot, { recursive: true, force: true });
  }

  if (errors.length > 0) {
    report(errors);
  }

  console.log("Flagship verification passed");
}

function report(errors) {
  console.error("Flagship verification failed");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

main();
