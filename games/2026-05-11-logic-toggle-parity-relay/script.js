"use strict";

const ROW_KEYS = ["1", "2", "3", "4", "5"];
const COL_KEYS = ["q", "w", "e", "r", "t"];

const dom = {
  currentGrid: document.getElementById("currentGrid"),
  targetGrid: document.getElementById("targetGrid"),
  rowControls: document.getElementById("rowControls"),
  colControls: document.getElementById("colControls"),
  round: document.getElementById("roundValue"),
  move: document.getElementById("moveValue"),
  limit: document.getElementById("limitValue"),
  size: document.getElementById("sizeValue"),
  match: document.getElementById("matchValue"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  startButton: document.getElementById("startButton"),
  resetButton: document.getElementById("resetButton"),
};

const state = {
  phase: "idle",
  round: 1,
  size: 3,
  current: [],
  target: [],
  moves: 0,
  limit: 8,
  nextRoundTimer: 0,
};

function sizeFor(round) {
  return Math.min(5, 3 + Math.floor((round - 1) / 3));
}

function solutionLengthFor(round) {
  return Math.min(10, 4 + round);
}

function limitFor(round) {
  return solutionLengthFor(round) + Math.max(2, 5 - Math.floor(round / 2));
}

function startRound(round = 1) {
  stopTimers();
  state.phase = "running";
  state.round = round;
  state.size = sizeFor(round);
  state.current = makeGrid(state.size, false);
  state.target = makeTarget(state.size, solutionLengthFor(round));
  state.moves = 0;
  state.limit = limitFor(round);
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 행과 열 반전으로 목표 패턴을 만드세요.`);
  render();
}

function stopTimers() {
  if (state.nextRoundTimer) {
    window.clearTimeout(state.nextRoundTimer);
    state.nextRoundTimer = 0;
  }
}

function makeGrid(size, value) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => value));
}

function makeTarget(size, steps) {
  const grid = makeGrid(size, false);
  const ops = [];

  while (ops.length < steps) {
    const type = Math.random() < 0.5 ? "row" : "col";
    const index = Math.floor(Math.random() * size);
    const key = `${type}:${index}`;
    if (ops[ops.length - 1] === key) {
      continue;
    }
    ops.push(key);
    applyToggle(grid, type, index);
  }

  if (grid.flat().every((cell) => !cell)) {
    applyToggle(grid, "row", 0);
  }

  return grid;
}

function chooseToggle(type, index) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }

  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }

  applyToggle(state.current, type, index);
  state.moves += 1;

  if (gridsMatch()) {
    clearRound();
    return;
  }

  if (state.moves >= state.limit) {
    failRun();
    return;
  }

  setMessage(`${labelFor(type, index)} 반전. ${state.limit - state.moves}번 안에 목표와 맞추세요.`);
  render();
}

function applyToggle(grid, type, index) {
  if (type === "row") {
    for (let x = 0; x < grid.length; x += 1) {
      grid[index][x] = !grid[index][x];
    }
    return;
  }

  for (let y = 0; y < grid.length; y += 1) {
    grid[y][index] = !grid[y][index];
  }
}

function clearRound() {
  state.phase = "cleared";
  render();
  showOverlay(
    "클리어",
    `라운드 ${state.round} 패턴 일치`,
    "다음 라운드는 목표 패턴을 만드는 반전 수가 늘고, 이후에는 격자도 커집니다. 곧 자동으로 시작합니다.",
    "다음 라운드"
  );
  setMessage(`라운드 ${state.round + 1}로 이동합니다.`);
  state.nextRoundTimer = window.setTimeout(() => startRound(state.round + 1), 900);
}

function failRun() {
  state.phase = "failed";
  stopTimers();
  render();
  showOverlay(
    "실패",
    "토글 제한을 넘겼습니다",
    "이번 run은 종료됩니다. 다시 시작하면 라운드 1의 새 패턴으로 돌아갑니다.",
    "라운드 1 재시작"
  );
  setMessage("실패: 제한 횟수 초과로 라운드 1로 돌아갑니다.");
}

function gridsMatch() {
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      if (state.current[y][x] !== state.target[y][x]) {
        return false;
      }
    }
  }
  return true;
}

function matchPercent() {
  let matched = 0;
  const total = state.size * state.size;
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      if (state.current[y][x] === state.target[y][x]) {
        matched += 1;
      }
    }
  }
  return Math.round((matched / total) * 100);
}

function render() {
  dom.round.textContent = String(state.round);
  dom.move.textContent = String(state.moves);
  dom.limit.textContent = String(state.limit);
  dom.size.textContent = `${state.size}x${state.size}`;
  dom.match.textContent = String(matchPercent());
  renderGrid(dom.currentGrid, state.current, true);
  renderGrid(dom.targetGrid, state.target, false);
  renderControls();
}

function renderGrid(node, grid, showMismatch) {
  node.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
  node.innerHTML = "";

  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      const cell = document.createElement("span");
      const on = grid[y][x];
      cell.className = on ? "cell on" : "cell";
      if (showMismatch && state.current[y][x] !== state.target[y][x]) {
        cell.classList.add("mismatch");
      }
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", on ? "켜짐" : "꺼짐");
      node.appendChild(cell);
    }
  }
}

function renderControls() {
  dom.rowControls.innerHTML = "";
  dom.colControls.innerHTML = "";

  for (let index = 0; index < state.size; index += 1) {
    dom.rowControls.appendChild(makeControl("row", index));
    dom.colControls.appendChild(makeControl("col", index));
  }
}

function makeControl(type, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = labelFor(type, index);
  button.addEventListener("click", () => chooseToggle(type, index));
  return button;
}

function labelFor(type, index) {
  return type === "row" ? `R${index + 1}` : `C${index + 1}`;
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

  const lower = event.key.toLowerCase();
  const rowIndex = ROW_KEYS.indexOf(lower);
  if (rowIndex >= 0 && rowIndex < state.size) {
    event.preventDefault();
    chooseToggle("row", rowIndex);
    return;
  }

  const colIndex = COL_KEYS.indexOf(lower);
  if (colIndex >= 0 && colIndex < state.size) {
    event.preventDefault();
    chooseToggle("col", colIndex);
  }
});

render();
