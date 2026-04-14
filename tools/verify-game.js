"use strict";

const path = require("path");

const { repoRoot, validateGameDirectory } = require("./lib/harness");

function usage() {
  console.error("Usage: node tools/verify-game.js games/YYYY-MM-DD-slug");
  process.exit(1);
}

function main() {
  const input = process.argv[2];
  if (!input) {
    usage();
  }

  const gameDir = path.resolve(repoRoot(), input);
  const errors = validateGameDirectory(gameDir);

  if (errors.length > 0) {
    console.error(`Verification failed for ${input}`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Verification passed for ${input}`);
}

main();
