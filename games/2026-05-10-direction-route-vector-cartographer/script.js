"use strict";

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const KEY_TO_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const dom = {
  grid: document.getElementById("mapGrid"),
  round: document.getElementById("roundValue"),
  mark: document.getElementById("markValue"),
  markTotal: document.getElementById("markTotalValue"),
  move: document.getElementById("moveValue"),
  moveLimit: document.getElementById("moveLimitValue"),
  size: document.getElementById("sizeValue"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  startButton: document.getElementById("startButton"),
  resetButton: document.getElementById("resetButton"),
  directionButtons: Array.from(document.querySelectorAll("[data-dir]")),
};

const state = {
  phase: "idle",
  round: 1,
  size: 5,
  player: { x: 0, y: 0 },
  exit: { x: 0, y: 0 },
  marks: [],
  walls: new Set(),
  trail: new Set(),
  moves: 0,
  moveLimit: 12,
  nextRoundTimer: 0,
};

function sizeFor(round) {
  return Math.min(7, 5 + Math.floor((round - 1) / 3));
}

function markCountFor(round) {
  return Math.min(5, 3 + Math.floor((round - 1) / 2));
}

function pathLengthFor(round) {
  return Math.min(20, 8 + round * 2);
}

function wallCountFor(round, size) {
  return Math.min(size * size - 10, 3 + round * 2);
}

function startRound(round = 1) {
  stopTimers();
  state.phase = "running";
  state.round = round;
  buildPuzzle(round);
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 표식을 모두 회수하고 출구로 이동하세요.`);
  render();
}

function stopTimers() {
  if (state.nextRoundTimer) {
    window.clearTimeout(state.nextRoundTimer);
    state.nextRoundTimer = 0;
  }
}

function buildPuzzle(round) {
  const size = sizeFor(round);
  const path = makePath(size, pathLengthFor(round));
  const markCount = markCountFor(round);
  const pathSet = new Set(path.map(pointKey));
  const markIndexes = pickMarkIndexes(path.length, markCount);
  const marks = markIndexes.map((index) => ({ ...path[index], found: false }));

  state.size = size;
  state.player = { ...path[0] };
  state.exit = { ...path[path.length - 1] };
  state.marks = marks;
  state.walls = makeWalls(size, pathSet, wallCountFor(round, size));
  state.trail = new Set([pointKey(state.player)]);
  state.moves = 0;
  state.moveLimit = path.length + Math.max(2, 6 - round);
}

function makePath(size, targetLength) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const start = {
      x: Math.floor(size / 2),
      y: Math.floor(size / 2),
    };
    const path = [start];
    const visited = new Set([pointKey(start)]);

    while (path.length < targetLength) {
      const current = path[path.length - 1];
      const options = Object.values(DIRS)
        .map((dir) => ({ x: current.x + dir.dx, y: current.y + dir.dy }))
        .filter((point) => inBounds(point, size) && !visited.has(pointKey(point)));

      if (options.length === 0) {
        break;
      }

      const next = options[Math.floor(Math.random() * options.length)];
      path.push(next);
      visited.add(pointKey(next));
    }

    if (path.length >= Math.min(targetLength, size * size - 4)) {
      return path;
    }
  }

  return fallbackPath(size);
}

function fallbackPath(size) {
  const path = [];
  for (let y = 0; y < size; y += 1) {
    const xs = y % 2 === 0 ? [...Array(size).keys()] : [...Array(size).keys()].reverse();
    for (const x of xs) {
      path.push({ x, y });
    }
  }
  return path.slice(0, Math.min(path.length, 14));
}

function pickMarkIndexes(pathLength, count) {
  const indexes = new Set();
  const start = 2;
  const end = pathLength - 2;

  while (indexes.size < count && indexes.size < Math.max(0, end - start + 1)) {
    indexes.add(start + Math.floor(Math.random() * Math.max(1, end - start + 1)));
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

function makeWalls(size, protectedSet, count) {
  const walls = new Set();

  while (walls.size < count) {
    const point = {
      x: Math.floor(Math.random() * size),
      y: Math.floor(Math.random() * size),
    };
    const key = pointKey(point);
    if (!protectedSet.has(key)) {
      walls.add(key);
    }
  }

  return walls;
}

function move(dirName) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }

  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }

  const dir = DIRS[dirName];
  if (!dir) {
    return;
  }

  const next = {
    x: state.player.x + dir.dx,
    y: state.player.y + dir.dy,
  };

  if (!inBounds(next, state.size) || state.walls.has(pointKey(next))) {
    failRun("경계 또는 장애물에 충돌했습니다");
    return;
  }

  state.player = next;
  state.moves += 1;
  state.trail.add(pointKey(next));
  collectMark(next);

  if (state.moves > state.moveLimit) {
    failRun("이동 제한을 넘었습니다");
    return;
  }

  if (samePoint(next, state.exit)) {
    if (collectedCount() === state.marks.length) {
      clearRound();
      return;
    }
    setMessage("출구는 아직 잠겨 있습니다. 남은 표식을 먼저 회수하세요.");
  } else {
    setMessage(`이동 ${state.moves}/${state.moveLimit}. 표식 ${collectedCount()}/${state.marks.length}.`);
  }

  render();
}

function collectMark(point) {
  const mark = state.marks.find((item) => !item.found && samePoint(item, point));
  if (mark) {
    mark.found = true;
    setMessage(`표식 회수. ${state.marks.length - collectedCount()}개 남았습니다.`);
  }
}

function clearRound() {
  state.phase = "cleared";
  render();
  showOverlay(
    "클리어",
    `라운드 ${state.round} 지도 완성`,
    "다음 라운드는 지도 크기, 표식 수, 장애물 밀도가 올라갑니다. 곧 자동으로 시작합니다.",
    "다음 라운드"
  );
  setMessage(`라운드 ${state.round + 1}로 이동합니다.`);
  state.nextRoundTimer = window.setTimeout(() => startRound(state.round + 1), 900);
}

function failRun(reason) {
  state.phase = "failed";
  stopTimers();
  render();
  showOverlay(
    "실패",
    reason,
    "이번 run은 종료됩니다. 다시 시작하면 라운드 1의 새 지도로 돌아갑니다.",
    "라운드 1 재시작"
  );
  setMessage(`실패: ${reason}. 라운드 1로 돌아갑니다.`);
}

function render() {
  dom.round.textContent = String(state.round);
  dom.mark.textContent = String(collectedCount());
  dom.markTotal.textContent = String(state.marks.length);
  dom.move.textContent = String(state.moves);
  dom.moveLimit.textContent = String(state.moveLimit);
  dom.size.textContent = `${state.size}x${state.size}`;

  dom.grid.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
  dom.grid.innerHTML = "";

  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      dom.grid.appendChild(renderCell({ x, y }));
    }
  }
}

function renderCell(point) {
  const key = pointKey(point);
  const cell = document.createElement("span");
  cell.className = "cell";
  cell.setAttribute("role", "gridcell");

  if (state.trail.has(key)) {
    cell.classList.add("trail");
  }

  if (state.walls.has(key)) {
    cell.classList.add("wall");
    cell.setAttribute("aria-label", "장애물");
    return cell;
  }

  const mark = state.marks.find((item) => !item.found && samePoint(item, point));
  if (mark) {
    cell.classList.add("mark");
    cell.textContent = "◆";
    cell.setAttribute("aria-label", "표식");
  }

  if (samePoint(point, state.exit)) {
    cell.classList.add("exit");
    if (collectedCount() < state.marks.length) {
      cell.classList.add("locked");
    }
    cell.textContent = "E";
    cell.setAttribute("aria-label", "출구");
  }

  if (samePoint(point, state.player)) {
    cell.classList.add("player");
    cell.setAttribute("aria-label", "탐사선");
  }

  if (!cell.textContent) {
    cell.classList.add("path");
    cell.setAttribute("aria-label", "빈 칸");
  }

  return cell;
}

function collectedCount() {
  return state.marks.filter((mark) => mark.found).length;
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function inBounds(point, size) {
  return point.x >= 0 && point.x < size && point.y >= 0 && point.y < size;
}

function showOverlay(label, title, text, buttonText) {
  dom.overlayLabel.textContent = label;
  dom.overlayTitle.textContent = title;
  dom.overlayText.textContent = text;
  dom.startButton.textContent = buttonText;
  dom.overlay.classList.remove("hidden");
}

function setMessage(text) {
  dom.message.textContent = text;
}

function handleStart() {
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  startRound(1);
}

dom.directionButtons.forEach((button) => {
  button.addEventListener("click", () => move(button.dataset.dir));
});

dom.startButton.addEventListener("click", handleStart);
dom.resetButton.addEventListener("click", () => startRound(1));

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleStart();
    return;
  }

  if (event.key === "Escape") {
    startRound(1);
    return;
  }

  const dir = KEY_TO_DIR[event.key] || KEY_TO_DIR[event.key.toLowerCase()];
  if (dir) {
    event.preventDefault();
    move(dir);
  }
});

render();
