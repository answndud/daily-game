const boardEl = document.querySelector("#board");
const roundEl = document.querySelector("#round");
const stageEl = document.querySelector("#stage");
const movesEl = document.querySelector("#moves");
const statusEl = document.querySelector("#status");
const restartBtn = document.querySelector("#restart");
const heatBtn = document.querySelector("#heat-mode");
const coolBtn = document.querySelector("#cool-mode");

const state = {
  round: 1,
  stage: 1,
  mode: "heat",
  size: 4,
  movesLeft: 8,
  stagesNeeded: 2,
  grid: [],
  targets: []
};

function roundConfig(round) {
  const size = Math.min(6, 4 + Math.floor((round - 1) / 2));
  return {
    size,
    stagesNeeded: Math.min(4, 2 + Math.floor((round - 1) / 2)),
    moves: Math.max(6, 9 - Math.floor(round / 2)),
    targetCount: Math.min(size, 3 + Math.floor(round / 2)),
    pulse: Math.max(8, 13 - round),
    drift: 1 + Math.floor(round / 3)
  };
}

function seededValue(index, salt) {
  const raw = Math.sin((index + 1) * 41.73 + salt * 19.91) * 10000;
  return raw - Math.floor(raw);
}

function startExperiment(keepStage = false) {
  const config = roundConfig(state.round);
  state.size = config.size;
  state.movesLeft = config.moves;
  state.stagesNeeded = config.stagesNeeded;
  state.grid = [];
  state.targets = [];

  const salt = state.round * 13 + state.stage * 7;
  for (let i = 0; i < state.size * state.size; i += 1) {
    const base = 18 + Math.round(seededValue(i, salt) * 18);
    state.grid.push(base);
  }

  const picked = new Set();
  let cursor = 0;
  while (picked.size < config.targetCount) {
    const index = Math.floor(seededValue(cursor + 5, salt + cursor) * state.grid.length);
    picked.add(index);
    cursor += 1;
  }
  state.targets = [...picked];

  if (!keepStage) {
    state.stage = 1;
  }

  render();
  setStatus("목표 돔은 22~28도에 들어와야 합니다. 펄스마다 온도가 주변으로 확산됩니다.");
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setMode(mode) {
  state.mode = mode;
  heatBtn.classList.toggle("active", mode === "heat");
  coolBtn.classList.toggle("active", mode === "cool");
}

function neighbors(index) {
  const row = Math.floor(index / state.size);
  const col = index % state.size;
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1]
  ].filter(([r, c]) => r >= 0 && c >= 0 && r < state.size && c < state.size)
    .map(([r, c]) => r * state.size + c);
}

function diffuse() {
  const next = state.grid.map((value, index) => {
    const around = neighbors(index);
    const average = around.reduce((sum, nextIndex) => sum + state.grid[nextIndex], value) / (around.length + 1);
    const config = roundConfig(state.round);
    const drift = seededValue(index, state.round + state.stage + state.movesLeft) > 0.52 ? config.drift : -config.drift;
    return Math.round(value * 0.62 + average * 0.34 + drift);
  });
  state.grid = next;
}

function applyPulse(index) {
  if (state.movesLeft <= 0) {
    return;
  }

  const config = roundConfig(state.round);
  const amount = state.mode === "heat" ? config.pulse : -config.pulse;
  state.grid[index] += amount;
  neighbors(index).forEach((nextIndex) => {
    state.grid[nextIndex] += Math.round(amount * 0.32);
  });

  state.movesLeft -= 1;
  diffuse();
  evaluate();
  render();
}

function targetStable() {
  return state.targets.every((index) => state.grid[index] >= 22 && state.grid[index] <= 28);
}

function hasEmergency() {
  return state.grid.some((value) => value <= 5 || value >= 45);
}

function evaluate() {
  if (hasEmergency()) {
    state.round = 1;
    state.stage = 1;
    startExperiment(true);
    setStatus("기후실이 안전 범위를 벗어났습니다. 실패 처리되어 라운드 1로 돌아갑니다.");
    return;
  }

  if (targetStable()) {
    if (state.stage >= state.stagesNeeded) {
      state.round += 1;
      state.stage = 1;
      startExperiment(true);
      setStatus(`라운드 클리어. 확산 압박이 커진 라운드 ${state.round}로 바로 이동했습니다.`);
      return;
    }

    state.stage += 1;
    startExperiment(true);
    setStatus("실험 성공. 다음 목표 돔으로 넘어갑니다.");
    return;
  }

  if (state.movesLeft <= 0) {
    state.round = 1;
    state.stage = 1;
    startExperiment(true);
    setStatus("펄스를 모두 썼지만 목표 온도를 맞추지 못했습니다. 라운드 1로 돌아갑니다.");
  }
}

function tempColor(value) {
  const clamped = Math.max(6, Math.min(44, value));
  const ratio = (clamped - 6) / 38;
  const hue = 205 - ratio * 185;
  const saturation = 30 + Math.abs(ratio - 0.5) * 42;
  const light = 80 - Math.abs(ratio - 0.5) * 18;
  return `hsl(${hue} ${saturation}% ${light}%)`;
}

function render() {
  roundEl.textContent = state.round;
  stageEl.textContent = `${state.stage}/${state.stagesNeeded}`;
  movesEl.textContent = state.movesLeft;
  boardEl.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
  boardEl.innerHTML = "";

  state.grid.forEach((value, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.style.background = tempColor(value);
    button.setAttribute("aria-label", `${index + 1}번 셀, ${value}도`);
    if (state.targets.includes(index)) {
      button.classList.add("target");
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "돔";
      button.appendChild(badge);
    }
    if (value <= 8 || value >= 42) {
      button.classList.add("danger");
    }

    const temp = document.createElement("span");
    temp.className = "temp";
    temp.textContent = `${value}°`;
    button.appendChild(temp);
    button.addEventListener("click", () => applyPulse(index));
    boardEl.appendChild(button);
  });
}

heatBtn.addEventListener("click", () => setMode("heat"));
coolBtn.addEventListener("click", () => setMode("cool"));
restartBtn.addEventListener("click", () => {
  state.round = 1;
  state.stage = 1;
  startExperiment(true);
  setStatus("라운드 1부터 다시 시작합니다.");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "h" || event.key === "H") {
    setMode("heat");
  }
  if (event.key === "c" || event.key === "C") {
    setMode("cool");
  }
});

startExperiment();
