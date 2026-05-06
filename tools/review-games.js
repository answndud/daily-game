"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GAMES_DIR = path.join(ROOT, "games");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listGames() {
  return fs
    .readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(GAMES_DIR, entry.name);
      const meta = readJson(path.join(dir, "meta.json"));
      const files = ["index.html", "style.css", "script.js"].reduce((stats, file) => {
        stats[file] = fs.statSync(path.join(dir, file)).size;
        return stats;
      }, {});
      const script = fs.readFileSync(path.join(dir, "script.js"), "utf8");
      return {
        dirName: entry.name,
        meta,
        files,
        script,
      };
    })
    .sort((a, b) => a.meta.date.localeCompare(b.meta.date));
}

function countBy(games, selector) {
  return games.reduce((counts, game) => {
    const key = selector(game);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function hasRoundReset(script) {
  return /round\s*=\s*1|startRound\(1\)|resetRun\(1\)|라운드 1/.test(script);
}

function hasNextRound(script) {
  return /round\s*\+\s*1|round\+1|state\.round\s*\+=\s*1|다음 라운드/.test(script);
}

function hasPointer(script) {
  return /pointer/.test(script);
}

function hasKeyboard(script) {
  return /keydown/.test(script);
}

function hasResize(script) {
  return /resize/.test(script);
}

function riskLevel(game) {
  const missing = [];
  if (!hasRoundReset(game.script)) missing.push("fail-reset");
  if (!hasNextRound(game.script)) missing.push("next-round");
  if (!hasKeyboard(game.script)) missing.push("keyboard");
  if (!hasPointer(game.script) && !/click/.test(game.script)) missing.push("primary-input");
  if (game.files["script.js"] > 22000) missing.push("large-script");
  if (missing.length >= 2) return "P1";
  if (missing.length === 1) return "P2";
  return "OK";
}

function controlFamily(control) {
  if (/탭|tap|패드|게이트|거울/.test(control)) return "tap";
  if (/드래그|drag|원형/.test(control)) return "drag";
  if (/스와이프|swipe/.test(control)) return "swipe";
  if (/홀드|hold/.test(control)) return "hold";
  if (/방향|좌우/.test(control)) return "direction";
  return "other";
}

function printCounts(title, counts) {
  console.log(`\n## ${title}`);
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([key, value]) => console.log(`- ${key}: ${value}`));
}

function main() {
  const games = listGames();
  console.log(`# Daily Game Review Snapshot`);
  console.log(`\n- Total games: ${games.length}`);
  console.log(`- Date range: ${games[0]?.meta.date || "n/a"} to ${games[games.length - 1]?.meta.date || "n/a"}`);

  printCounts("Genre Distribution", countBy(games, (game) => game.meta.genre));
  printCounts("Control Distribution", countBy(games, (game) => game.meta.controls));
  printCounts("Control Families", countBy(games, (game) => controlFamily(game.meta.controls)));
  printCounts("Session Lengths", countBy(games, (game) => game.meta.sessionLength));

  console.log("\n## Per-Game Heuristics");
  console.log("| Date | Title | Genre | Controls | Risk | Round Reset | Next Round | Keyboard | Resize | JS bytes |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: |");
  for (const game of games) {
    console.log([
      `| ${game.meta.date}`,
      game.meta.title,
      game.meta.genre,
      game.meta.controls,
      riskLevel(game),
      hasRoundReset(game.script) ? "yes" : "no",
      hasNextRound(game.script) ? "yes" : "no",
      hasKeyboard(game.script) ? "yes" : "no",
      hasResize(game.script) ? "yes" : "no",
      `${game.files["script.js"]} |`,
    ].join(" | "));
  }
}

main();
