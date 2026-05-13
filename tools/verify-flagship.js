"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

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

function main() {
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

  for (const field of ["title", "slug", "tagline", "genre", "controls", "sessionLength", "description"]) {
    if (typeof meta[field] !== "string" || meta[field].trim() === "") {
      errors.push(`Flagship meta field must be a non-empty string: ${field}`);
    }
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
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (error) {
      errors.push(`JavaScript parse failed: ${path.relative(repoRoot, file)}\n${String(error.stderr || error.message)}`);
    }
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
