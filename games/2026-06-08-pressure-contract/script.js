const roundEl = document.querySelector("#round");
const stageEl = document.querySelector("#stage");
const tokensEl = document.querySelector("#tokens");
const targetsEl = document.querySelector("#targets");
const metersEl = document.querySelector("#meters");
const clausesEl = document.querySelector("#clauses");
const statusEl = document.querySelector("#status");
const checkBtn = document.querySelector("#check");
const resetBtn = document.querySelector("#reset");
const restartBtn = document.querySelector("#restart");

const metricNames = ["안정", "속도", "감사"];
const clauses = [
  { name: "완충 조항", note: "안정 크게 증가, 속도 소폭 감소", effect: [7, -2, 1] },
  { name: "가속 조항", note: "속도 크게 증가, 감사 소폭 감소", effect: [-1, 7, -2] },
  { name: "감사 조항", note: "감사 크게 증가, 안정 소폭 증가", effect: [2, -1, 6] }
];

const state = {
  round: 1,
  stage: 1,
  stagesNeeded: 2,
  budget: 7,
  base: [35, 35, 35],
  targets: [],
  allocation: [0, 0, 0],
  solution: [0, 0, 0]
};

function config() {
  return {
    stagesNeeded: Math.min(4, 2 + Math.floor(state.round / 2)),
    budget: Math.min(11, 6 + state.round),
    slack: Math.max(2, 5 - Math.floor(state.round / 2))
  };
}

function seeded(index, salt) {
  const value = Math.sin(index * 47.13 + salt * 23.91) * 10000;
  return value - Math.floor(value);
}

function makeSolution(budget) {
  const salt = state.round * 19 + state.stage * 31;
  const first = 1 + Math.floor(seeded(1, salt) * Math.max(2, budget - 3));
  const second = 1 + Math.floor(seeded(2, salt) * Math.max(2, budget - first - 1));
  const third = Math.max(1, budget - first - second);
  return [first, second, third];
}

function valuesFor(allocation) {
  return allocation.reduce((values, amount, index) => {
    clauses[index].effect.forEach((delta, metric) => {
      values[metric] += delta * amount;
    });
    return values;
  }, state.base.slice()).map((value) => Math.max(0, Math.min(100, Math.round(value))));
}

function startContract(message = "조항에 토큰을 배치해 목표 범위를 맞추세요.") {
  const next = config();
  state.stagesNeeded = next.stagesNeeded;
  state.budget = next.budget;
  state.base = [
    28 + state.round * 2,
    30 + state.stage * 2,
    29 + Math.floor(state.round / 2)
  ];
  state.solution = makeSolution(state.budget);
  state.allocation = [0, 0, 0];
  const solved = valuesFor(state.solution);
  state.targets = solved.map((value) => ({
    low: Math.max(0, value - next.slack),
    high: Math.min(100, value + next.slack)
  }));
  setStatus(message);
  render();
}

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`.trim();
}

function usedTokens() {
  return state.allocation.reduce((sum, value) => sum + value, 0);
}

function adjustClause(index, delta) {
  const next = state.allocation[index] + delta;
  if (next < 0 || usedTokens() + delta > state.budget) {
    return;
  }
  state.allocation[index] = next;
  render();
}

function inRange() {
  const values = valuesFor(state.allocation);
  return values.every((value, index) => value >= state.targets[index].low && value <= state.targets[index].high);
}

function checkContract() {
  if (inRange()) {
    if (state.stage >= state.stagesNeeded) {
      state.round += 1;
      state.stage = 1;
      startContract(`계약 묶음을 완료했습니다. 더 좁은 목표 범위의 라운드 ${state.round}로 바로 이동합니다.`);
      return;
    }
    state.stage += 1;
    startContract("계약이 통과되었습니다. 다음 계약으로 넘어갑니다.");
    return;
  }

  if (usedTokens() >= state.budget) {
    state.round = 1;
    state.stage = 1;
    startContract("토큰을 모두 썼지만 목표 범위에 맞지 않았습니다. 라운드 1로 돌아갑니다.");
    return;
  }

  setStatus("아직 목표 범위가 아닙니다. 남은 토큰으로 부족한 지표를 보정하세요.", "bad");
}

function resetCurrent() {
  state.allocation = [0, 0, 0];
  setStatus("현재 계약의 토큰 배치를 초기화했습니다.");
  render();
}

function resetRun() {
  state.round = 1;
  state.stage = 1;
  startContract("라운드 1부터 다시 시작합니다.");
}

function render() {
  const values = valuesFor(state.allocation);
  roundEl.textContent = state.round;
  stageEl.textContent = `${state.stage}/${state.stagesNeeded}`;
  tokensEl.textContent = state.budget - usedTokens();
  targetsEl.innerHTML = "";
  metersEl.innerHTML = "";
  clausesEl.innerHTML = "";

  metricNames.forEach((name, index) => {
    const target = document.createElement("div");
    target.className = "target";
    target.textContent = `${name} ${state.targets[index].low}~${state.targets[index].high}`;
    targetsEl.appendChild(target);

    const meter = document.createElement("div");
    meter.className = "meter";
    const ok = values[index] >= state.targets[index].low && values[index] <= state.targets[index].high;
    meter.innerHTML = `<div class="meter-head"><span>${name}</span><strong>${values[index]}</strong></div><div class="track"><i style="width:${values[index]}%;background:${ok ? "var(--accent)" : "var(--warn)"}"></i></div>`;
    metersEl.appendChild(meter);
  });

  clauses.forEach((clause, index) => {
    const row = document.createElement("div");
    row.className = "clause";
    row.innerHTML = `<div><strong>${clause.name}</strong><small>${clause.note}</small></div>`;
    const controls = document.createElement("div");
    controls.className = "token-buttons";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    minus.addEventListener("click", () => adjustClause(index, -1));
    const count = document.createElement("span");
    count.className = "token-count";
    count.textContent = state.allocation[index];
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", () => adjustClause(index, 1));
    controls.append(minus, count, plus);
    row.appendChild(controls);
    clausesEl.appendChild(row);
  });
}

checkBtn.addEventListener("click", checkContract);
resetBtn.addEventListener("click", resetCurrent);
restartBtn.addEventListener("click", resetRun);
document.addEventListener("keydown", (event) => {
  const index = Number(event.key) - 1;
  if (index >= 0 && index < clauses.length) {
    adjustClause(index, 1);
  }
  if (event.key === "Enter") {
    checkContract();
  }
  if (event.key === "Backspace") {
    resetCurrent();
  }
});

startContract();
