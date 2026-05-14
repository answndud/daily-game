"use strict";

const KEY_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "q", "w", "e", "r", "a", "s", "d", "f", "z", "x", "c", "v"];

const dom = {
  board: document.getElementById("gridBoard"),
  round: document.getElementById("roundValue"),
  probe: document.getElementById("probeValue"),
  probeLimit: document.getElementById("probeLimitValue"),
  size: document.getElementById("sizeValue"),
  mode: document.getElementById("modeValue"),
  sealButton: document.getElementById("sealButton"),
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
  size: 5,
  leak: { x: 0, y: 0 },
  probes: [],
  probeLimit: 6,
  sealMode: false,
  nextRoundTimer: 0,
};

function sizeFor(round) {
  return Math.min(8, 5 + Math.floor((round - 1) / 2));
}

function probeLimitFor(round, size) {
  return Math.max(4, size + 2 - Math.floor(round / 3));
}

function startRound(round = 1) {
  stopTimers();
  state.phase = "running";
  state.round = round;
  state.size = sizeFor(round);
  state.probeLimit = probeLimitFor(round, state.size);
  state.probes = [];
  state.sealMode = false;
  state.leak = {
    x: Math.floor(Math.random() * state.size),
    y: Math.floor(Math.random() * state.size),
  };
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: ${state.probeLimit}번 안에 누수 좌표를 좁히세요.`);
  render();
}

function stopTimers() {
  if (state.nextRoundTimer) {
    window.clearTimeout(state.nextRoundTimer);
    state.nextRoundTimer = 0;
  }
}

function chooseCell(index) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }

  const x = index % state.size;
  const y = Math.floor(index / state.size);
  if (x >= state.size || y >= state.size) {
    return;
  }

  if (state.sealMode) {
    sealCell(x, y);
    return;
  }

  if (state.probes.some((probe) => probe.x === x && probe.y === y)) {
    setMessage("이미 탐침한 칸입니다. 다른 위치의 단서를 비교하세요.");
    return;
  }

  const distance = manhattan({ x, y }, state.leak);
  state.probes.push({ x, y, distance });
  if (distance === 0) {
    clearRound();
    return;
  }

  if (state.probes.length >= state.probeLimit) {
    failRun("탐침을 모두 사용했습니다");
    return;
  }

  const candidates = countCandidates();
  setMessage(`거리 ${distance}. 가능한 좌표는 약 ${candidates}개입니다.`);
  render();
}

function sealCell(x, y) {
  if (x === state.leak.x && y === state.leak.y) {
    clearRound();
    return;
  }
  failRun("오봉인했습니다");
}

function countCandidates() {
  let count = 0;
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      if (state.probes.every((probe) => manhattan(probe, { x, y }) === probe.distance)) {
        count += 1;
      }
    }
  }
  return count;
}

function clearRound() {
  state.phase = "cleared";
  state.sealMode = false;
  render();
  showOverlay(
    "클리어",
    `라운드 ${state.round} 누수 봉인`,
    "다음 라운드는 격자가 커지거나 탐침 여유가 줄어듭니다. 곧 자동으로 시작합니다.",
    "다음 라운드"
  );
  setMessage(`정확한 좌표였습니다. 라운드 ${state.round + 1}로 이동합니다.`);
  state.nextRoundTimer = window.setTimeout(() => startRound(state.round + 1), 900);
}

function failRun(reason) {
  state.phase = "failed";
  state.sealMode = false;
  render();
  showOverlay(
    "실패",
    reason,
    `정답은 ${coordLabel(state.leak.x, state.leak.y)}였습니다. 다시 시작하면 라운드 1부터 시작합니다.`,
    "라운드 1 재시작"
  );
  setMessage(`실패: ${reason}. 라운드 1로 돌아갑니다.`);
}

function render() {
  dom.round.textContent = String(state.round);
  dom.probe.textContent = String(state.probes.length);
  dom.probeLimit.textContent = String(state.probeLimit);
  dom.size.textContent = `${state.size}x${state.size}`;
  dom.mode.textContent = state.sealMode ? "봉인" : "탐침";
  dom.sealButton.textContent = state.sealMode ? "탐침 모드로 전환" : "봉인 모드 켜기";
  dom.sealButton.classList.toggle("seal-on", state.sealMode);

  dom.board.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
  dom.board.innerHTML = "";

  for (let index = 0; index < state.size * state.size; index += 1) {
    const x = index % state.size;
    const y = Math.floor(index / state.size);
    const button = document.createElement("button");
    const probe = state.probes.find((item) => item.x === x && item.y === y);
    button.type = "button";
    button.className = "cell";
    button.dataset.index = String(index);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${coordLabel(x, y)} 칸`);
    button.textContent = coordLabel(x, y);

    if (probe) {
      button.classList.add("probed");
      button.textContent = String(probe.distance);
      button.setAttribute("aria-label", `${coordLabel(x, y)} 칸, 거리 ${probe.distance}`);
    }
    if (state.sealMode && state.phase === "running") {
      button.classList.add("seal-candidate");
    }
    if (state.phase !== "running" && x === state.leak.x && y === state.leak.y) {
      button.classList.add("correct");
      button.textContent = "누수";
    }
    button.addEventListener("click", () => chooseCell(index));
    dom.board.appendChild(button);
  }
}

function toggleSealMode() {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase !== "running") {
    return;
  }
  state.sealMode = !state.sealMode;
  setMessage(state.sealMode ? "봉인할 좌표를 한 칸 선택하세요. 틀리면 라운드 1로 돌아갑니다." : "탐침 모드입니다. 단서가 필요한 칸을 선택하세요.");
  render();
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function coordLabel(x, y) {
  return `${String.fromCharCode(65 + y)}${x + 1}`;
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
dom.sealButton.addEventListener("click", toggleSealMode);

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (state.phase === "idle" || state.phase === "failed" || state.phase === "cleared") {
      handleStart();
    } else {
      toggleSealMode();
    }
    return;
  }
  if (event.key === "Escape") {
    startRound(1);
    return;
  }
  const keyIndex = KEY_ORDER.indexOf(event.key.toLowerCase());
  if (keyIndex >= 0) {
    event.preventDefault();
    chooseCell(keyIndex);
  }
});

render();
