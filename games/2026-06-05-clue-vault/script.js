const roundEl = document.querySelector("#round");
const stageEl = document.querySelector("#stage");
const attemptsEl = document.querySelector("#attempts");
const dialsEl = document.querySelector("#dials");
const cluesEl = document.querySelector("#clues");
const statusEl = document.querySelector("#status");
const checkBtn = document.querySelector("#check");
const restartBtn = document.querySelector("#restart");

const state = {
  round: 1,
  stage: 1,
  stagesNeeded: 2,
  attempts: 5,
  answer: [],
  guess: [],
  clues: []
};

function config() {
  return {
    digits: Math.min(5, 3 + Math.floor((state.round - 1) / 2)),
    stagesNeeded: Math.min(4, 2 + Math.floor(state.round / 2)),
    attempts: Math.max(3, 6 - Math.floor(state.round / 2))
  };
}

function seeded(index, salt) {
  const value = Math.sin(index * 53.17 + salt * 31.91) * 10000;
  return value - Math.floor(value);
}

function makeAnswer() {
  const { digits } = config();
  const salt = state.round * 17 + state.stage * 29;
  return Array.from({ length: digits }, (_, index) => {
    const base = Math.floor(seeded(index + 1, salt) * 10);
    return (base + index + state.round) % 10;
  });
}

function makeClues(answer) {
  const sum = answer.reduce((total, digit) => total + digit, 0);
  const first = answer[0];
  const last = answer[answer.length - 1];
  const oddCount = answer.filter((digit) => digit % 2 === 1).length;
  const highCount = answer.filter((digit) => digit >= 5).length;
  const adjacentDiff = answer.slice(1).map((digit, index) => Math.abs(digit - answer[index]));
  const maxDiff = Math.max(...adjacentDiff);
  const middleIndex = Math.floor(answer.length / 2);
  const middleLabel = answer.length % 2 === 1 ? `${middleIndex + 1}번째 숫자` : `${middleIndex}번째와 ${middleIndex + 1}번째 숫자의 합`;
  const middleValue = answer.length % 2 === 1 ? answer[middleIndex] : answer[middleIndex - 1] + answer[middleIndex];

  return [
    `전체 숫자의 합은 ${sum}입니다.`,
    `첫 숫자와 마지막 숫자의 차이는 ${Math.abs(first - last)}입니다.`,
    `홀수는 ${oddCount}개, 5 이상인 숫자는 ${highCount}개입니다.`,
    `서로 이웃한 숫자 사이의 가장 큰 차이는 ${maxDiff}입니다.`,
    `${middleLabel}은 ${middleValue}입니다.`
  ];
}

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`.trim();
}

function startVault(message = "다이얼을 눌러 숫자를 바꾸고 단서를 모두 만족시키세요.") {
  const next = config();
  state.stagesNeeded = next.stagesNeeded;
  state.attempts = next.attempts;
  state.answer = makeAnswer();
  state.guess = Array.from({ length: next.digits }, () => 0);
  state.clues = makeClues(state.answer);
  setStatus(message);
  render();
}

function resetRun() {
  state.round = 1;
  state.stage = 1;
  startVault("라운드 1부터 다시 시작합니다.");
}

function cycleDigit(index) {
  state.guess[index] = (state.guess[index] + 1) % 10;
  render();
}

function matches() {
  return state.answer.every((digit, index) => digit === state.guess[index]);
}

function checkVault() {
  if (matches()) {
    if (state.stage >= state.stagesNeeded) {
      state.round += 1;
      state.stage = 1;
      startVault(`금고 묶음을 모두 열었습니다. ${state.round}라운드로 바로 이동합니다.`);
      return;
    }

    state.stage += 1;
    startVault("금고가 열렸습니다. 다음 금고로 넘어갑니다.");
    return;
  }

  state.attempts -= 1;
  if (state.attempts <= 0) {
    state.round = 1;
    state.stage = 1;
    startVault("시도를 모두 썼습니다. 실패 처리되어 라운드 1로 돌아갑니다.");
    return;
  }

  const matched = state.guess.filter((digit, index) => digit === state.answer[index]).length;
  setStatus(`아직 열리지 않았습니다. 자리까지 맞은 숫자는 ${matched}개입니다.`, "bad");
  render();
}

function render() {
  roundEl.textContent = state.round;
  stageEl.textContent = `${state.stage}/${state.stagesNeeded}`;
  attemptsEl.textContent = state.attempts;
  dialsEl.style.setProperty("--digits", state.guess.length);
  dialsEl.innerHTML = "";
  cluesEl.innerHTML = "";

  state.guess.forEach((digit, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dial";
    button.setAttribute("aria-label", `${index + 1}번째 숫자, 현재 ${digit}`);
    button.innerHTML = `<span>${digit}</span><small>${index + 1}번째</small>`;
    button.addEventListener("click", () => cycleDigit(index));
    dialsEl.appendChild(button);
  });

  state.clues.forEach((clue) => {
    const item = document.createElement("li");
    item.textContent = clue;
    cluesEl.appendChild(item);
  });
}

checkBtn.addEventListener("click", checkVault);
restartBtn.addEventListener("click", resetRun);
document.addEventListener("keydown", (event) => {
  const index = Number(event.key) - 1;
  if (index >= 0 && index < state.guess.length) {
    cycleDigit(index);
  }
  if (event.key === "Enter") {
    checkVault();
  }
});

startVault();
