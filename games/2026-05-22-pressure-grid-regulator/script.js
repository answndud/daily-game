const boardEl = document.getElementById("board");
const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const moveValue = document.getElementById("moveValue");
const sizeValue = document.getElementById("sizeValue");
const messageLine = document.getElementById("messageLine");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const checkButton = document.getElementById("checkButton");
const clearButton = document.getElementById("clearButton");

const keyMap = [
  "1", "2", "3", "4", "5", "6",
  "q", "w", "e", "r", "t", "y",
  "a", "s", "d", "f", "g", "h",
  "z", "x", "c", "v", "b", "n",
  "u", "i", "o", "j", "k", "l",
  "m", ",", "."
];

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  size: 4,
  moves: 0,
  limit: 9,
  current: [],
  target: [],
  seed: 20260522,
  nextTimer: 0
};

function nextRandom() {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function sizeForRound(round) {
  return Math.min(6, 4 + Math.floor((round - 1) / 3));
}

function goalForRound(round) {
  return Math.min(7, 2 + round);
}

function solutionCountForRound(round, size) {
  return Math.min(size * size - 2, 4 + round + Math.floor(size / 2));
}

function boardLimitFor(round, size, solutionCount) {
  const margin = Math.max(2, 6 - Math.floor(round / 3));
  return Math.max(solutionCount + 1, solutionCount + margin - Math.floor(size / 5));
}

function indexOf(row, col) {
  return row * state.size + col;
}

function neighbors(index) {
  const row = Math.floor(index / state.size);
  const col = index % state.size;
  const cells = [index];

  if (row > 0) cells.push(indexOf(row - 1, col));
  if (row < state.size - 1) cells.push(indexOf(row + 1, col));
  if (col > 0) cells.push(indexOf(row, col - 1));
  if (col < state.size - 1) cells.push(indexOf(row, col + 1));

  return cells;
}

function pulse(grid, index) {
  neighbors(index).forEach((cellIndex) => {
    grid[cellIndex] = (grid[cellIndex] + 1) % 3;
  });
}

function isSolved() {
  return state.current.every((value, index) => value === state.target[index]);
}

function buildTarget(solutionCount) {
  state.target = Array(state.size * state.size).fill(0);
  const used = new Set();

  while (used.size < solutionCount) {
    const candidate = Math.floor(nextRandom() * state.target.length);
    const repeats = 1 + Math.floor(nextRandom() * 2);
    used.add(candidate);

    for (let count = 0; count < repeats; count += 1) {
      pulse(state.target, candidate);
    }
  }

  if (state.target.every((value) => value === 0)) {
    pulse(state.target, Math.floor(state.target.length / 2));
  }
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  state.round = round;
  state.score = 0;
  state.goal = goalForRound(round);
  state.size = sizeForRound(round);
  state.phase = "running";
  state.seed = (20260522 + round * 97) >>> 0;
  overlay.classList.add("hidden");
  startBoard();
}

function startBoard() {
  const solutionCount = solutionCountForRound(state.round, state.size);
  state.current = Array(state.size * state.size).fill(0);
  state.moves = 0;
  state.limit = boardLimitFor(state.round, state.size, solutionCount);
  buildTarget(solutionCount);
  messageLine.textContent = `보정 ${state.score + 1}/${state.goal}: 십자 펄스를 조합해 목표 압력을 맞추세요.`;
  render();
}

function completeBoard() {
  state.score += 1;

  if (state.score >= state.goal) {
    state.phase = "cleared";
    render();
    overlayTitle.textContent = `라운드 ${state.round} 완성`;
    overlayText.textContent = "다음 라운드는 더 큰 격자이거나 조작 여유가 줄어듭니다.";
    startButton.textContent = `라운드 ${state.round + 1} 시작`;
    messageLine.textContent = `라운드 ${state.round} 완료. 곧 다음 라운드로 이동합니다.`;
    overlay.classList.remove("hidden");
    state.nextTimer = setTimeout(() => startRun(state.round + 1), 1100);
    return;
  }

  messageLine.textContent = `보정 성공. 다음 압력판을 불러옵니다.`;
  state.nextTimer = setTimeout(startBoard, 520);
}

function failRun(reason) {
  state.phase = "failed";
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = "압력 보정 실패";
  overlayText.textContent = `${reason} 라운드 1부터 다시 시작합니다.`;
  startButton.textContent = "라운드 1 다시 시작";
  messageLine.textContent = "실패했습니다. 라운드가 1로 초기화됩니다.";
  overlay.classList.remove("hidden");
}

function handleCell(index) {
  if (state.phase !== "running") return;

  pulse(state.current, index);
  state.moves += 1;

  if (isSolved()) {
    completeBoard();
    return;
  }

  if (state.moves >= state.limit) {
    failRun("제한 조작을 모두 사용했습니다.");
    return;
  }

  messageLine.textContent = `남은 조작 ${state.limit - state.moves}회. 목표 숫자가 작은 표식으로 표시됩니다.`;
  render();
}

function checkBoard() {
  if (state.phase !== "running") return;

  if (isSolved()) {
    completeBoard();
    return;
  }

  state.moves += 1;

  if (state.moves >= state.limit) {
    failRun("검사까지 포함해 제한 조작을 넘었습니다.");
    return;
  }

  messageLine.textContent = `아직 맞지 않습니다. 검사도 조작 1회로 계산됩니다.`;
  render();
}

function resetCurrentBoard() {
  if (state.phase === "idle") {
    startRun(1);
    return;
  }

  if (state.phase === "running") {
    state.current = Array(state.size * state.size).fill(0);
    state.moves = 0;
    messageLine.textContent = "현재 압력판을 처음 상태로 되돌렸습니다.";
    render();
  }
}

function renderCell(value, target, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `cell level-${value}${value === target ? " match" : ""}`;
  button.setAttribute("role", "gridcell");
  button.setAttribute("aria-label", `${index + 1}번 칸 현재 ${value}, 목표 ${target}`);
  button.dataset.index = String(index);
  button.innerHTML = `<span class="current">${value}</span><span class="target">목표 ${target}</span>`;
  button.addEventListener("click", () => handleCell(index));
  return button;
}

function render() {
  boardEl.style.setProperty("--size", String(state.size));
  boardEl.innerHTML = "";

  state.current.forEach((value, index) => {
    boardEl.appendChild(renderCell(value, state.target[index], index));
  });

  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  moveValue.textContent = `${state.moves}/${state.limit}`;
  sizeValue.textContent = `${state.size}x${state.size}`;
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }

  startRun(1);
});

checkButton.addEventListener("click", checkBoard);
clearButton.addEventListener("click", resetCurrentBoard);

document.addEventListener("keydown", (event) => {
  const keyIndex = keyMap.indexOf(event.key.toLowerCase());

  if (keyIndex >= 0 && keyIndex < state.current.length) {
    event.preventDefault();
    handleCell(keyIndex);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    checkBoard();
  }
});

render();
