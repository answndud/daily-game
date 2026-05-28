const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const moveValue = document.getElementById("moveValue");
const stabilityValue = document.getElementById("stabilityValue");
const messageLine = document.getElementById("messageLine");
const cardList = document.getElementById("cardList");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const testButton = document.getElementById("testButton");
const resetButton = document.getElementById("resetButton");

const metricEls = {
  heat: {
    text: document.getElementById("heatText"),
    bar: document.getElementById("heatBar"),
    target: document.getElementById("heatTarget"),
    range: document.getElementById("heatRange")
  },
  purity: {
    text: document.getElementById("purityText"),
    bar: document.getElementById("purityBar"),
    target: document.getElementById("purityTarget"),
    range: document.getElementById("purityRange")
  },
  pressure: {
    text: document.getElementById("pressureText"),
    bar: document.getElementById("pressureBar"),
    target: document.getElementById("pressureTarget"),
    range: document.getElementById("pressureRange")
  }
};

const baseCards = [
  { name: "저온 환류", heat: 2, purity: 4, pressure: -1 },
  { name: "가압 농축", heat: 3, purity: 1, pressure: 4 },
  { name: "불순물 절삭", heat: -1, purity: 5, pressure: 1 },
  { name: "급속 가열", heat: 5, purity: -1, pressure: 2 },
  { name: "감압 냉각", heat: -3, purity: 2, pressure: -2 }
];

const metrics = ["heat", "purity", "pressure"];
const metricNames = { heat: "열량", purity: "순도", pressure: "압력" };

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  moves: 0,
  limit: 8,
  values: { heat: 0, purity: 0, pressure: 0 },
  target: {},
  cards: [],
  seed: 20260528,
  nextTimer: 0
};

function random() {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function goalFor(round) {
  return Math.min(6, 2 + round);
}

function limitFor(round) {
  return Math.max(6, 9 - Math.floor(round / 3));
}

function cardScaleFor(round) {
  return 1 + Math.floor((round - 1) / 3);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeCards() {
  const scale = cardScaleFor(state.round);
  return baseCards.map((card, index) => ({
    ...card,
    heat: card.heat + (index % 2 === 0 ? scale - 1 : 0),
    purity: card.purity + (index % 3 === 0 ? 0 : scale - 1),
    pressure: card.pressure + (index % 2 === 1 ? scale - 1 : 0)
  }));
}

function applyCardTo(values, card) {
  return {
    heat: values.heat + card.heat,
    purity: values.purity + card.purity,
    pressure: values.pressure + card.pressure
  };
}

function buildTarget() {
  let simulated = { heat: 0, purity: 0, pressure: 0 };
  const steps = Math.min(state.limit - 1, 4 + Math.floor(state.round / 2));

  for (let step = 0; step < steps; step += 1) {
    const card = state.cards[Math.floor(random() * state.cards.length)];
    simulated = applyCardTo(simulated, card);
  }

  const tolerance = Math.max(1, 3 - Math.floor(state.round / 3));
  state.target = {};

  metrics.forEach((metric) => {
    const center = clamp(simulated[metric], 2, 30);
    state.target[metric] = {
      min: clamp(center - tolerance, -12, 34),
      max: clamp(center + tolerance, -12, 34)
    };
  });
}

function stabilityScore() {
  return metrics.reduce((sum, metric) => {
    const value = state.values[metric];
    const target = state.target[metric];
    if (!target) return sum;
    if (value >= target.min && value <= target.max) return sum;
    if (value < target.min) return sum + target.min - value;
    return sum + value - target.max;
  }, 0);
}

function isSafe() {
  return metrics.every((metric) => state.values[metric] >= -12 && state.values[metric] <= 34);
}

function isSolved() {
  return stabilityScore() === 0;
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.limit = limitFor(round);
  state.seed = (20260528 + round * 211) >>> 0;
  state.phase = "running";
  overlay.classList.add("hidden");
  startSample();
}

function startSample() {
  state.moves = 0;
  state.values = { heat: 0, purity: 0, pressure: 0 };
  state.cards = makeCards();
  buildTarget();
  messageLine.textContent = `시료 ${state.score + 1}/${state.goal}: 세 지표를 목표 범위 안에 넣으세요.`;
  render();
}

function completeSample() {
  state.score += 1;

  if (state.score >= state.goal) {
    state.phase = "cleared";
    render();
    overlayTitle.textContent = `라운드 ${state.round} 완성`;
    overlayText.textContent = "다음 라운드는 공정 변동이 커지고 조정 여유가 줄어듭니다.";
    startButton.textContent = `라운드 ${state.round + 1} 시작`;
    messageLine.textContent = `라운드 ${state.round} 완료. 곧 다음 라운드로 이동합니다.`;
    overlay.classList.remove("hidden");
    state.nextTimer = setTimeout(() => startRun(state.round + 1), 1000);
    return;
  }

  messageLine.textContent = "시료 승인. 다음 증류 조건을 불러옵니다.";
  state.nextTimer = setTimeout(startSample, 540);
}

function failRun(reason) {
  state.phase = "failed";
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = "증류 실패";
  overlayText.textContent = `${reason} 라운드 1부터 다시 시작합니다.`;
  startButton.textContent = "라운드 1 다시 시작";
  messageLine.textContent = "실패했습니다. 라운드가 1로 초기화됩니다.";
  overlay.classList.remove("hidden");
}

function chooseCard(index) {
  if (state.phase !== "running") return;

  state.values = applyCardTo(state.values, state.cards[index]);
  state.moves += 1;

  if (!isSafe()) {
    failRun("안전 범위를 벗어났습니다.");
    return;
  }

  if (isSolved()) {
    completeSample();
    return;
  }

  if (state.moves >= state.limit) {
    failRun("공정 횟수를 모두 사용했습니다.");
    return;
  }

  messageLine.textContent = `안정도 오차 ${stabilityScore()}. 남은 공정 ${state.limit - state.moves}회.`;
  render();
}

function testSample() {
  if (state.phase !== "running") return;

  if (isSolved()) {
    completeSample();
    return;
  }

  state.moves += 1;

  if (state.moves >= state.limit) {
    failRun("검사까지 포함해 공정 제한을 넘었습니다.");
    return;
  }

  messageLine.textContent = `아직 목표 범위 밖입니다. 검사는 공정 1회로 계산됩니다.`;
  render();
}

function resetSample() {
  if (state.phase === "idle") {
    startRun(1);
    return;
  }

  if (state.phase !== "running") return;

  state.moves = 0;
  state.values = { heat: 0, purity: 0, pressure: 0 };
  messageLine.textContent = "현재 시료를 처음 상태로 되돌렸습니다.";
  render();
}

function percent(value) {
  return `${clamp(((value + 12) / 46) * 100, 0, 100)}%`;
}

function renderMeters() {
  metrics.forEach((metric) => {
    const value = state.values[metric];
    const target = state.target[metric] || { min: 0, max: 0 };
    metricEls[metric].text.textContent = String(value);
    metricEls[metric].bar.style.width = percent(value);
    metricEls[metric].target.style.left = percent(target.min);
    metricEls[metric].target.style.width = `${clamp(((target.max - target.min) / 46) * 100, 0, 100)}%`;
    metricEls[metric].range.textContent = `목표 ${target.min}~${target.max}`;
  });
}

function renderCards() {
  cardList.innerHTML = "";

  state.cards.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "process-card";
    button.setAttribute("aria-label", `${card.name}: 열량 ${card.heat}, 순도 ${card.purity}, 압력 ${card.pressure}`);
    button.innerHTML = `<strong>${index + 1}. ${card.name}</strong><span>열량 ${card.heat >= 0 ? "+" : ""}${card.heat} / 순도 ${card.purity >= 0 ? "+" : ""}${card.purity} / 압력 ${card.pressure >= 0 ? "+" : ""}${card.pressure}</span>`;
    button.addEventListener("click", () => chooseCard(index));
    cardList.appendChild(button);
  });
}

function render() {
  renderMeters();
  renderCards();
  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  moveValue.textContent = `${state.moves}/${state.limit}`;
  stabilityValue.textContent = String(stabilityScore());
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }

  startRun(1);
});

testButton.addEventListener("click", testSample);
resetButton.addEventListener("click", resetSample);

document.addEventListener("keydown", (event) => {
  const index = Number(event.key) - 1;

  if (index >= 0 && index < state.cards.length) {
    event.preventDefault();
    chooseCard(index);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    testSample();
  }
});

render();
