"use strict";

const KEY_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "q", "w", "e", "r", "a", "s", "d", "f", "z", "x", "c", "v", "t", "y", "u", "i"];
const DIRS = ["right", "down", "left", "up"];
const DELTA = {
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
};
const ARROW = { right: "→", down: "↓", left: "←", up: "↑" };

const dom = {
  round: document.getElementById("roundValue"),
  score: document.getElementById("scoreValue"),
  goal: document.getElementById("goalValue"),
  test: document.getElementById("testValue"),
  testLimit: document.getElementById("testLimitValue"),
  size: document.getElementById("sizeValue"),
  board: document.getElementById("board"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  start: document.getElementById("startButton"),
  reset: document.getElementById("resetButton"),
  testButton: document.getElementById("testButton"),
  newButton: document.getElementById("newButton"),
};

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  size: 5,
  tests: 0,
  testLimit: 3,
  path: [],
  directions: [],
  solution: [],
  flow: new Set(),
  leak: -1,
  nextTimer: 0,
};

function sizeFor(round) {
  return Math.min(7, 5 + Math.floor((round - 1) / 3));
}

function goalFor(round) {
  return 2 + Math.min(5, round);
}

function testLimitFor(round) {
  return Math.max(2, 4 - Math.floor(round / 4));
}

function startRound(round = 1) {
  clearNextTimer();
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.size = sizeFor(round);
  state.testLimit = testLimitFor(round);
  dom.overlay.classList.add("hidden");
  newCanal();
  setMessage(`라운드 ${round}: ${state.goal}개의 운하를 완성하세요.`);
}

function newCanal() {
  state.tests = 0;
  state.flow = new Set();
  state.leak = -1;
  buildPath();
  scrambleDirections();
  render();
}

function buildPath() {
  const row = (state.round + state.score) % state.size;
  const path = [];
  for (let x = 0; x < state.size; x += 1) {
    path.push({ x, y: row });
  }
  const extraSteps = Math.min(state.size - 2, Math.floor((state.round + state.score) / 2));
  let tail = path[path.length - 1];
  let y = row;
  for (let step = 0; step < extraSteps; step += 1) {
    const dir = y < state.size - 1 && (step % 2 === 0 || y === 0) ? 1 : -1;
    y += dir;
    tail = { x: tail.x, y };
    path.push(tail);
  }
  state.path = path;
  state.solution = path.map((cell, index) => {
    const next = path[index + 1];
    if (!next) {
      return "right";
    }
    if (next.x > cell.x) return "right";
    if (next.x < cell.x) return "left";
    if (next.y > cell.y) return "down";
    return "up";
  });
}

function scrambleDirections() {
  state.directions = state.solution.map((dir, index) => {
    const offset = 1 + ((state.round + state.score + index) % 3);
    return DIRS[(DIRS.indexOf(dir) + offset) % DIRS.length];
  });
}

function rotateTile(pathIndex) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  if (pathIndex < 0) {
    return;
  }
  const current = state.directions[pathIndex];
  state.directions[pathIndex] = DIRS[(DIRS.indexOf(current) + 1) % DIRS.length];
  state.flow = new Set();
  state.leak = -1;
  render();
}

function testFlow() {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  state.tests += 1;
  state.flow = new Set();
  state.leak = -1;
  let currentIndex = 0;
  const visited = new Set();
  for (let step = 0; step < state.path.length + 2; step += 1) {
    state.flow.add(String(currentIndex));
    if (currentIndex === state.path.length - 1) {
      completeCanal();
      return;
    }
    const dir = state.directions[currentIndex];
    const nextPos = add(state.path[currentIndex], DELTA[dir]);
    const nextIndex = state.path.findIndex((cell) => cell.x === nextPos.x && cell.y === nextPos.y);
    if (nextIndex < 0 || visited.has(String(nextIndex))) {
      state.leak = currentIndex;
      break;
    }
    visited.add(String(currentIndex));
    currentIndex = nextIndex;
  }
  if (state.tests >= state.testLimit) {
    failRun("검사 횟수를 모두 사용했습니다.");
    return;
  }
  setMessage(`물이 샜습니다. 남은 검사 ${state.testLimit - state.tests}번.`);
  render();
}

function completeCanal() {
  state.score += 1;
  setMessage(`운하 완성. 남은 운하 ${Math.max(0, state.goal - state.score)}개.`);
  if (state.score >= state.goal) {
    clearRound();
    return;
  }
  newCanal();
}

function clearRound() {
  state.phase = "cleared";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "유량 안정";
  dom.overlayTitle.textContent = `라운드 ${state.round} 완료`;
  dom.overlayText.textContent = "다음 라운드는 운하가 길어지고 검사 기회가 줄어듭니다.";
  dom.start.textContent = `라운드 ${state.round + 1}`;
  setMessage(`성공. 곧 라운드 ${state.round + 1}로 이동합니다.`);
  render();
  state.nextTimer = window.setTimeout(() => startRound(state.round + 1), 900);
}

function failRun(reason) {
  state.phase = "failed";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "운하 붕괴";
  dom.overlayTitle.textContent = "라운드 1로 복귀";
  dom.overlayText.textContent = `${reason} 수로의 화살표가 다음 진한 타일을 향하는지 확인하세요.`;
  dom.start.textContent = "라운드 1";
  setMessage("실패하면 진행도가 초기화됩니다. 라운드 1부터 다시 시작하세요.");
  render();
}

function render() {
  renderHud();
  dom.board.style.setProperty("--size", state.size);
  const cells = [];
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      cells.push(renderCell(x, y));
    }
  }
  dom.board.replaceChildren(...cells);
}

function renderHud() {
  dom.round.textContent = String(state.round);
  dom.score.textContent = String(state.score);
  dom.goal.textContent = String(state.goal);
  dom.test.textContent = String(state.tests);
  dom.testLimit.textContent = String(state.testLimit);
  dom.size.textContent = `${state.size}x${state.size}`;
}

function renderCell(x, y) {
  const cell = document.createElement("button");
  const pathIndex = state.path.findIndex((item) => item.x === x && item.y === y);
  const isPath = pathIndex >= 0;
  cell.type = "button";
  cell.className = `tile${isPath ? " path" : ""}${pathIndex === 0 ? " source" : ""}${pathIndex === state.path.length - 1 ? " sink" : ""}${state.flow.has(String(pathIndex)) ? " flow" : ""}${state.leak === pathIndex ? " leak" : ""}`;
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("aria-label", isPath ? `${pathIndex + 1}번 수로` : "빈 칸");
  if (isPath) {
    const pipe = document.createElement("span");
    pipe.className = "pipe";
    pipe.style.setProperty("--rot", `${DIRS.indexOf(state.directions[pathIndex]) * 90}deg`);
    pipe.textContent = ARROW[state.directions[pathIndex]];
    cell.appendChild(pipe);
  }
  cell.addEventListener("click", () => rotateTile(pathIndex));
  return cell;
}

function add(pos, delta) {
  return { x: pos.x + delta.x, y: pos.y + delta.y };
}

function clearNextTimer() {
  if (state.nextTimer) {
    window.clearTimeout(state.nextTimer);
    state.nextTimer = 0;
  }
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

dom.start.addEventListener("click", handleStart);
dom.reset.addEventListener("click", () => startRound(1));
dom.testButton.addEventListener("click", testFlow);
dom.newButton.addEventListener("click", newCanal);

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "enter" || key === " ") {
    event.preventDefault();
    testFlow();
    return;
  }
  if (key === "escape") {
    startRound(1);
    return;
  }
  const index = KEY_ORDER.indexOf(key);
  if (index >= 0 && index < state.path.length) {
    rotateTile(index);
  }
});

render();
