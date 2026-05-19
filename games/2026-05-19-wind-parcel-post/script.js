"use strict";

const dom = {
  round: document.getElementById("roundValue"),
  delivered: document.getElementById("deliveredValue"),
  parcel: document.getElementById("parcelValue"),
  move: document.getElementById("moveValue"),
  limit: document.getElementById("limitValue"),
  size: document.getElementById("sizeValue"),
  board: document.getElementById("board"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  start: document.getElementById("startButton"),
  reset: document.getElementById("resetButton"),
  windButtons: [...document.querySelectorAll("[data-dir]")],
};

const dirs = {
  up: { x: 0, y: -1, label: "위" },
  down: { x: 0, y: 1, label: "아래" },
  left: { x: -1, y: 0, label: "왼쪽" },
  right: { x: 1, y: 0, label: "오른쪽" },
};

const state = {
  phase: "idle",
  round: 1,
  size: 5,
  moves: 0,
  limit: 8,
  parcels: [],
  goals: [],
  walls: new Set(),
  pits: new Set(),
  dragStart: null,
};

function sizeFor(round) {
  return Math.min(7, 5 + Math.floor((round - 1) / 3));
}

function parcelCountFor(round) {
  return Math.min(4, 2 + Math.floor((round - 1) / 3));
}

function limitFor(round) {
  return Math.max(7, sizeFor(round) + 3 + Math.floor(round / 3));
}

function startRound(round = 1) {
  state.phase = "running";
  state.round = round;
  state.size = sizeFor(round);
  state.moves = 0;
  state.limit = limitFor(round);
  buildLevel(round);
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 바람 방향을 골라 모든 소포를 배달하세요.`);
  render();
}

function buildLevel(round) {
  const count = parcelCountFor(round);
  state.parcels = [];
  state.goals = [];
  state.walls = new Set();
  state.pits = new Set();
  for (let index = 0; index < count; index += 1) {
    const y = Math.floor((index + 1) * state.size / (count + 1));
    const start = { x: 0, y, id: index + 1 };
    const goal = { x: state.size - 1, y, id: index + 1 };
    state.parcels.push({ ...start });
    state.goals.push(goal);
  }
  const reserved = new Set([...state.parcels, ...state.goals].map(keyOf));
  const wallTarget = Math.min(6, Math.floor(round / 2) + 1);
  for (let i = 0; i < wallTarget; i += 1) {
    const cell = {
      x: 1 + ((round + i * 2) % Math.max(1, state.size - 2)),
      y: (round * 2 + i * 3) % state.size,
    };
    if (!reserved.has(keyOf(cell)) && !state.parcels.some((parcel) => parcel.y === cell.y)) {
      state.walls.add(keyOf(cell));
    }
  }
  const pitTarget = Math.min(4, Math.floor(round / 3));
  for (let i = 0; i < pitTarget; i += 1) {
    const cell = {
      x: 1 + ((round * 3 + i) % Math.max(1, state.size - 2)),
      y: (round + i * 4) % state.size,
    };
    const key = keyOf(cell);
    if (!reserved.has(key) && !state.walls.has(key) && !state.parcels.some((parcel) => parcel.y === cell.y)) {
      state.pits.add(key);
    }
  }
}

function pushWind(dirName) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  const dir = dirs[dirName];
  if (!dir) {
    return;
  }
  state.moves += 1;
  const proposed = state.parcels.map((parcel) => {
    const next = { ...parcel, x: parcel.x + dir.x, y: parcel.y + dir.y };
    if (!inside(next) || state.walls.has(keyOf(next))) {
      return parcel;
    }
    return next;
  });
  const counts = new Map();
  for (const parcel of proposed) {
    counts.set(keyOf(parcel), (counts.get(keyOf(parcel)) || 0) + 1);
  }
  const nextParcels = proposed.map((parcel, index) => {
    if ((counts.get(keyOf(parcel)) || 0) > 1) {
      return state.parcels[index];
    }
    return parcel;
  });
  state.parcels = nextParcels;
  const fallen = state.parcels.find((parcel) => state.pits.has(keyOf(parcel)));
  if (fallen) {
    failRun(`${fallen.id}번 소포가 구덩이에 빠졌습니다.`);
    return;
  }
  if (deliveredCount() === state.parcels.length) {
    clearRound();
    return;
  }
  if (state.moves >= state.limit) {
    failRun("이동 제한을 모두 사용했습니다.");
    return;
  }
  setMessage(`${dir.label} 바람. 남은 이동 ${state.limit - state.moves}번.`);
  render();
}

function clearRound() {
  state.phase = "cleared";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "배달 완료";
  dom.overlayTitle.textContent = `라운드 ${state.round} 완료`;
  dom.overlayText.textContent = "다음 라운드는 격자와 장애물이 늘고 계획해야 할 소포가 많아집니다.";
  dom.start.textContent = `라운드 ${state.round + 1}`;
  setMessage(`성공. 곧 라운드 ${state.round + 1}로 이동합니다.`);
  render();
  window.setTimeout(() => {
    if (state.phase === "cleared") {
      startRound(state.round + 1);
    }
  }, 900);
}

function failRun(reason) {
  state.phase = "failed";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "배달 실패";
  dom.overlayTitle.textContent = "라운드 1로 복귀";
  dom.overlayText.textContent = `${reason} 벽을 이용해 일부 소포를 멈추는 순서를 다시 계획하세요.`;
  dom.start.textContent = "라운드 1";
  setMessage("실패하면 진행도가 초기화됩니다. 라운드 1부터 다시 시작하세요.");
  render();
}

function deliveredCount() {
  return state.parcels.filter((parcel) => {
    const goal = state.goals.find((item) => item.id === parcel.id);
    return goal && goal.x === parcel.x && goal.y === parcel.y;
  }).length;
}

function render() {
  dom.round.textContent = String(state.round);
  dom.delivered.textContent = String(deliveredCount());
  dom.parcel.textContent = String(state.parcels.length || parcelCountFor(state.round));
  dom.move.textContent = String(state.moves);
  dom.limit.textContent = String(state.limit);
  dom.size.textContent = `${state.size}x${state.size}`;
  dom.board.style.setProperty("--size", state.size);
  const cells = [];
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      cells.push(renderCell(x, y));
    }
  }
  dom.board.replaceChildren(...cells);
}

function renderCell(x, y) {
  const cell = document.createElement("div");
  const key = keyOf({ x, y });
  const goal = state.goals.find((item) => item.x === x && item.y === y);
  const parcel = state.parcels.find((item) => item.x === x && item.y === y);
  cell.className = `cell${state.walls.has(key) ? " wall" : ""}${state.pits.has(key) ? " pit" : ""}${goal ? " goal" : ""}`;
  cell.setAttribute("role", "gridcell");
  if (goal) {
    cell.dataset.goal = String(goal.id);
  }
  if (parcel) {
    const node = document.createElement("span");
    node.className = `parcel${goal && goal.id === parcel.id ? " delivered" : ""}`;
    node.textContent = String(parcel.id);
    cell.appendChild(node);
  }
  return cell;
}

function inside(pos) {
  return pos.x >= 0 && pos.y >= 0 && pos.x < state.size && pos.y < state.size;
}

function keyOf(pos) {
  return `${pos.x},${pos.y}`;
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
for (const button of dom.windButtons) {
  button.addEventListener("click", () => pushWind(button.dataset.dir));
}

dom.board.addEventListener("pointerdown", (event) => {
  state.dragStart = { x: event.clientX, y: event.clientY };
});

dom.board.addEventListener("pointerup", (event) => {
  if (!state.dragStart) {
    return;
  }
  const dx = event.clientX - state.dragStart.x;
  const dy = event.clientY - state.dragStart.y;
  state.dragStart = null;
  if (Math.hypot(dx, dy) < 24) {
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    pushWind(dx > 0 ? "right" : "left");
  } else {
    pushWind(dy > 0 ? "down" : "up");
  }
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "enter" || key === " ") {
    event.preventDefault();
    if (state.phase !== "running") {
      handleStart();
    }
    return;
  }
  if (key === "escape") {
    startRound(1);
    return;
  }
  const map = { arrowup: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", a: "left", arrowright: "right", d: "right" };
  if (map[key]) {
    pushWind(map[key]);
  }
});

render();
