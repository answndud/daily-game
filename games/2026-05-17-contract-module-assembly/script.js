"use strict";

const dom = {
  round: document.getElementById("roundValue"),
  score: document.getElementById("scoreValue"),
  goal: document.getElementById("goalValue"),
  cost: document.getElementById("costValue"),
  budget: document.getElementById("budgetValue"),
  pick: document.getElementById("pickValue"),
  requirements: document.getElementById("requirementList"),
  results: document.getElementById("resultList"),
  modules: document.getElementById("moduleGrid"),
  submit: document.getElementById("submitButton"),
  clear: document.getElementById("clearButton"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  start: document.getElementById("startButton"),
  reset: document.getElementById("resetButton"),
};

const stats = [
  { key: "power", label: "전력" },
  { key: "cooling", label: "냉각" },
  { key: "trust", label: "신뢰" },
];

const moduleNames = ["안정 코어", "냉각 핀", "검증 회로", "가속 릴레이", "차폐 격자", "절약 버스", "복구 노드", "정밀 밸브"];

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 4,
  budget: 12,
  requirements: {},
  modules: [],
  selected: new Set(),
};

function goalFor(round) {
  return Math.min(8, 3 + round);
}

function budgetFor(round) {
  return Math.max(10, 13 - Math.floor(round / 3));
}

function widthFor(round) {
  return Math.max(14, 28 - round * 2);
}

function startRound(round = 1) {
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.budget = budgetFor(round);
  newContract();
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: ${state.goal}개의 계약을 승인하세요.`);
}

function newContract() {
  state.selected.clear();
  state.requirements = buildRequirements();
  state.modules = buildModules();
  ensureSolvable();
  render();
}

function buildRequirements() {
  const width = widthFor(state.round);
  return Object.fromEntries(stats.map((stat, index) => {
    const center = 42 + ((state.score * 11 + state.round * 7 + index * 17) % 23);
    const min = Math.max(14, center - width / 2);
    const max = Math.min(86, center + width / 2);
    return [stat.key, { min: Math.round(min), max: Math.round(max) }];
  }));
}

function buildModules() {
  const spread = 10 + Math.floor(state.round * 1.2);
  return Array.from({ length: 6 }, (_, index) => {
    const sign = index % 2 === 0 ? 1 : -1;
    const power = randomEffect(spread, sign);
    const cooling = randomEffect(spread, -sign);
    const trust = randomEffect(spread, index % 3 === 0 ? -1 : 1);
    const cost = 3 + Math.floor(Math.random() * 5);
    return {
      id: index + 1,
      name: moduleNames[(state.round + state.score + index) % moduleNames.length],
      power,
      cooling,
      trust,
      cost,
    };
  });
}

function randomEffect(spread, sign) {
  const value = 3 + Math.floor(Math.random() * spread);
  return value * sign;
}

function ensureSolvable() {
  const targets = Object.fromEntries(stats.map((stat) => {
    const req = state.requirements[stat.key];
    return [stat.key, Math.round((req.min + req.max) / 2)];
  }));
  const base = { power: 50, cooling: 50, trust: 50 };
  const needed = {
    power: targets.power - base.power,
    cooling: targets.cooling - base.cooling,
    trust: targets.trust - base.trust,
  };
  const solution = [
    makeModule(1, "기준 코어", needed.power, 0, 0, 3),
    makeModule(2, "균형 냉각기", 0, needed.cooling, 0, 3),
    makeModule(3, "신뢰 서명기", 0, 0, needed.trust, 3),
  ];
  const noise = state.modules.slice(3).map((module, offset) => ({ ...module, id: offset + 4 }));
  state.modules = shuffle([...solution, ...noise]).map((module, index) => ({ ...module, id: index + 1 }));
}

function makeModule(id, name, power, cooling, trust, cost) {
  return { id, name, power, cooling, trust, cost };
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function totals() {
  const picked = state.modules.filter((module) => state.selected.has(module.id));
  return picked.reduce((sum, module) => ({
    power: sum.power + module.power,
    cooling: sum.cooling + module.cooling,
    trust: sum.trust + module.trust,
    cost: sum.cost + module.cost,
  }), { power: 50, cooling: 50, trust: 50, cost: 0 });
}

function toggleModule(id) {
  if (state.phase !== "running") {
    startRound(1);
    return;
  }
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else if (state.selected.size < 3) {
    state.selected.add(id);
  } else {
    setMessage("모듈은 최대 3개까지 선택할 수 있습니다.");
  }
  render();
}

function submitContract() {
  if (state.phase !== "running") {
    startRound(1);
    return;
  }
  const total = totals();
  const failed = stats.find((stat) => !inRange(total[stat.key], state.requirements[stat.key]));
  if (total.cost > state.budget) {
    failRun(`예산을 ${total.cost - state.budget} 초과했습니다.`);
    return;
  }
  if (failed) {
    const req = state.requirements[failed.key];
    failRun(`${failed.label} ${total[failed.key]}은 요구 범위 ${req.min}~${req.max} 밖입니다.`);
    return;
  }
  state.score += 1;
  if (state.score >= state.goal) {
    clearRound();
    return;
  }
  setMessage(`계약 승인. 남은 계약 ${state.goal - state.score}개.`);
  newContract();
}

function clearRound() {
  state.phase = "cleared";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "승인 완료";
  dom.overlayTitle.textContent = `라운드 ${state.round} 완료`;
  dom.overlayText.textContent = "다음 라운드는 조건 범위가 좁아지고 예산 압박이 커집니다.";
  dom.start.textContent = `라운드 ${state.round + 1}`;
  setMessage(`성공. 곧 라운드 ${state.round + 1}로 이동합니다.`);
  render();
  window.setTimeout(() => {
    if (state.phase === "cleared") {
      startRound(state.round + 1);
    }
  }, 900);
}

function failRun(reason) {
  state.phase = "failed";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "계약 반려";
  dom.overlayTitle.textContent = "라운드 1로 복귀";
  dom.overlayText.textContent = `${reason} 조건과 예산을 동시에 다시 계산하세요.`;
  dom.start.textContent = "라운드 1";
  setMessage("반려되면 진행도가 초기화됩니다. 라운드 1부터 다시 시작하세요.");
  render();
}

function inRange(value, req) {
  return value >= req.min && value <= req.max;
}

function render() {
  const total = totals();
  dom.round.textContent = String(state.round);
  dom.score.textContent = String(state.score);
  dom.goal.textContent = String(state.goal);
  dom.cost.textContent = String(total.cost);
  dom.budget.textContent = String(state.budget);
  dom.pick.textContent = String(state.selected.size);
  dom.requirements.replaceChildren(...stats.map((stat) => renderRequirement(stat, total)));
  dom.results.replaceChildren(...stats.map((stat) => renderResult(stat, total)));
  dom.modules.replaceChildren(...state.modules.map(renderModule));
}

function renderRequirement(stat, total) {
  const req = state.requirements[stat.key] || { min: 0, max: 100 };
  const row = document.createElement("div");
  row.className = "requirement";
  row.innerHTML = `
    <div class="range-top">
      <span>${stat.label}</span>
      <span>${req.min}~${req.max}</span>
    </div>
    <div class="range-bar" aria-hidden="true">
      <span class="range-window" style="--from: ${req.min}%; --width: ${req.max - req.min}%"></span>
      <span class="result-marker" style="--pos: ${clamp(total[stat.key], 0, 100)}%"></span>
    </div>
  `;
  return row;
}

function renderResult(stat, total) {
  const req = state.requirements[stat.key] || { min: 0, max: 100 };
  const ok = inRange(total[stat.key], req);
  const row = document.createElement("div");
  row.className = `result-row ${ok ? "ok" : "bad"}`;
  row.innerHTML = `
    <div class="result-top">
      <span>${stat.label}</span>
      <span>${total[stat.key]}</span>
    </div>
    <p class="range-label">${ok ? "조건 충족" : "범위 밖"}</p>
  `;
  return row;
}

function renderModule(module, index) {
  const selected = state.selected.has(module.id);
  const disabled = !selected && state.selected.size >= 3;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `module-card${selected ? " selected" : ""}${disabled ? " disabled" : ""}`;
  button.setAttribute("role", "listitem");
  button.setAttribute("aria-label", `${index + 1}번 ${module.name}, 비용 ${module.cost}, 전력 ${signed(module.power)}, 냉각 ${signed(module.cooling)}, 신뢰 ${signed(module.trust)}`);
  button.innerHTML = `
    <span class="module-head">
      <strong>${index + 1}. ${module.name}</strong>
      <span class="module-cost">비용 ${module.cost}</span>
    </span>
    <span class="module-effect">
      <span>전력 ${signed(module.power)}</span>
      <span>냉각 ${signed(module.cooling)}</span>
      <span>신뢰 ${signed(module.trust)}</span>
    </span>
  `;
  button.addEventListener("click", () => toggleModule(module.id));
  return button;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
dom.submit.addEventListener("click", submitContract);
dom.clear.addEventListener("click", () => {
  state.selected.clear();
  setMessage("선택을 비웠습니다.");
  render();
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "enter") {
    if (state.phase === "running") {
      submitContract();
    } else {
      handleStart();
    }
    return;
  }
  if (key === "escape") {
    startRound(1);
    return;
  }
  if (key === "backspace") {
    state.selected.clear();
    render();
    return;
  }
  const number = Number.parseInt(key, 10);
  if (Number.isFinite(number) && number >= 1 && number <= state.modules.length) {
    toggleModule(state.modules[number - 1].id);
  }
});

render();
