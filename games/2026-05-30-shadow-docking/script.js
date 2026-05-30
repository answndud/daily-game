const gridEl = document.getElementById("grid");
const rowControls = document.getElementById("rowControls");
const columnControls = document.getElementById("columnControls");
const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const moveValue = document.getElementById("moveValue");
const missValue = document.getElementById("missValue");
const messageLine = document.getElementById("messageLine");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const testButton = document.getElementById("testButton");
const resetButton = document.getElementById("resetButton");

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  size: 4,
  moves: 0,
  limit: 10,
  current: [],
  initial: [],
  target: [],
  seed: 20260530,
  nextTimer: 0
};

function random() {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function goalFor(round) {
  return Math.min(6, 2 + round);
}

function sizeFor(round) {
  return Math.min(6, 4 + Math.floor((round - 1) / 3));
}

function limitFor(round, scramble) {
  return Math.max(scramble + 2, scramble + 5 - Math.floor(round / 3));
}

function indexOf(row, col) {
  return row * state.size + col;
}

function shiftRow(board, row) {
  const next = [...board];

  for (let col = 0; col < state.size; col += 1) {
    next[indexOf(row, (col + 1) % state.size)] = board[indexOf(row, col)];
  }

  return next;
}

function shiftColumn(board, col) {
  const next = [...board];

  for (let row = 0; row < state.size; row += 1) {
    next[indexOf((row + 1) % state.size, col)] = board[indexOf(row, col)];
  }

  return next;
}

function mismatchCount() {
  return state.current.reduce((sum, value, index) => {
    return sum + (value === state.target[index] ? 0 : 1);
  }, 0);
}

function isSolved() {
  return mismatchCount() === 0;
}

function makeInitialBoard() {
  const cells = state.size * state.size;
  const board = Array(cells).fill(false);
  const count = Math.min(cells - 2, Math.floor(cells * 0.42) + Math.floor(state.round / 2));
  const used = new Set();

  while (used.size < count) {
    used.add(Math.floor(random() * cells));
  }

  used.forEach((index) => {
    board[index] = true;
  });

  return board;
}

function makeTargetFrom(board, scramble) {
  let target = [...board];

  for (let step = 0; step < scramble; step += 1) {
    if (random() < 0.5) {
      target = shiftRow(target, Math.floor(random() * state.size));
    } else {
      target = shiftColumn(target, Math.floor(random() * state.size));
    }
  }

  return target;
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.size = sizeFor(round);
  state.seed = (20260530 + round * 239) >>> 0;
  state.phase = "running";
  overlay.classList.add("hidden");
  startPuzzle();
}

function startPuzzle() {
  const scramble = Math.min(12, 4 + state.round);
  state.moves = 0;
  state.initial = makeInitialBoard();
  state.current = [...state.initial];
  state.target = makeTargetFrom(state.initial, scramble);
  state.limit = limitFor(state.round, scramble);
  messageLine.textContent = `도킹 ${state.score + 1}/${state.goal}: 행과 열을 밀어 목표 실루엣을 맞추세요.`;
  render();
}

function completePuzzle() {
  state.score += 1;

  if (state.score >= state.goal) {
    state.phase = "cleared";
    render();
    overlayTitle.textContent = `라운드 ${state.round} 완성`;
    overlayText.textContent = "다음 라운드는 격자가 커지거나 이동 여유가 줄어듭니다.";
    startButton.textContent = `라운드 ${state.round + 1} 시작`;
    messageLine.textContent = `라운드 ${state.round} 완료. 곧 다음 라운드로 이동합니다.`;
    overlay.classList.remove("hidden");
    state.nextTimer = setTimeout(() => startRun(state.round + 1), 1000);
    return;
  }

  messageLine.textContent = "도킹 성공. 다음 실루엣을 불러옵니다.";
  state.nextTimer = setTimeout(startPuzzle, 540);
}

function failRun(reason) {
  state.phase = "failed";
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = "도킹 실패";
  overlayText.textContent = `${reason} 라운드 1부터 다시 시작합니다.`;
  startButton.textContent = "라운드 1 다시 시작";
  messageLine.textContent = "실패했습니다. 라운드가 1로 초기화됩니다.";
  overlay.classList.remove("hidden");
}

function applyMove(type, index) {
  if (state.phase !== "running") return;

  state.current = type === "row" ? shiftRow(state.current, index) : shiftColumn(state.current, index);
  state.moves += 1;

  if (isSolved()) {
    completePuzzle();
    return;
  }

  if (state.moves >= state.limit) {
    failRun("이동 제한을 모두 사용했습니다.");
    return;
  }

  messageLine.textContent = `불일치 ${mismatchCount()}칸. 남은 이동 ${state.limit - state.moves}회.`;
  render();
}

function testPuzzle() {
  if (state.phase !== "running") return;

  if (isSolved()) {
    completePuzzle();
    return;
  }

  state.moves += 1;

  if (state.moves >= state.limit) {
    failRun("검사까지 포함해 이동 제한을 넘었습니다.");
    return;
  }

  messageLine.textContent = `아직 ${mismatchCount()}칸이 다릅니다. 검사는 이동 1회로 계산됩니다.`;
  render();
}

function resetPuzzle() {
  if (state.phase === "idle") {
    startRun(1);
    return;
  }

  if (state.phase !== "running") return;

  state.current = [...state.initial];
  state.moves = 0;
  messageLine.textContent = "현재 도킹판을 처음 상태로 되돌렸습니다.";
  render();
}

function renderControls() {
  rowControls.style.setProperty("--size", String(state.size));
  columnControls.style.setProperty("--size", String(state.size));
  rowControls.innerHTML = "";
  columnControls.innerHTML = "";

  for (let index = 0; index < state.size; index += 1) {
    const columnButton = document.createElement("button");
    columnButton.type = "button";
    columnButton.className = "shift-button";
    columnButton.textContent = "↓";
    columnButton.setAttribute("aria-label", `${index + 1}열 아래로 밀기`);
    columnButton.addEventListener("click", () => applyMove("column", index));
    columnControls.appendChild(columnButton);

    const rowButton = document.createElement("button");
    rowButton.type = "button";
    rowButton.className = "shift-button";
    rowButton.textContent = "→";
    rowButton.setAttribute("aria-label", `${index + 1}행 오른쪽으로 밀기`);
    rowButton.addEventListener("click", () => applyMove("row", index));
    rowControls.appendChild(rowButton);
  }
}

function renderGrid() {
  gridEl.style.setProperty("--size", String(state.size));
  gridEl.innerHTML = "";

  state.current.forEach((value, index) => {
    const target = state.target[index];
    const cell = document.createElement("div");
    cell.className = `cell${value ? " current" : ""}${target ? " target" : ""}${value === target ? " match" : ""}`;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `${index + 1}번 칸 현재 ${value ? "있음" : "없음"}, 목표 ${target ? "있음" : "없음"}`);
    gridEl.appendChild(cell);
  });
}

function render() {
  renderControls();
  renderGrid();
  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  moveValue.textContent = `${state.moves}/${state.limit}`;
  missValue.textContent = String(mismatchCount());
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }

  startRun(1);
});

testButton.addEventListener("click", testPuzzle);
resetButton.addEventListener("click", resetPuzzle);

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const rowIndex = Number(key) - 1;
  const columnIndex = "qwerty".indexOf(key);

  if (rowIndex >= 0 && rowIndex < state.size) {
    event.preventDefault();
    applyMove("row", rowIndex);
    return;
  }

  if (columnIndex >= 0 && columnIndex < state.size) {
    event.preventDefault();
    applyMove("column", columnIndex);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    testPuzzle();
  }
});

render();
