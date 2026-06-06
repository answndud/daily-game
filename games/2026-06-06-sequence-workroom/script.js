const roundEl = document.querySelector("#round");
const stageEl = document.querySelector("#stage");
const movesEl = document.querySelector("#moves");
const cluesEl = document.querySelector("#clues");
const cardsEl = document.querySelector("#cards");
const statusEl = document.querySelector("#status");
const leftBtn = document.querySelector("#left");
const rightBtn = document.querySelector("#right");
const restartBtn = document.querySelector("#restart");

const labels = ["접수", "검증", "분류", "압축", "봉인", "기록", "배포"];

const state = {
  round: 1,
  stage: 1,
  stagesNeeded: 2,
  moves: 8,
  answer: [],
  order: [],
  clues: [],
  selected: 0
};

function config() {
  return {
    size: Math.min(6, 4 + Math.floor((state.round - 1) / 2)),
    stagesNeeded: Math.min(4, 2 + Math.floor(state.round / 2)),
    moves: Math.max(6, 9 - Math.floor(state.round / 2))
  };
}

function rotateList(list, amount) {
  const cut = amount % list.length;
  return list.slice(cut).concat(list.slice(0, cut));
}

function makeAnswer() {
  const { size } = config();
  const base = rotateList(labels, state.round + state.stage).slice(0, size);
  if ((state.round + state.stage) % 2 === 0) {
    return base.reverse();
  }
  return base;
}

function makeStart(answer) {
  const order = answer.slice();
  const swaps = 2 + state.round + state.stage;
  for (let i = 0; i < swaps; i += 1) {
    const index = (i * 2 + state.round + state.stage) % (order.length - 1);
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
  }
  return order;
}

function makeClues(answer) {
  const clues = [
    `첫 작업은 '${answer[0]}'입니다.`,
    `마지막 작업은 '${answer[answer.length - 1]}'입니다.`
  ];
  for (let i = 0; i < answer.length - 1; i += 1) {
    const left = answer[i];
    const right = answer[i + 1];
    clues.push(`'${left}' 다음에는 바로 '${right}'가 와야 합니다.`);
  }
  return clues;
}

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`.trim();
}

function startStage(message = "카드를 하나 선택한 뒤 왼쪽 또는 오른쪽으로 인접 교환하세요.") {
  const next = config();
  state.stagesNeeded = next.stagesNeeded;
  state.moves = next.moves;
  state.answer = makeAnswer();
  state.order = makeStart(state.answer);
  state.clues = makeClues(state.answer);
  state.selected = 0;
  setStatus(message);
  render();
  evaluateSolved();
}

function resetRun() {
  state.round = 1;
  state.stage = 1;
  startStage("라운드 1부터 다시 시작합니다.");
}

function swapSelected(direction) {
  const nextIndex = state.selected + direction;
  if (nextIndex < 0 || nextIndex >= state.order.length || state.moves <= 0) {
    return;
  }

  [state.order[state.selected], state.order[nextIndex]] = [state.order[nextIndex], state.order[state.selected]];
  state.selected = nextIndex;
  state.moves -= 1;

  if (!evaluateSolved() && state.moves <= 0) {
    state.round = 1;
    state.stage = 1;
    startStage("이동 횟수를 모두 썼습니다. 실패 처리되어 라운드 1로 돌아갑니다.");
    return;
  }

  render();
}

function isSolved() {
  return state.answer.every((label, index) => label === state.order[index]);
}

function evaluateSolved() {
  if (!isSolved()) {
    return false;
  }

  if (state.stage >= state.stagesNeeded) {
    state.round += 1;
    state.stage = 1;
    startStage(`작업 묶음을 모두 정렬했습니다. 더 긴 순서의 라운드 ${state.round}로 바로 이동합니다.`);
    return true;
  }

  state.stage += 1;
  startStage("작업 묶음 정렬 완료. 다음 묶음으로 넘어갑니다.");
  return true;
}

function render() {
  roundEl.textContent = state.round;
  stageEl.textContent = `${state.stage}/${state.stagesNeeded}`;
  movesEl.textContent = state.moves;
  cluesEl.innerHTML = "";
  cardsEl.innerHTML = "";

  state.clues.forEach((clue) => {
    const item = document.createElement("li");
    item.textContent = clue;
    cluesEl.appendChild(item);
  });

  state.order.forEach((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card${index === state.selected ? " selected" : ""}`;
    button.setAttribute("aria-label", `${index + 1}번째 작업 ${label}`);
    button.innerHTML = `<strong>${label}</strong><span>${index + 1}번째</span>`;
    button.addEventListener("click", () => {
      state.selected = index;
      setStatus(`'${label}' 작업을 선택했습니다.`);
      render();
    });
    cardsEl.appendChild(button);
  });

  leftBtn.disabled = state.selected === 0;
  rightBtn.disabled = state.selected === state.order.length - 1;
}

leftBtn.addEventListener("click", () => swapSelected(-1));
rightBtn.addEventListener("click", () => swapSelected(1));
restartBtn.addEventListener("click", resetRun);
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") swapSelected(-1);
  if (event.key === "ArrowRight") swapSelected(1);
  const index = Number(event.key) - 1;
  if (index >= 0 && index < state.order.length) {
    state.selected = index;
    render();
  }
});

startStage();
