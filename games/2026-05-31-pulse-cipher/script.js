const patternEl = document.getElementById("pattern");
const enteredEl = document.getElementById("entered");
const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const inputValue = document.getElementById("inputValue");
const timeValue = document.getElementById("timeValue");
const hintLine = document.getElementById("hintLine");
const messageLine = document.getElementById("messageLine");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");

const symbols = ["short", "long", "rest"];
const labels = { short: "짧음", long: "김", rest: "쉼" };

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  pattern: [],
  entered: [],
  timeLeft: 20,
  timer: 0,
  seed: 20260531,
  nextTimer: 0
};

function random() {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function goalFor(round) {
  return Math.min(6, 2 + round);
}

function lengthFor(round) {
  return Math.min(10, 4 + Math.floor(round * 0.75));
}

function timeFor(round, length) {
  return Math.max(10, 20 + length - round * 2);
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  clearInterval(state.timer);
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.seed = (20260531 + round * 251) >>> 0;
  state.phase = "running";
  overlay.classList.add("hidden");
  startCipher();
}

function makePattern() {
  const length = lengthFor(state.round);
  const pattern = [];

  for (let index = 0; index < length; index += 1) {
    const allowed = state.round < 3 ? symbols.slice(0, 2) : symbols;
    pattern.push(allowed[Math.floor(random() * allowed.length)]);
  }

  return pattern;
}

function startCipher() {
  clearInterval(state.timer);
  state.pattern = makePattern();
  state.entered = [];
  state.timeLeft = timeFor(state.round, state.pattern.length);
  hintLine.textContent = "전보를 왼쪽부터 입력하세요.";
  messageLine.textContent = `전보 ${state.score + 1}/${state.goal}: 박자 암호를 정확히 해독하세요.`;
  state.timer = setInterval(tick, 1000);
  render();
}

function tick() {
  if (state.phase !== "running") return;

  state.timeLeft -= 1;

  if (state.timeLeft <= 0) {
    failRun("제한 시간이 끝났습니다.");
    return;
  }

  render();
}

function completeCipher() {
  state.score += 1;
  clearInterval(state.timer);

  if (state.score >= state.goal) {
    state.phase = "cleared";
    render();
    overlayTitle.textContent = `라운드 ${state.round} 완성`;
    overlayText.textContent = "다음 라운드는 전보가 길어지고 쉼표가 섞여 더 까다로워집니다.";
    startButton.textContent = `라운드 ${state.round + 1} 시작`;
    messageLine.textContent = `라운드 ${state.round} 완료. 곧 다음 라운드로 이동합니다.`;
    overlay.classList.remove("hidden");
    state.nextTimer = setTimeout(() => startRun(state.round + 1), 1000);
    return;
  }

  messageLine.textContent = "해독 성공. 다음 박자 전보를 불러옵니다.";
  state.nextTimer = setTimeout(startCipher, 520);
}

function failRun(reason) {
  state.phase = "failed";
  clearInterval(state.timer);
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = "해독 실패";
  overlayText.textContent = `${reason} 라운드 1부터 다시 시작합니다.`;
  startButton.textContent = "라운드 1 다시 시작";
  messageLine.textContent = "실패했습니다. 라운드가 1로 초기화됩니다.";
  overlay.classList.remove("hidden");
}

function inputSymbol(symbol) {
  if (state.phase !== "running") return;

  const expected = state.pattern[state.entered.length];

  if (symbol !== expected) {
    failRun(`예상 박자는 ${labels[expected]}이었습니다.`);
    return;
  }

  state.entered.push(symbol);

  if (state.entered.length === state.pattern.length) {
    completeCipher();
    return;
  }

  hintLine.textContent = `다음 박자: ${state.entered.length + 1}번째`;
  messageLine.textContent = `정확합니다. 남은 입력 ${state.pattern.length - state.entered.length}개.`;
  render();
}

function resetCipher() {
  if (state.phase === "idle") {
    startRun(1);
    return;
  }

  if (state.phase !== "running") return;

  state.entered = [];
  state.timeLeft = timeFor(state.round, state.pattern.length);
  hintLine.textContent = "현재 전보 입력을 처음부터 다시 시작합니다.";
  render();
}

function renderBeats(container, beats, doneCount = 0) {
  container.innerHTML = "";

  beats.forEach((symbol, index) => {
    const beat = document.createElement("div");
    beat.className = `beat ${symbol}${index < doneCount ? " done" : ""}`;
    beat.setAttribute("aria-label", `${index + 1}번째 ${labels[symbol]}`);
    container.appendChild(beat);
  });
}

function render() {
  renderBeats(patternEl, state.pattern, state.entered.length);
  renderBeats(enteredEl, state.entered, state.entered.length);
  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  inputValue.textContent = `${state.entered.length}/${state.pattern.length || 0}`;
  timeValue.textContent = String(state.timeLeft);
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }

  startRun(1);
});

resetButton.addEventListener("click", resetCipher);

document.querySelectorAll("[data-symbol]").forEach((button) => {
  button.addEventListener("click", () => inputSymbol(button.dataset.symbol));
});

document.addEventListener("keydown", (event) => {
  const keyMap = { "1": "short", "2": "long", "3": "rest" };

  if (keyMap[event.key]) {
    event.preventDefault();
    inputSymbol(keyMap[event.key]);
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    resetCipher();
  }
});

render();
