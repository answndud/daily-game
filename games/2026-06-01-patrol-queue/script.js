const zoneList = document.getElementById("zoneList");
const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const turnValue = document.getElementById("turnValue");
const peakValue = document.getElementById("peakValue");
const messageLine = document.getElementById("messageLine");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");

const zoneNames = ["동문", "저수조", "기록고", "발전실"];

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  turn: 0,
  limit: 10,
  zones: [],
  seed: 20260601,
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
  return Math.max(8, 12 - Math.floor(round / 3));
}

function makeZones() {
  return zoneNames.map((name, index) => ({
    name,
    risk: 18 + Math.floor(random() * 18) + index * 3,
    rise: 7 + Math.floor(random() * 5) + Math.floor(state.round / 2) + index,
    relief: 28 + Math.floor(random() * 8)
  }));
}

function peakRisk() {
  return Math.max(0, ...state.zones.map((zone) => zone.risk));
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.limit = limitFor(round);
  state.seed = (20260601 + round * 263) >>> 0;
  state.phase = "running";
  overlay.classList.add("hidden");
  startShift();
}

function startShift() {
  state.turn = 0;
  state.zones = makeZones();
  messageLine.textContent = `근무 ${state.score + 1}/${state.goal}: 가장 위험한 구역부터 순찰하세요.`;
  render();
}

function completeShift() {
  state.score += 1;

  if (state.score >= state.goal) {
    state.phase = "cleared";
    render();
    overlayTitle.textContent = `라운드 ${state.round} 완성`;
    overlayText.textContent = "다음 라운드는 위험 상승 속도가 빨라지고 순찰 여유가 줄어듭니다.";
    startButton.textContent = `라운드 ${state.round + 1} 시작`;
    messageLine.textContent = `라운드 ${state.round} 완료. 곧 다음 라운드로 이동합니다.`;
    overlay.classList.remove("hidden");
    state.nextTimer = setTimeout(() => startRun(state.round + 1), 1000);
    return;
  }

  messageLine.textContent = "근무 성공. 다음 순찰 큐를 불러옵니다.";
  state.nextTimer = setTimeout(startShift, 540);
}

function failRun(reason) {
  state.phase = "failed";
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = "순찰 실패";
  overlayText.textContent = `${reason} 라운드 1부터 다시 시작합니다.`;
  startButton.textContent = "라운드 1 다시 시작";
  messageLine.textContent = "실패했습니다. 라운드가 1로 초기화됩니다.";
  overlay.classList.remove("hidden");
}

function patrolZone(index) {
  if (state.phase !== "running") return;

  state.zones[index].risk = Math.max(0, state.zones[index].risk - state.zones[index].relief);

  state.zones.forEach((zone, zoneIndex) => {
    if (zoneIndex !== index) {
      const spike = random() < 0.18 + state.round * 0.01 ? 5 + Math.floor(random() * 7) : 0;
      zone.risk += zone.rise + spike;
    }
  });

  state.turn += 1;

  if (peakRisk() >= 100) {
    const failed = state.zones.find((zone) => zone.risk >= 100);
    failRun(`${failed.name} 위험도가 한계를 넘었습니다.`);
    return;
  }

  if (state.turn >= state.limit) {
    completeShift();
    return;
  }

  messageLine.textContent = `순찰 완료. 남은 순찰 ${state.limit - state.turn}회, 최고 위험 ${peakRisk()}.`;
  render();
}

function resetShift() {
  if (state.phase === "idle") {
    startRun(1);
    return;
  }

  if (state.phase !== "running") return;
  startShift();
}

function renderZones() {
  zoneList.innerHTML = "";

  state.zones.forEach((zone, index) => {
    const button = document.createElement("button");
    const level = zone.risk >= 75 ? "danger" : zone.risk >= 55 ? "warn" : "";
    button.type = "button";
    button.className = `zone ${level}`;
    button.setAttribute("aria-label", `${zone.name} 위험 ${zone.risk}, 상승 ${zone.rise}, 완화 ${zone.relief}`);
    button.innerHTML = `<div class="zone-head"><strong>${index + 1}. ${zone.name}</strong><span>상승 +${zone.rise} / 완화 -${zone.relief}</span></div><div class="track"><b style="width:${Math.min(100, zone.risk)}%"></b></div>`;
    button.addEventListener("click", () => patrolZone(index));
    zoneList.appendChild(button);
  });
}

function render() {
  renderZones();
  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  turnValue.textContent = `${state.turn}/${state.limit}`;
  peakValue.textContent = String(peakRisk());
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }

  startRun(1);
});

resetButton.addEventListener("click", resetShift);

document.addEventListener("keydown", (event) => {
  const index = Number(event.key) - 1;

  if (index >= 0 && index < state.zones.length) {
    event.preventDefault();
    patrolZone(index);
  }
});

render();
