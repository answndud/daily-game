"use strict";

const KEY_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "q", "w", "e", "r", "a", "s", "d", "f", "z", "x", "c", "v", "t", "y", "u", "i"];

const dom = {
  round: document.getElementById("roundValue"),
  score: document.getElementById("scoreValue"),
  goal: document.getElementById("goalValue"),
  step: document.getElementById("stepValue"),
  length: document.getElementById("lengthValue"),
  time: document.getElementById("timeValue"),
  grid: document.getElementById("grid"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  start: document.getElementById("startButton"),
  reset: document.getElementById("resetButton"),
};

const state = {
  phase: "idle",
  round: 1,
  size: 4,
  score: 0,
  goal: 4,
  sequence: [],
  inputIndex: 0,
  timeLeft: 8,
  revealTimer: 0,
  tickTimer: 0,
  nextRoundTimer: 0,
  lastWrong: -1,
};

function sizeFor(round) {
  return Math.min(5, 4 + Math.floor((round - 1) / 4));
}

function lengthFor(round) {
  return Math.min(6, 3 + Math.floor((round - 1) / 2));
}

function goalFor(round) {
  return 3 + Math.min(5, round);
}

function timeFor(round) {
  return Math.max(5.2, 8.2 - round * 0.22);
}

function startRound(round = 1) {
  clearTimers();
  state.phase = "reveal";
  state.round = round;
  state.size = sizeFor(round);
  state.score = 0;
  state.goal = goalFor(round);
  state.timeLeft = timeFor(round);
  dom.overlay.classList.add("hidden");
  newSequence();
  setMessage(`라운드 ${round}: 번호 순서를 외우세요.`);
  render();
}

function newSequence() {
  state.phase = "reveal";
  state.inputIndex = 0;
  state.lastWrong = -1;
  state.timeLeft = timeFor(state.round);
  const total = state.size * state.size;
  const chosen = new Set();
  while (chosen.size < lengthFor(state.round)) {
    chosen.add(Math.floor(Math.random() * total));
  }
  state.sequence = [...chosen];
  clearTimers();
  state.revealTimer = window.setTimeout(() => {
    state.phase = "input";
    setMessage("서랍이 닫혔습니다. 같은 순서로 타일을 봉인하세요.");
    state.tickTimer = window.setInterval(tick, 100);
    render();
  }, Math.max(1100, 2200 - state.round * 120));
  render();
}

function clearTimers() {
  if (state.revealTimer) {
    window.clearTimeout(state.revealTimer);
    state.revealTimer = 0;
  }
  if (state.tickTimer) {
    window.clearInterval(state.tickTimer);
    state.tickTimer = 0;
  }
  if (state.nextRoundTimer) {
    window.clearTimeout(state.nextRoundTimer);
    state.nextRoundTimer = 0;
  }
}

function tick() {
  if (state.phase !== "input") {
    return;
  }
  state.timeLeft -= 0.1;
  if (state.timeLeft <= 0) {
    failRun("제한 시간이 끝났습니다.");
    return;
  }
  renderHud();
}

function chooseTile(index) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  if (state.phase !== "input") {
    setMessage("아직 열람 단계입니다. 번호 순서를 기억하세요.");
    return;
  }
  const expected = state.sequence[state.inputIndex];
  if (index !== expected) {
    state.lastWrong = index;
    failRun(`${state.inputIndex + 1}번째 봉인 위치가 틀렸습니다.`);
    return;
  }
  state.inputIndex += 1;
  setMessage(`정확합니다. ${state.sequence.length - state.inputIndex}개 남았습니다.`);
  if (state.inputIndex >= state.sequence.length) {
    state.score += 1;
    if (state.score >= state.goal) {
      clearRound();
      return;
    }
    newSequence();
    setMessage(`봉인 성공. 남은 서랍 ${state.goal - state.score}개.`);
    return;
  }
  render();
}

function clearRound() {
  clearTimers();
  state.phase = "cleared";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "봉인 완료";
  dom.overlayTitle.textContent = `라운드 ${state.round} 완료`;
  dom.overlayText.textContent = "다음 라운드는 기억해야 할 순서가 길어지고 열람 시간이 짧아집니다.";
  dom.start.textContent = `라운드 ${state.round + 1}`;
  setMessage(`성공. 곧 라운드 ${state.round + 1}로 이동합니다.`);
  render();
  state.nextRoundTimer = window.setTimeout(() => startRound(state.round + 1), 900);
}

function failRun(reason) {
  clearTimers();
  state.phase = "failed";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "봉인 실패";
  dom.overlayTitle.textContent = "라운드 1로 복귀";
  dom.overlayText.textContent = `${reason} 순서와 위치를 함께 기억해야 합니다.`;
  dom.start.textContent = "라운드 1";
  setMessage("실패하면 진행도가 초기화됩니다. 라운드 1부터 다시 시작하세요.");
  render();
}

function render() {
  renderHud();
  dom.grid.style.setProperty("--size", state.size);
  const total = state.size * state.size;
  const tiles = [];
  for (let index = 0; index < total; index += 1) {
    tiles.push(renderTile(index));
  }
  dom.grid.replaceChildren(...tiles);
}

function renderHud() {
  dom.round.textContent = String(state.round);
  dom.score.textContent = String(state.score);
  dom.goal.textContent = String(state.goal);
  dom.step.textContent = String(state.inputIndex);
  dom.length.textContent = String(state.sequence.length || lengthFor(state.round));
  dom.time.textContent = state.phase === "input" ? state.timeLeft.toFixed(1) : timeFor(state.round).toFixed(1);
}

function renderTile(index) {
  const button = document.createElement("button");
  const revealOrder = state.sequence.indexOf(index);
  const solved = revealOrder >= 0 && revealOrder < state.inputIndex;
  const isReveal = state.phase === "reveal" && revealOrder >= 0;
  button.type = "button";
  button.className = `tile${isReveal ? " reveal" : ""}${solved ? " correct" : ""}${state.lastWrong === index ? " wrong" : ""}`;
  button.setAttribute("role", "gridcell");
  button.setAttribute("aria-label", `${index + 1}번 타일`);
  button.textContent = isReveal ? String(revealOrder + 1) : solved ? "✓" : "";
  button.addEventListener("click", () => chooseTile(index));
  return button;
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

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "enter" || key === " ") {
    event.preventDefault();
    if (state.phase !== "input") {
      handleStart();
    }
    return;
  }
  if (key === "escape") {
    startRound(1);
    return;
  }
  const index = KEY_ORDER.indexOf(key);
  if (index >= 0 && index < state.size * state.size) {
    chooseTile(index);
  }
});

render();
