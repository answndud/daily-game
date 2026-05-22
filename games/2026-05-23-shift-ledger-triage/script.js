"use strict";

const stationGrid = document.getElementById("stationGrid");
const cardList = document.getElementById("cardList");
const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const turnValue = document.getElementById("turnValue");
const limitValue = document.getElementById("limitValue");
const messageLine = document.getElementById("messageLine");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const applyButton = document.getElementById("applyButton");
const resetButton = document.getElementById("resetButton");

const stationNames = ["접수 데스크", "배포 벤치", "검수 라인", "복구 창구", "기록 보관", "야간 지원"];

const cardTemplates = [
  {
    name: "집중 처리",
    work: 8,
    stress: 3,
    coolAll: 0,
    copy: "큰 대기열을 빠르게 줄이지만 선택한 작업대의 피로가 크게 오릅니다."
  },
  {
    name: "자동화 매크로",
    work: 6,
    stress: 1,
    coolAll: 0,
    copy: "처리량과 피로 상승이 모두 무난한 표준 배치입니다."
  },
  {
    name: "휴식 교대",
    work: 3,
    stress: -3,
    coolAll: 0,
    copy: "처리량은 낮지만 선택한 작업대의 피로를 크게 낮춥니다."
  },
  {
    name: "분산 지원",
    work: 4,
    stress: 0,
    coolAll: 1,
    copy: "선택한 대기열을 조금 줄이고 모든 작업대의 피로를 한 칸 낮춥니다."
  },
  {
    name: "긴급 호출",
    work: 9,
    stress: 4,
    coolAll: 0,
    copy: "위험한 대기열을 끊어내는 카드입니다. 피로 한계 직전에는 주의하세요."
  },
  {
    name: "검토 정리",
    work: 5,
    stress: -1,
    coolAll: 0,
    copy: "중간 처리량으로 대기열을 낮추면서 피로를 조금 회복합니다."
  }
];

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 5,
  turn: 0,
  turnLimit: 17,
  queueLimit: 18,
  fatigueLimit: 10,
  seed: 20260523,
  stations: [],
  cards: [],
  selectedStation: null,
  selectedCard: null,
  nextTimer: 0
};

function nextRandom() {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function randomInt(min, max) {
  return min + Math.floor(nextRandom() * (max - min + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function goalForRound(round) {
  return Math.min(10, 3 + round);
}

function turnLimitForRound(round, goal) {
  return Math.max(goal + 9, 16 + goal - Math.floor(round / 4));
}

function queueLimitForRound(round) {
  return Math.max(15, 19 - Math.floor((round - 1) / 5));
}

function buildStation(id) {
  const roundLift = Math.min(5, Math.floor(state.round * 0.55));
  const load = randomInt(4 + Math.floor(state.round / 4), 7 + roundLift);
  const incoming = randomInt(1, Math.min(3, 1 + Math.floor((state.round - 1) / 5)));
  return {
    id,
    name: stationNames[(id + state.round + state.score) % stationNames.length],
    load: clamp(load, 3, state.queueLimit - 5),
    fatigue: randomInt(0, Math.min(3, 1 + Math.floor(state.round / 4))),
    incoming
  };
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.goal = goalForRound(round);
  state.turn = 0;
  state.turnLimit = turnLimitForRound(round, state.goal);
  state.queueLimit = queueLimitForRound(round);
  state.fatigueLimit = 10;
  state.seed = (20260523 + round * 131) >>> 0;
  state.stations = Array.from({ length: 4 }, (_, index) => buildStation(index));
  state.selectedStation = null;
  state.selectedCard = null;
  drawCards();
  overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: ${state.goal}개 작업을 처리하세요. 대기열과 피로도 중 하나라도 한계를 넘으면 실패입니다.`);
  render();
}

function drawCards() {
  const pool = [...cardTemplates];
  const cards = [];

  while (cards.length < 3 && pool.length > 0) {
    const index = Math.floor(nextRandom() * pool.length);
    cards.push(pool.splice(index, 1)[0]);
  }

  if (!cards.some((card) => card.stress < 0 || card.coolAll > 0)) {
    cards[2] = cardTemplates[2];
  }

  const workBoost = Math.min(3, Math.floor((state.round - 1) / 3));
  state.cards = cards.map((card, index) => ({
    ...card,
    id: index,
    work: card.work + workBoost
  }));
}

function selectStation(id) {
  if (state.phase !== "running") {
    startRun(1);
    return;
  }

  state.selectedStation = id;
  setMessage(`${state.stations.find((station) => station.id === id).name} 작업대를 선택했습니다. 사용할 교대 카드를 고르세요.`);
  render();
}

function selectCard(id) {
  if (state.phase !== "running") {
    startRun(1);
    return;
  }

  state.selectedCard = id;
  const card = state.cards.find((item) => item.id === id);
  setMessage(`${card.name} 카드를 선택했습니다. 배치 실행으로 턴을 진행하세요.`);
  render();
}

function applySelection() {
  if (state.phase !== "running") {
    startRun(1);
    return;
  }

  if (state.selectedStation === null || state.selectedCard === null) {
    setMessage("작업대 하나와 교대 카드 하나를 모두 선택해야 합니다.");
    return;
  }

  const station = state.stations.find((item) => item.id === state.selectedStation);
  const card = state.cards.find((item) => item.id === state.selectedCard);
  const beforeLoad = station.load;

  station.load = Math.max(0, station.load - card.work);
  station.fatigue = clamp(station.fatigue + card.stress, 0, state.fatigueLimit + 2);

  if (card.coolAll > 0) {
    state.stations.forEach((item) => {
      item.fatigue = Math.max(0, item.fatigue - card.coolAll);
    });
  }

  let completed = false;
  if (station.load === 0) {
    completed = true;
    state.score += 1;
    replaceStation(station.id);
  }

  if (state.score >= state.goal) {
    clearRound();
    return;
  }

  advanceTurn(state.selectedStation);

  if (checkFailure()) {
    return;
  }

  const processed = beforeLoad - Math.max(0, beforeLoad - card.work);
  state.selectedStation = null;
  state.selectedCard = null;
  drawCards();
  setMessage(completed
    ? `작업 처리 완료. 남은 목표 ${state.goal - state.score}개입니다.`
    : `${card.name} 배치로 대기열 ${processed}칸을 줄였습니다. 다음 위험 작업대를 고르세요.`);
  render();
}

function replaceStation(id) {
  state.stations = state.stations.map((station) => station.id === id ? buildStation(id) : station);
}

function advanceTurn(actedId) {
  state.turn += 1;

  state.stations.forEach((station) => {
    if (station.id !== actedId) {
      station.fatigue = Math.max(0, station.fatigue - 1);
    }

    const surgeChance = 0.12 + Math.min(0.14, state.round * 0.012);
    const surge = nextRandom() < surgeChance ? 1 : 0;
    station.load += station.incoming + surge;

    if (station.load >= state.queueLimit - 3) {
      station.fatigue += 1;
    }
  });
}

function checkFailure() {
  const overloaded = state.stations.find((station) => station.load > state.queueLimit);
  if (overloaded) {
    failRun(`${overloaded.name}의 대기열이 ${overloaded.load}까지 쌓였습니다.`);
    return true;
  }

  const exhausted = state.stations.find((station) => station.fatigue > state.fatigueLimit);
  if (exhausted) {
    failRun(`${exhausted.name}의 피로도가 ${exhausted.fatigue}까지 올랐습니다.`);
    return true;
  }

  if (state.turn >= state.turnLimit) {
    failRun("교대 시간이 끝나기 전에 목표 처리 수를 채우지 못했습니다.");
    return true;
  }

  return false;
}

function clearRound() {
  state.phase = "cleared";
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = `라운드 ${state.round} 정산 완료`;
  overlayText.textContent = "다음 라운드는 목표 작업이 늘고 대기열 한계가 더 빡빡해집니다.";
  startButton.textContent = `라운드 ${state.round + 1} 시작`;
  overlay.classList.remove("hidden");
  setMessage(`라운드 ${state.round} 완료. 곧 다음 라운드로 이동합니다.`);
  state.nextTimer = setTimeout(() => {
    if (state.phase === "cleared") {
      startRun(state.round + 1);
    }
  }, 1000);
}

function failRun(reason) {
  state.phase = "failed";
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = "교대 원장 실패";
  overlayText.textContent = `${reason} 라운드 1부터 다시 정리하세요.`;
  startButton.textContent = "라운드 1 다시 시작";
  overlay.classList.remove("hidden");
  setMessage("실패했습니다. 위험 작업대와 회복 카드를 더 일찍 배치해야 합니다.");
}

function urgencyFor(station) {
  const loadRate = station.load / state.queueLimit;
  const fatigueRate = station.fatigue / state.fatigueLimit;
  const risk = Math.max(loadRate, fatigueRate);

  if (risk >= 0.86) return "위험";
  if (risk >= 0.68) return "주의";
  return "안정";
}

function meterClass(value, limit) {
  const rate = value / limit;
  if (rate >= 0.86) return "bad";
  if (rate >= 0.68) return "warn";
  return "";
}

function renderMeter(label, value, limit) {
  const wrapper = document.createElement("div");
  const fillClass = meterClass(value, limit);
  wrapper.innerHTML = `
    <div class="meter-top">
      <span>${label}</span>
      <span>${value}/${limit}</span>
    </div>
    <div class="meter-bar" aria-hidden="true">
      <span class="meter-fill ${fillClass}" style="--value: ${clamp((value / limit) * 100, 0, 100)}%"></span>
    </div>
  `;
  return wrapper;
}

function renderStation(station, index) {
  const selected = state.selectedStation === station.id;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `station-card${selected ? " selected" : ""}`;
  button.setAttribute("role", "listitem");
  button.setAttribute("aria-label", `${index + 1}번 ${station.name}, 대기 ${station.load}, 피로 ${station.fatigue}, 유입 ${station.incoming}`);

  const head = document.createElement("div");
  head.className = "station-head";
  head.innerHTML = `
    <div>
      <strong>${index + 1}. ${station.name}</strong>
      <span class="station-status">상태 ${urgencyFor(station)}</span>
    </div>
    <span class="badge">유입 +${station.incoming}</span>
  `;

  const meters = document.createElement("div");
  meters.className = "meter-group";
  meters.appendChild(renderMeter("대기열", station.load, state.queueLimit));
  meters.appendChild(renderMeter("피로도", station.fatigue, state.fatigueLimit));

  const foot = document.createElement("div");
  foot.className = "station-foot";
  foot.innerHTML = `<span>완료 조건</span><strong>대기열 0</strong>`;

  button.append(head, meters, foot);
  button.addEventListener("click", () => selectStation(station.id));
  return button;
}

function renderCard(card, index) {
  const selected = state.selectedCard === card.id;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `card-button${selected ? " selected" : ""}`;
  button.setAttribute("role", "listitem");
  button.setAttribute("aria-label", `${index + 1}번 카드 ${card.name}, 대기 ${card.work} 감소, 피로 ${signed(card.stress)}`);
  button.innerHTML = `
    <span class="card-head">
      <strong>${index + 1}. ${card.name}</strong>
      <span class="card-meta">대기 -${card.work} · 피로 ${signed(card.stress)}${card.coolAll ? ` · 전체 -${card.coolAll}` : ""}</span>
    </span>
    <p class="card-copy">${card.copy}</p>
  `;
  button.addEventListener("click", () => selectCard(card.id));
  return button;
}

function render() {
  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  turnValue.textContent = `${state.turn}/${state.turnLimit}`;
  limitValue.textContent = `대기 ${state.queueLimit} · 피로 ${state.fatigueLimit}`;
  stationGrid.replaceChildren(...state.stations.map(renderStation));
  cardList.replaceChildren(...state.cards.map(renderCard));
}

function setMessage(text) {
  messageLine.textContent = text;
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }
  startRun(1);
});

applyButton.addEventListener("click", applySelection);
resetButton.addEventListener("click", () => startRun(1));

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key >= "1" && key <= "4") {
    event.preventDefault();
    const station = state.stations[Number(key) - 1];
    if (station) selectStation(station.id);
    return;
  }

  const cardKeys = ["q", "w", "e"];
  const cardIndex = cardKeys.indexOf(key);
  if (cardIndex >= 0 && state.cards[cardIndex]) {
    event.preventDefault();
    selectCard(state.cards[cardIndex].id);
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    applySelection();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    startRun(1);
  }
});

render();
