"use strict";

const crypto = require("crypto");

const GENRES = [
  {
    key: "lane-dodger",
    title: "Lane Dodger",
    loop: "shift between lanes to avoid incoming hazards",
    goodControls: ["tap-left-right", "swipe-lanes"],
    ui: "three lanes, tall portrait playfield, clear survival timer",
  },
  {
    key: "timing-stack",
    title: "Timing Stack",
    loop: "drop moving pieces with tight timing to build a stable tower",
    goodControls: ["tap-drop"],
    ui: "single play area with a tower silhouette and score at top",
  },
  {
    key: "orbit-collector",
    title: "Orbit Collector",
    loop: "keep an object in motion and redirect it to collect targets",
    goodControls: ["tap-pulse", "hold-charge"],
    ui: "central arena with orbit lines and bright targets",
  },
  {
    key: "drag-rescue",
    title: "Drag Rescue",
    loop: "drag a protector to shield fragile units from moving threats",
    goodControls: ["drag-shield"],
    ui: "single arena with civilians, threats, and a movable shield",
  },
  {
    key: "tap-cleanse",
    title: "Tap Cleanse",
    loop: "tap spreading hazards before they fill the board",
    goodControls: ["tap-targets"],
    ui: "grid or blob field with clear contamination growth",
  },
];

const OBJECTIVES = [
  "survive 30 seconds",
  "reach 20 points",
  "clear three waves",
  "collect 12 targets",
  "protect the core until the timer ends",
];

const TWISTS = [
  "the playfield reverses direction every few seconds",
  "safe zones shrink as the timer rises",
  "combos briefly slow down incoming threats",
  "misses increase hazard speed",
  "perfect timing builds a temporary shield",
];

const TITLES = [
  "Neon Drift",
  "Pocket Panic",
  "Soft Shield",
  "Orbit Snack",
  "Tiny Tower Tempo",
  "Rush Ribbon",
  "Clean Sweep Mini",
];

function parseArgs(argv) {
  const parsed = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--date") {
      parsed.date = argv[index + 1];
      index += 1;
    } else if (token === "--seed") {
      parsed.seed = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function createRng(seedText) {
  let state = crypto.createHash("sha256").update(seedText).digest().readUInt32LE(0);
  return function random() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function choose(random, values) {
  return values[Math.floor(random() * values.length)];
}

function buildPlan(date, seedText) {
  const random = createRng(seedText);
  const genre = choose(random, GENRES);
  const control = choose(random, genre.goodControls);
  const objective = choose(random, OBJECTIVES);
  const twist = choose(random, TWISTS);
  const title = choose(random, TITLES);

  const slug = `${genre.key}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const tagline = `${genre.title} for one-thumb sessions`;

  return {
    title,
    date,
    slug,
    tagline,
    genre: genre.title,
    controls: control,
    sessionLength: "1-3 minutes",
    description: `${genre.loop}. Goal: ${objective}. Twist: ${twist}.`,
    concept: {
      coreLoop: genre.loop,
      objective,
      twist,
      controlScheme: control,
      layout: genre.ui,
    },
    scopeGuardrails: [
      "Keep the game on a single screen.",
      "Use one primary mechanic only.",
      "Allow immediate restart after fail or win.",
      "Make the first input obvious without a tutorial wall.",
    ],
    implementationNotes: [
      "Use only HTML, CSS, and vanilla JavaScript.",
      "Prefer CSS gradients, text, and simple canvas or div-based shapes.",
      "Avoid external assets and sound.",
    ],
  };
}

function main() {
  const args = parseArgs(process.argv);
  const date = args.date || new Date().toISOString().slice(0, 10);
  const seed = args.seed || `daily-plan:${date}`;
  const plan = buildPlan(date, seed);
  console.log(JSON.stringify(plan, null, 2));
}

main();
