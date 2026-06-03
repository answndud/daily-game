const roundEl = document.querySelector("#round");
const stepEl = document.querySelector("#step");
const faultsEl = document.querySelector("#faults");
const trustText = document.querySelector("#trustText");
const loadText = document.querySelector("#loadText");
const traceText = document.querySelector("#traceText");
const trustBar = document.querySelector("#trustBar");
const loadBar = document.querySelector("#loadBar");
const traceBar = document.querySelector("#traceBar");
const eventType = document.querySelector("#eventType");
const eventTitle = document.querySelector("#eventTitle");
const eventBody = document.querySelector("#eventBody");
const hintEl = document.querySelector("#hint");
const statusEl = document.querySelector("#status");
const restartBtn = document.querySelector("#restart");
const buttons = {
  quarantine: document.querySelector("#quarantine"),
  reroute: document.querySelector("#reroute"),
  pass: document.querySelector("#pass")
};

const actions = {
  quarantine: { label: "격리", trust: 6, load: 10, trace: 5 },
  reroute: { label: "전환", trust: -2, load: -7, trace: 6 },
  pass: { label: "통과", trust: 4, load: -3, trace: -8 }
};

const templates = [
  {
    type: "서명 불일치",
    title: "인증 토큰의 발급자와 요청 출처가 다릅니다.",
    body: "추적성은 낮지만 부하는 이미 높습니다. 잘못 넘기면 신뢰도가 크게 흔들립니다.",
    rule: "추적성이 낮은 보안 사건은 격리해야 합니다.",
    ideal: "quarantine",
    penalty: { trust: -16, load: 4, trace: -8 }
  },
  {
    type: "트래픽 폭주",
    title: "정상 요청이 갑자기 몰리며 큐가 길어졌습니다.",
    body: "신뢰도는 유지되고 있지만 부하가 빠르게 상승합니다. 전체 차단은 비용이 큽니다.",
    rule: "부하가 높은 정상 흐름은 전환해야 합니다.",
    ideal: "reroute",
    penalty: { trust: -6, load: 14, trace: -2 }
  },
  {
    type: "검증된 배치",
    title: "서명과 추적 로그가 모두 일치하는 배치 작업입니다.",
    body: "부하가 낮고 출처가 명확합니다. 과한 처리는 처리량을 떨어뜨립니다.",
    rule: "검증된 낮은 위험 사건은 통과시켜야 합니다.",
    ideal: "pass",
    penalty: { trust: -5, load: 11, trace: 2 }
  },
  {
    type: "익명 경유",
    title: "경유 노드가 많아 원 요청자를 바로 확인할 수 없습니다.",
    body: "추적성이 약한데 요청량도 일정합니다. 먼저 흔적을 남겨야 합니다.",
    rule: "출처가 흐린 사건은 전환해 추적성을 올립니다.",
    ideal: "reroute",
    penalty: { trust: -10, load: 8, trace: -10 }
  },
  {
    type: "핵심 알림",
    title: "중요 알림이 지연 없이 전달되어야 합니다.",
    body: "신뢰도와 추적성이 충분하면 흐름을 막지 않는 편이 안전합니다.",
    rule: "신뢰 가능한 핵심 알림은 통과시킵니다.",
    ideal: "pass",
    penalty: { trust: -8, load: 10, trace: -4 }
  },
  {
    type: "중복 명령",
    title: "같은 명령이 짧은 간격으로 반복 접수되었습니다.",
    body: "부하는 낮아 보여도 중복 실행은 신뢰도를 훼손합니다.",
    rule: "중복 명령은 격리해 재검사합니다.",
    ideal: "quarantine",
    penalty: { trust: -14, load: 6, trace: -3 }
  }
];

const state = {
  round: 1,
  step: 0,
  faults: 0,
  trust: 58,
  load: 42,
  trace: 54,
  events: []
};

function config() {
  return {
    total: Math.min(11, 6 + state.round),
    maxFaults: Math.max(1, 3 - Math.floor(state.round / 3)),
    low: Math.min(28, 18 + state.round * 2),
    high: Math.max(72, 84 - state.round * 2)
  };
}

function pickEvents() {
  const total = config().total;
  return Array.from({ length: total }, (_, index) => {
    const source = templates[(index * 2 + state.round) % templates.length];
    return { ...source, serial: index + 1 };
  });
}

function resetRun() {
  state.round = 1;
  startRound("라운드 1부터 다시 시작합니다.");
}

function startRound(message = "사건 조건을 읽고 올바른 분기를 선택하세요.") {
  state.step = 0;
  state.faults = 0;
  state.trust = 56 + Math.min(8, state.round);
  state.load = 40 + Math.min(10, state.round * 2);
  state.trace = 52;
  state.events = pickEvents();
  setStatus(message);
  render();
}

function clampMetric(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function applyDelta(delta) {
  state.trust = clampMetric(state.trust + delta.trust);
  state.load = clampMetric(state.load + delta.load);
  state.trace = clampMetric(state.trace + delta.trace);
}

function choose(actionKey) {
  const current = state.events[state.step];
  if (!current) {
    return;
  }

  const picked = actions[actionKey];
  applyDelta(picked);

  if (actionKey !== current.ideal) {
    state.faults += 1;
    applyDelta(current.penalty);
    setStatus(`오판입니다. 이 사건은 '${actions[current.ideal].label}'가 맞습니다. 지표가 흔들렸습니다.`);
  } else {
    setStatus(`정확합니다. '${picked.label}' 분기로 사건을 안정 처리했습니다.`);
  }

  state.step += 1;
  evaluate();
  render();
}

function isMetricUnsafe() {
  const { low, high } = config();
  return state.trust < low || state.trace < low || state.load > high;
}

function evaluate() {
  const limit = config();
  if (state.faults >= limit.maxFaults || isMetricUnsafe()) {
    state.round = 1;
    state.step = 0;
    state.faults = 0;
    state.trust = 58;
    state.load = 42;
    state.trace = 54;
    state.events = pickEvents();
    setStatus("시스템 지표가 한계를 벗어났습니다. 실패 처리되어 라운드 1로 돌아갑니다.");
    return;
  }

  if (state.step >= state.events.length) {
    state.round += 1;
    startRound(`프로토콜 묶음을 완료했습니다. 더 좁은 안정권의 라운드 ${state.round}로 바로 이동합니다.`);
  }
}

function barColor(metric, value) {
  const { low, high } = config();
  if ((metric === "load" && value > high - 8) || (metric !== "load" && value < low + 8)) {
    return "var(--bad)";
  }
  if ((metric === "load" && value > high - 18) || (metric !== "load" && value < low + 18)) {
    return "var(--warn)";
  }
  return "var(--ok)";
}

function renderBar(el, metric, value) {
  el.style.width = `${value}%`;
  el.style.backgroundColor = barColor(metric, value);
}

function setStatus(message) {
  statusEl.textContent = message;
}

function render() {
  const limit = config();
  const current = state.events[state.step] || state.events[0];
  roundEl.textContent = state.round;
  stepEl.textContent = `${Math.min(state.step + 1, state.events.length)}/${state.events.length}`;
  faultsEl.textContent = `${state.faults}/${limit.maxFaults}`;
  trustText.textContent = state.trust;
  loadText.textContent = state.load;
  traceText.textContent = state.trace;
  renderBar(trustBar, "trust", state.trust);
  renderBar(loadBar, "load", state.load);
  renderBar(traceBar, "trace", state.trace);

  eventType.textContent = `사건 ${current.serial} · ${current.type}`;
  eventTitle.textContent = current.title;
  eventBody.textContent = current.body;
  hintEl.textContent = current.rule;
}

buttons.quarantine.addEventListener("click", () => choose("quarantine"));
buttons.reroute.addEventListener("click", () => choose("reroute"));
buttons.pass.addEventListener("click", () => choose("pass"));
restartBtn.addEventListener("click", resetRun);

document.addEventListener("keydown", (event) => {
  if (event.key === "1") choose("quarantine");
  if (event.key === "2") choose("reroute");
  if (event.key === "3") choose("pass");
});

startRound();
