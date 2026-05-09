"use strict";

const TRACKS = [
  { key: "order", label: "정돈도" },
  { key: "heat", label: "열기" },
  { key: "trust", label: "신뢰" },
];

const CARD_POOL = [
  {
    name: "중복 정리",
    text: "흩어진 항목을 묶지만 검토 열기가 조금 오른다.",
    delta: { order: 14, heat: 7, trust: -5 },
  },
  {
    name: "냉각 점검",
    text: "과열된 흐름을 낮추는 대신 정돈 속도가 느려진다.",
    delta: { order: -8, heat: -16, trust: 6 },
  },
  {
    name: "출처 보강",
    text: "신뢰를 올리지만 작업 대기열이 복잡해진다.",
    delta: { order: -7, heat: 6, trust: 16 },
  },
  {
    name: "빠른 병합",
    text: "정돈은 빨라지지만 품질 신호가 흔들린다.",
    delta: { order: 18, heat: 10, trust: -12 },
  },
  {
    name: "보류 선언",
    text: "열기를 낮추고 신뢰를 보전하지만 정돈도가 내려간다.",
    delta: { order: -12, heat: -14, trust: 8 },
  },
  {
    name: "샘플 검수",
    text: "신뢰를 세우고 과열을 낮추지만 정돈 이득은 작다.",
    delta: { order: 5, heat: -8, trust: 13 },
  },
  {
    name: "색인 재작성",
    text: "정돈과 신뢰가 오르지만 작업 열기가 크게 오른다.",
    delta: { order: 15, heat: 15, trust: 9 },
  },
  {
    name: "임시 동결",
    text: "열기는 낮추지만 정돈과 신뢰가 동시에 줄어든다.",
    delta: { order: -9, heat: -18, trust: -7 },
  },
];

const dom = {
  round: document.getElementById("roundValue"),
  score: document.getElementById("scoreValue"),
  target: document.getElementById("targetValue"),
  safe: document.getElementById("safeValue"),
  volatility: document.getElementById("volatilityValue"),
  orderValue: document.getElementById("orderValue"),
  heatValue: document.getElementById("heatValue"),
  trustValue: document.getElementById("trustValue"),
  orderFill: document.getElementById("orderFill"),
  heatFill: document.getElementById("heatFill"),
  trustFill: document.getElementById("trustFill"),
  cards: Array.from(document.querySelectorAll(".choice-card")),
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
  score: 0,
  target: 9,
  low: 20,
  high: 80,
  values: {
    order: 50,
    heat: 50,
    trust: 50,
  },
  cards: [],
  nextRoundTimer: 0,
};

function targetFor(round) {
  return Math.min(20, 7 + round * 2);
}

function volatilityFor(round) {
  return 1 + Math.floor((round - 1) / 2);
}

function safeBandFor(round) {
  const shrink = Math.min(8, Math.floor((round - 1) / 2) * 2);
  return { low: 20 + shrink, high: 80 - shrink };
}

function startRound(round = 1) {
  stopTimers();
  const band = safeBandFor(round);
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.target = targetFor(round);
  state.low = band.low;
  state.high = band.high;
  state.values = {
    order: 50,
    heat: 50,
    trust: 50,
  };
  state.cards = makeHand();
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 선택 후 세 지표가 ${state.low}-${state.high} 안에 남아야 합니다.`);
  render();
}

function stopTimers() {
  if (state.nextRoundTimer) {
    window.clearTimeout(state.nextRoundTimer);
    state.nextRoundTimer = 0;
  }
}

function makeHand() {
  const hand = [];
  const used = new Set();

  while (hand.length < 3) {
    const baseIndex = Math.floor(Math.random() * CARD_POOL.length);
    if (used.has(baseIndex)) {
      continue;
    }
    used.add(baseIndex);
    hand.push(scaleCard(CARD_POOL[baseIndex]));
  }

  if (!hand.some((card) => isSafeAfter(card.delta))) {
    hand[0] = makeStabilizerCard();
  }

  return hand;
}

function scaleCard(card) {
  const volatility = volatilityFor(state.round);
  const delta = {};
  for (const track of TRACKS) {
    const raw = card.delta[track.key];
    const direction = raw >= 0 ? 1 : -1;
    delta[track.key] = raw + direction * volatility * 2;
  }
  return {
    name: card.name,
    text: card.text,
    delta,
  };
}

function makeStabilizerCard() {
  const delta = {};
  for (const track of TRACKS) {
    const value = state.values[track.key];
    if (value < 42) {
      delta[track.key] = 12;
    } else if (value > 58) {
      delta[track.key] = -12;
    } else {
      delta[track.key] = track.key === "heat" ? -4 : 4;
    }
  }
  return {
    name: "균형 조정",
    text: "현재 상태를 기준으로 위험한 지표를 중앙으로 되돌린다.",
    delta,
  };
}

function chooseCard(index) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }

  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }

  const card = state.cards[index];
  if (!card) {
    return;
  }

  for (const track of TRACKS) {
    state.values[track.key] = clamp(state.values[track.key] + card.delta[track.key], 0, 100);
  }

  const broken = TRACKS.find((track) => !isTrackSafe(track.key));
  if (broken) {
    failRun(broken.label);
    return;
  }

  state.score += 1;
  if (state.score >= state.target) {
    clearRound();
    return;
  }

  state.cards = makeHand();
  setMessage(`${card.name} 승인. ${state.target - state.score}번 더 안정적으로 승인하세요.`);
  render();
}

function clearRound() {
  state.phase = "cleared";
  render();
  showOverlay(
    "클리어",
    `라운드 ${state.round} 승인 완료`,
    "다음 라운드는 목표 승인 수가 늘고 안전 구간이 좁아집니다. 곧 자동으로 시작합니다.",
    "다음 라운드"
  );
  setMessage(`라운드 ${state.round + 1}로 이동합니다.`);
  state.nextRoundTimer = window.setTimeout(() => startRound(state.round + 1), 900);
}

function failRun(label) {
  state.phase = "failed";
  stopTimers();
  render();
  showOverlay(
    "실패",
    `${label} 지표가 안전 구간을 벗어났습니다`,
    "이번 run은 종료됩니다. 다시 시작하면 라운드 1부터 세 지표를 관리합니다.",
    "라운드 1 재시작"
  );
  setMessage(`실패: ${label} 관리 실패로 라운드 1로 돌아갑니다.`);
}

function isSafeAfter(delta) {
  return TRACKS.every((track) => {
    const next = clamp(state.values[track.key] + delta[track.key], 0, 100);
    return next >= state.low && next <= state.high;
  });
}

function isTrackSafe(key) {
  return state.values[key] >= state.low && state.values[key] <= state.high;
}

function render() {
  dom.round.textContent = String(state.round);
  dom.score.textContent = String(state.score);
  dom.target.textContent = String(state.target);
  dom.safe.textContent = `${state.low}-${state.high}`;
  dom.volatility.textContent = String(volatilityFor(state.round));

  renderMeter("order", dom.orderValue, dom.orderFill);
  renderMeter("heat", dom.heatValue, dom.heatFill);
  renderMeter("trust", dom.trustValue, dom.trustFill);

  for (let index = 0; index < dom.cards.length; index += 1) {
    renderCard(dom.cards[index], state.cards[index], index);
  }
}

function renderMeter(key, valueNode, fillNode) {
  const value = state.values[key];
  valueNode.textContent = String(value);
  fillNode.style.width = `${value}%`;
  const safe = isTrackSafe(key);
  valueNode.style.color = safe ? "" : "var(--danger)";
}

function renderCard(node, card, index) {
  if (!card) {
    node.innerHTML = "";
    node.setAttribute("aria-label", `${index + 1}번 카드 없음`);
    return;
  }

  const deltas = TRACKS.map((track) => {
    const value = card.delta[track.key];
    const signed = value > 0 ? `+${value}` : String(value);
    const tone = value >= 0 ? "good" : "bad";
    return `<span class="delta ${tone}"><span>${track.label}</span><b>${signed}</b></span>`;
  }).join("");

  node.innerHTML = `
    <span class="card-index">Card ${index + 1}</span>
    <span class="card-name">${card.name}</span>
    <p class="card-text">${card.text}</p>
    <span class="delta-list">${deltas}</span>
  `;
  node.setAttribute("aria-label", `${index + 1}번 카드 ${card.name}`);
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function handleStart() {
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  startRound(1);
}

dom.cards.forEach((button, index) => {
  button.addEventListener("click", () => chooseCard(index));
});

dom.startButton.addEventListener("click", handleStart);
dom.resetButton.addEventListener("click", () => startRound(1));

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleStart();
    return;
  }

  if (event.key === "Escape") {
    startRound(1);
    return;
  }

  const index = Number(event.key) - 1;
  if (index >= 0 && index < 3) {
    event.preventDefault();
    chooseCard(index);
  }
});

render();
