"use strict";

const dom = {
  round: document.getElementById("roundValue"),
  score: document.getElementById("scoreValue"),
  goal: document.getElementById("goalValue"),
  trainCount: document.getElementById("trainCountValue"),
  rule: document.getElementById("ruleValue"),
  list: document.getElementById("trainList"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  startButton: document.getElementById("startButton"),
  resetButton: document.getElementById("resetButton"),
};

const lines = ["북문", "남문", "동문", "서문", "순환"];
const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 8,
  trains: [],
  nextId: 1,
  tickTimer: 0,
  spawnTimer: 0,
  lastTick: 0,
};

function goalFor(round) {
  return 7 + round;
}

function trainCountFor(round) {
  return Math.min(5, 3 + Math.floor((round - 1) / 3));
}

function deadlineFor(round) {
  const maxSeconds = Math.max(5, 10 - Math.floor(round / 2));
  const minSeconds = Math.max(3, maxSeconds - 3);
  const seconds = minSeconds + Math.floor(Math.random() * (maxSeconds - minSeconds + 1));
  return seconds * 1000;
}

function makeTrain() {
  const deadline = deadlineFor(state.round);
  return {
    id: state.nextId,
    code: `T${String(state.nextId).padStart(2, "0")}`,
    line: lines[(state.nextId + state.round) % lines.length],
    passengers: 40 + Math.floor(Math.random() * (70 + state.round * 8)),
    risk: 1 + Math.floor(Math.random() * Math.min(5, 2 + Math.ceil(state.round / 2))),
    remaining: deadline,
    maxTime: deadline,
  };
}

function startRound(round = 1) {
  clearTimers();
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.nextId = 1;
  state.trains = [];
  state.lastTick = performance.now();
  const count = trainCountFor(round);
  for (let index = 0; index < count; index += 1) {
    state.trains.push(makeTrain());
    state.nextId += 1;
  }
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 마감, 위험도, 승객 수 순서로 ${state.goal}대를 관제하세요.`);
  render();
  state.tickTimer = window.setInterval(tick, 90);
}

function clearTimers() {
  if (state.tickTimer) {
    window.clearInterval(state.tickTimer);
    state.tickTimer = 0;
  }
  if (state.spawnTimer) {
    window.clearTimeout(state.spawnTimer);
    state.spawnTimer = 0;
  }
}

function tick() {
  if (state.phase !== "running") {
    return;
  }
  const now = performance.now();
  const elapsed = now - state.lastTick;
  state.lastTick = now;
  for (const train of state.trains) {
    train.remaining -= elapsed;
  }
  const expired = state.trains.find((train) => train.remaining <= 0);
  if (expired) {
    failRun(`${expired.code}의 마감 시간이 끝났습니다.`);
    return;
  }
  render();
}

function comparePriority(a, b) {
  if (Math.ceil(a.remaining / 1000) !== Math.ceil(b.remaining / 1000)) {
    return a.remaining - b.remaining;
  }
  if (a.risk !== b.risk) {
    return b.risk - a.risk;
  }
  return b.passengers - a.passengers;
}

function bestTrain() {
  return [...state.trains].sort(comparePriority)[0];
}

function chooseTrain(id) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  const train = state.trains.find((item) => item.id === id);
  const best = bestTrain();
  if (!train || !best) {
    return;
  }
  if (train.id !== best.id) {
    failRun(`${train.code}보다 ${best.code}가 먼저였습니다.`);
    return;
  }
  state.score += 1;
  state.trains = state.trains.filter((item) => item.id !== id);
  setMessage(`${train.code} 통과. 남은 목표 ${Math.max(0, state.goal - state.score)}대.`);
  if (state.score >= state.goal) {
    clearRound();
    return;
  }
  state.spawnTimer = window.setTimeout(() => {
    if (state.phase !== "running") {
      return;
    }
    state.trains.push(makeTrain());
    state.nextId += 1;
    render();
  }, Math.max(90, 360 - state.round * 18));
  render();
}

function clearRound() {
  clearTimers();
  state.phase = "cleared";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "관제 성공";
  dom.overlayTitle.textContent = `라운드 ${state.round} 완료`;
  dom.overlayText.textContent = "다음 라운드는 열차 마감이 더 짧고 비교할 카드가 늘어납니다.";
  dom.startButton.textContent = `라운드 ${state.round + 1}`;
  setMessage(`성공. 곧 라운드 ${state.round + 1}로 이동합니다.`);
  render();
  state.spawnTimer = window.setTimeout(() => startRound(state.round + 1), 900);
}

function failRun(reason) {
  clearTimers();
  state.phase = "failed";
  const best = bestTrain();
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "관제 실패";
  dom.overlayTitle.textContent = "라운드 1로 복귀";
  dom.overlayText.textContent = best ? `${reason} 정답 우선순위는 ${best.code}였습니다.` : reason;
  dom.startButton.textContent = "라운드 1";
  setMessage("실패하면 진행도가 초기화됩니다. 라운드 1부터 다시 시작하세요.");
  render();
}

function render() {
  dom.round.textContent = String(state.round);
  dom.score.textContent = String(state.score);
  dom.goal.textContent = String(state.goal);
  dom.trainCount.textContent = `${trainCountFor(state.round)}대`;
  dom.rule.textContent = "마감 우선";
  dom.list.replaceChildren(...state.trains.map(renderTrain));
}

function renderTrain(train, index) {
  const button = document.createElement("button");
  const seconds = Math.max(0, train.remaining / 1000);
  const fill = Math.max(0, Math.min(100, (train.remaining / train.maxTime) * 100));
  button.type = "button";
  button.className = `train-card${seconds < 2.4 ? " urgent" : ""}`;
  button.setAttribute("role", "listitem");
  button.setAttribute("aria-label", `${index + 1}번 ${train.code}, ${train.line}, 마감 ${seconds.toFixed(1)}초, 위험도 ${train.risk}, 승객 ${train.passengers}명`);
  button.innerHTML = `
    <span class="train-code">${index + 1}</span>
    <span class="train-main">
      <strong>${train.code} ${train.line}</strong>
      <span>위험도 ${train.risk} / 승객 ${train.passengers}명</span>
    </span>
    <span class="train-time">
      <strong>${seconds.toFixed(1)}초</strong>
      <span>남은 마감</span>
    </span>
    <span class="meter" aria-hidden="true"><span style="--fill: ${fill}%"></span></span>
  `;
  button.addEventListener("click", () => chooseTrain(train.id));
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

dom.startButton.addEventListener("click", handleStart);
dom.resetButton.addEventListener("click", () => startRound(1));

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
  const number = Number.parseInt(key, 10);
  if (Number.isFinite(number) && number >= 1 && number <= state.trains.length) {
    chooseTrain(state.trains[number - 1].id);
  }
});

render();
