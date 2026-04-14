"use strict";

const fs = require("fs");
const path = require("path");

const {
  buildCatalogHtml,
  collectGameEntries,
  repoRoot,
  sortEntriesNewestFirst,
} = require("./lib/harness");

function main() {
  const entries = sortEntriesNewestFirst(collectGameEntries());
  const html = buildCatalogHtml(entries);
  const outputPath = path.join(repoRoot(), "index.html");
  fs.writeFileSync(outputPath, html);
  console.log(`Catalog rebuilt: ${entries.length} game(s) -> ${outputPath}`);
}

main();
