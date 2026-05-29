const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const coinValue = document.getElementById("coinValue");
const riskValue = document.getElementById("riskValue");
const messageLine = document.getElementById("messageLine");
const chosenLine = document.getElementById("chosenLine");
const cardList = document.getElementById("cardList");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const testButton = document.getElementById("testButton");
const resetButton = document.getElementById("resetButton");

const metricEls = {
  mud: {
    text: document.getElementById("mudText"),
    bar: document.getElementById("mudBar"),
    limit: document.getElementById("mudLimit")
  },
  toxin: {
    text: document.getElementById("toxinText"),
    bar: document.getElementById("toxinBar"),
    limit: document.getElementById("toxinLimit")
  },
  strain: {
    text: document.getElementById("strainText"),
    bar: document.getElementById("strainBar"),
    limit: document.getElementById("strainLimit")
  }
};

const metrics = ["mud", "toxin", "strain"];
const metricNames = { mud: "탁도", toxin: "독성", strain: "압박" };
const baseCards = [
  { name: "모래층", cost: 3, mud: 7, toxin: 1, strain: 1 },
  { name: "탄소막", cost: 4, mud: 2, toxin: 7, strain: 1 },
  { name: "완충 밸브", cost: 2, mud: 1, toxin: 1, strain: 6 },
  { name: "응집제", cost: 5, mud: 6, toxin: 4, strain: -1 },
  { name: "저속 순환", cost: 3, mud: 3, toxin: 3, strain: 3 }
];

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  coins: 0,
  budget: 12,
  values: { mud: 0, toxin: 0, strain: 0 },
  limits: { mud: 0, toxin: 0, strain: 0 },
  cards: [],
  selected: new Set(),
  seed: 20260529,
  nextTimer: 0
};

function random() {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function goalFor(round) {
  return Math.min(6, 2 + round);
}

function budgetFor(round) {
  return Math.max(10, 13 - Math.floor(round / 4));
}

function roundScale() {
  return 1 + Math.floor((state.round - 1) / 3);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeCards() {
  const scale = roundScale();
  return baseCards.map((card, index) => ({
    ...card,
    cost: card.cost + (index % 3 === 0 ? Math.floor(scale / 2) : 0),
    mud: card.mud + (index % 2 === 0 ? scale - 1 : 0),
    toxin: card.toxin + (index % 2 === 1 ? scale - 1 : 0),
    strain: card.strain + (index === 2 ? scale - 1 : 0)
  }));
}

function buildSample() {
  const scale = roundScale();
  state.values = {
    mud: 16 + Math.floor(random() * 7) + scale * 2,
    toxin: 15 + Math.floor(random() * 7) + scale * 2,
    strain: 14 + Math.floor(random() * 7) + scale
  };
  const tolerance = Math.max(4, 8 - Math.floor(state.round / 3));
  state.limits = {
    mud: tolerance + Math.floor(random() * 3),
    toxin: tolerance + Math.floor(random() * 3),
    strain: tolerance + Math.floor(random() * 3)
  };
}

function remainingValues() {
  const result = { ...state.values };

  state.selected.forEach((index) => {
    const card = state.cards[index];
    metrics.forEach((metric) => {
      result[metric] -= card[metric];
    });
  });

  return result;
}

function spentCoins() {
  let total = 0;
  state.selected.forEach((index) => {
    total += state.cards[index].cost;
  });
  return total;
}

function riskCount() {
  const remaining = remainingValues();
  return metrics.filter((metric) => remaining[metric] > state.limits[metric]).length;
}

function isSolved() {
  return riskCount() === 0;
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.budget = budgetFor(round);
  state.seed = (20260529 + round * 227) >>> 0;
  state.phase = "running";
  overlay.classList.add("hidden");
  startSample();
}

function startSample() {
  state.cards = makeCards();
  state.selected = new Set();
  state.coins = 0;
  buildSample();
  messageLine.textContent = `시료 ${state.score + 1}/${state.goal}: 코인 예산 안에서 모든 기준을 통과시키세요.`;
  render();
}

function completeSample() {
  state.score += 1;

  if (state.score >= state.goal) {
    state.phase = "cleared";
    render();
    overlayTitle.textContent = `라운드 ${state.round} 완성`;
    overlayText.textContent = "다음 라운드는 오염도가 높아지고 예산 여유가 줄어듭니다.";
    startButton.textContent = `라운드 ${state.round + 1} 시작`;
    messageLine.textContent = `라운드 ${state.round} 완료. 곧 다음 라운드로 이동합니다.`;
    overlay.classList.remove("hidden");
    state.nextTimer = setTimeout(() => startRun(state.round + 1), 1000);
    return;
  }

  messageLine.textContent = "정화 성공. 다음 시료 경매를 엽니다.";
  state.nextTimer = setTimeout(startSample, 540);
}

function failRun(reason) {
  state.phase = "failed";
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = "정화 실패";
  overlayText.textContent = `${reason} 라운드 1부터 다시 시작합니다.`;
  startButton.textContent = "라운드 1 다시 시작";
  messageLine.textContent = "실패했습니다. 라운드가 1로 초기화됩니다.";
  overlay.classList.remove("hidden");
}

function toggleCard(index) {
  if (state.phase !== "running") return;

  if (state.selected.has(index)) {
    state.selected.delete(index);
    state.coins = spentCoins();
    messageLine.textContent = "필터를 입찰 목록에서 뺐습니다.";
    render();
    return;
  }

  state.selected.add(index);
  state.coins = spentCoins();

  if (state.coins > state.budget) {
    failRun("예산을 초과했습니다.");
    return;
  }

  if (isSolved()) {
    completeSample();
    return;
  }

  messageLine.textContent = `부족 기준 ${riskCount()}개. 남은 코인 ${state.budget - state.coins}.`;
  render();
}

function testPurify() {
  if (state.phase !== "running") return;

  if (isSolved()) {
    completeSample();
    return;
  }

  failRun(`기준 ${riskCount()}개가 아직 통과되지 않았습니다.`);
}

function resetSample() {
  if (state.phase === "idle") {
    startRun(1);
    return;
  }

  if (state.phase !== "running") return;

  state.selected = new Set();
  state.coins = 0;
  messageLine.textContent = "현재 시료의 입찰을 모두 취소했습니다.";
  render();
}

function percent(value) {
  return `${clamp((value / 32) * 100, 0, 100)}%`;
}

function renderMetrics() {
  const remaining = remainingValues();

  metrics.forEach((metric) => {
    metricEls[metric].text.textContent = `${remaining[metric]} / 기준 ${state.limits[metric]}`;
    metricEls[metric].bar.style.width = percent(remaining[metric]);
    metricEls[metric].limit.style.left = percent(state.limits[metric]);
  });
}

function renderCards() {
  cardList.innerHTML = "";

  state.cards.forEach((card, index) => {
    const selected = state.selected.has(index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-card${selected ? " selected" : ""}`;
    button.setAttribute("aria-label", `${card.name}: 비용 ${card.cost}, 탁도 ${card.mud}, 독성 ${card.toxin}, 압박 ${card.strain}`);
    button.innerHTML = `<strong>${index + 1}. ${card.name} · ${card.cost}코인</strong><span>탁도 -${card.mud} / 독성 -${card.toxin} / 압박 -${card.strain}</span>`;
    button.addEventListener("click", () => toggleCard(index));
    cardList.appendChild(button);
  });
}

function renderChosen() {
  if (state.selected.size === 0) {
    chosenLine.textContent = "아직 선택한 필터가 없습니다.";
    return;
  }

  const names = Array.from(state.selected).map((index) => state.cards[index].name);
  chosenLine.textContent = `${names.join(", ")} · ${state.coins}/${state.budget}코인`;
}

function render() {
  renderMetrics();
  renderCards();
  renderChosen();
  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  coinValue.textContent = `${state.coins}/${state.budget}`;
  riskValue.textContent = String(riskCount());
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }

  startRun(1);
});

testButton.addEventListener("click", testPurify);
resetButton.addEventListener("click", resetSample);

document.addEventListener("keydown", (event) => {
  const index = Number(event.key) - 1;

  if (index >= 0 && index < state.cards.length) {
    event.preventDefault();
    toggleCard(index);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    testPurify();
  }
});

render();
