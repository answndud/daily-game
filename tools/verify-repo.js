"use strict";

const fs = require("fs");
const path = require("path");

const {
  collectGameEntries,
  listGameDirectories,
  repoRoot,
  validateGameDirectory,
} = require("./lib/harness");

function main() {
  const errors = [];
  const entries = collectGameEntries();
  const dates = new Map();

  for (const gameDir of listGameDirectories()) {
    const relative = path.relative(repoRoot(), gameDir);
    const gameErrors = validateGameDirectory(gameDir);
    for (const error of gameErrors) {
      errors.push(`${relative}: ${error}`);
    }
  }

  for (const entry of entries) {
    if (dates.has(entry.meta.date)) {
      errors.push(`Duplicate date detected: ${entry.meta.date}`);
    }
    dates.set(entry.meta.date, entry.dirName);
  }

  const indexPath = path.join(repoRoot(), "index.html");
  if (!fs.existsSync(indexPath)) {
    errors.push("Root index.html is missing");
  } else {
    const indexHtml = fs.readFileSync(indexPath, "utf8");
    for (const entry of entries) {
      const expectedLink = `./games/${entry.dirName}/index.html`;
      if (!indexHtml.includes(expectedLink)) {
        errors.push(`Catalog is missing link for ${entry.dirName}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("Repository verification failed");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Repository verification passed (${entries.length} game(s))`);
}

main();
