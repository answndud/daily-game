const padGrid = document.querySelector("#padGrid");
const roundValue = document.querySelector("#roundValue");
const scoreValue = document.querySelector("#scoreValue");
const targetValue = document.querySelector("#targetValue");
const faultValue = document.querySelector("#faultValue");
const stepValue = document.querySelector("#stepValue");
const lengthValue = document.querySelector("#lengthValue");
const messageLine = document.querySelector("#messageLine");
const overlay = document.querySelector("#overlay");
const overlayLabel = document.querySelector("#overlayLabel");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  target: 4,
  faults: 0,
  sequence: [],
  inputIndex: 0,
  showToken: 0,
  nextRoundTimer: 0
};

const pads = Array.from({ length: 9 }, (_, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pad";
  button.dataset.index = String(index);
  button.textContent = String(index + 1);
  button.setAttribute("aria-label", `${index + 1}번 패드`);
  padGrid.appendChild(button);
  return button;
});

function targetFor(round) {
  return Math.min(8, 3 + round);
}

function sequenceLengthFor(round) {
  return Math.min(8, 2 + round);
}

function flashDelayFor(round) {
  return Math.max(230, 590 - round * 42);
}

function flashOnFor(round) {
  return Math.max(140, 310 - round * 18);
}

function startRound(round = 1) {
  state.phase = "showing";
  state.round = round;
  state.score = 0;
  state.target = targetFor(round);
  state.faults = 0;
  state.inputIndex = 0;
  state.nextRoundTimer = 0;
  hideOverlay();
  setMessage(`라운드 ${round}: 빛 순서를 기억하세요.`);
  createSequence();
  updateHud();
  showSequence();
}

function createSequence() {
  const length = sequenceLengthFor(state.round);
  const sequence = [];
  let previous = -1;
  while (sequence.length < length) {
    const next = Math.floor(Math.random() * pads.length);
    if (next !== previous) {
      sequence.push(next);
      previous = next;
    }
  }
  state.sequence = sequence;
  state.inputIndex = 0;
}

function showSequence() {
  const token = state.showToken + 1;
  state.showToken = token;
  state.phase = "showing";
  clearPadStates();
  setPadsDisabled(true);
  setMessage("표시 중입니다. 순서를 기억하세요.");

  const delay = flashDelayFor(state.round);
  const onTime = flashOnFor(state.round);
  state.sequence.forEach((padIndex, order) => {
    window.setTimeout(() => {
      if (state.showToken !== token || state.phase !== "showing") return;
      lightPad(padIndex, "is-lit");
      window.setTimeout(() => {
        if (state.showToken !== token) return;
        pads[padIndex].classList.remove("is-lit");
      }, onTime);
    }, delay * order);
  });

  window.setTimeout(() => {
    if (state.showToken !== token || state.phase !== "showing") return;
    state.phase = "input";
    state.inputIndex = 0;
    setPadsDisabled(false);
    setMessage("이제 같은 순서로 탭하세요.");
    updateHud();
  }, delay * state.sequence.length + 120);
}

function handlePad(index) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  if (state.phase !== "input") return;

  const expected = state.sequence[state.inputIndex];
  if (index === expected) {
    lightPad(index, "is-good");
    state.inputIndex += 1;
    if (state.inputIndex >= state.sequence.length) {
      completeSignal();
    } else {
      setMessage(`${state.inputIndex + 1}번째 신호를 입력하세요.`);
    }
  } else {
    lightPad(index, "is-bad");
    registerFault();
  }
  updateHud();
}

function completeSignal() {
  state.score += 1;
  setPadsDisabled(true);
  if (state.score >= state.target) {
    clearRound();
    return;
  }
  setMessage(`신호 복원. ${state.target - state.score}개 더 필요합니다.`);
  window.setTimeout(() => {
    if (state.phase === "input") {
      createSequence();
      showSequence();
    }
  }, 520);
}

function registerFault() {
  state.faults += 1;
  setPadsDisabled(true);
  if (state.faults >= 3) {
    failRun();
    return;
  }
  setMessage(`순서 오류 ${state.faults}/3. 새 신호를 다시 보여 줍니다.`);
  window.setTimeout(() => {
    if (state.phase === "input") {
      createSequence();
      showSequence();
    }
  }, 650);
}

function clearRound() {
  state.phase = "cleared";
  state.nextRoundTimer = window.setTimeout(() => startRound(state.round + 1), 950);
  setPadsDisabled(true);
  showOverlay("통과", `라운드 ${state.round + 1} 준비`, "다음 라운드는 시퀀스가 길어지고 표시 속도가 빨라집니다. 곧 자동으로 진행됩니다.", "즉시 진행");
  setMessage(`라운드 ${state.round} 완료. 난이도를 올립니다.`);
}

function failRun() {
  state.phase = "failed";
  state.showToken += 1;
  setPadsDisabled(false);
  showOverlay("실패", "라운드 1로 복귀", "오류가 한계에 도달했습니다. 다시 시작하면 라운드 1부터 진행합니다.", "라운드 1 시작");
  setMessage("실패했습니다. 라운드 1부터 다시 시작하세요.");
}

function lightPad(index, className) {
  pads[index].classList.add(className);
  window.setTimeout(() => pads[index].classList.remove(className), 220);
}

function clearPadStates() {
  pads.forEach((pad) => pad.classList.remove("is-lit", "is-good", "is-bad"));
}

function setPadsDisabled(disabled) {
  pads.forEach((pad) => {
    pad.disabled = disabled;
  });
}

function showOverlay(label, title, text, buttonText) {
  overlay.hidden = false;
  overlayLabel.textContent = label;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
}

function hideOverlay() {
  overlay.hidden = true;
}

function setMessage(text) {
  messageLine.textContent = text;
}

function updateHud() {
  roundValue.textContent = state.round;
  scoreValue.textContent = state.score;
  targetValue.textContent = state.target;
  faultValue.textContent = state.faults;
  stepValue.textContent = state.phase === "input" ? state.inputIndex : 0;
  lengthValue.textContent = state.sequence.length || sequenceLengthFor(state.round);
}

function restartAtRoundOne() {
  if (state.nextRoundTimer) {
    window.clearTimeout(state.nextRoundTimer);
    state.nextRoundTimer = 0;
  }
  state.showToken += 1;
  startRound(1);
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    if (state.nextRoundTimer) window.clearTimeout(state.nextRoundTimer);
    startRound(state.round + 1);
  } else {
    restartAtRoundOne();
  }
});

resetButton.addEventListener("click", restartAtRoundOne);

pads.forEach((pad, index) => {
  pad.addEventListener("click", () => handlePad(index));
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    if (state.phase === "cleared") startRound(state.round + 1);
    else if (state.phase !== "input" && state.phase !== "showing") restartAtRoundOne();
  }
  if (event.key.toLowerCase() === "r") {
    restartAtRoundOne();
  }
  const index = Number(event.key) - 1;
  if (index >= 0 && index < 9) {
    handlePad(index);
  }
});

setPadsDisabled(false);
showOverlay("시작", "빛 순서를 기억하세요", "패드가 보여 준 순서를 같은 순서로 탭하면 신호가 복원됩니다. 오류 세 번이면 라운드 1로 돌아갑니다.", "시작");
updateHud();
