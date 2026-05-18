"use strict";

const dom = {
  round: document.getElementById("roundValue"),
  score: document.getElementById("scoreValue"),
  goal: document.getElementById("goalValue"),
  miss: document.getElementById("missValue"),
  tempo: document.getElementById("tempoValue"),
  tracks: document.getElementById("trackList"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  start: document.getElementById("startButton"),
  reset: document.getElementById("resetButton"),
  channelButtons: [...document.querySelectorAll("[data-channel]")],
};

const HIT_LINE = 0.62;
const HIT_WINDOW = 0.045;
const REMOVE_X = 0.82;
const SPAWN_X = -0.08;

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 12,
  misses: 0,
  pulses: [],
  nextId: 1,
  spawnClock: 0,
  lastTime: 0,
  raf: 0,
};

function goalFor(round) {
  return 10 + round * 2;
}

function speedFor(round) {
  return 0.245 + round * 0.018;
}

function intervalFor(round) {
  return Math.max(0.46, 0.86 - round * 0.045);
}

function startRound(round = 1) {
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.misses = 0;
  state.pulses = [];
  state.nextId = 1;
  state.spawnClock = 0.15;
  state.lastTime = performance.now();
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 박자선에 맞춰 ${state.goal}번 조율하세요.`);
  render();
}

function update(now) {
  const dt = Math.min(0.05, Math.max(0, (now - state.lastTime) / 1000 || 0));
  state.lastTime = now;
  if (state.phase === "running") {
    state.spawnClock -= dt;
    if (state.spawnClock <= 0) {
      spawnPulse();
      state.spawnClock = intervalFor(state.round) * (0.75 + Math.random() * 0.55);
    }
    const speed = speedFor(state.round);
    for (const pulse of state.pulses) {
      pulse.x += speed * dt;
    }
    const missed = state.pulses.filter((pulse) => !pulse.scored && pulse.x > HIT_LINE + HIT_WINDOW && !pulse.countedMiss);
    for (const pulse of missed) {
      pulse.countedMiss = true;
      addMiss(`채널 ${pulse.channel + 1} 펄스를 놓쳤습니다.`);
    }
    state.pulses = state.pulses.filter((pulse) => pulse.x < REMOVE_X);
    render();
  }
  state.raf = window.requestAnimationFrame(update);
}

function spawnPulse() {
  const channel = pickChannel();
  state.pulses.push({
    id: state.nextId,
    channel,
    x: SPAWN_X,
    scored: false,
    countedMiss: false,
  });
  state.nextId += 1;
}

function pickChannel() {
  const recent = state.pulses.slice(-2).map((pulse) => pulse.channel);
  const candidates = [0, 1, 2].filter((channel) => recent.filter((item) => item === channel).length < 2);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function chooseChannel(channel) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  flashButton(channel);
  const candidates = state.pulses
    .filter((pulse) => pulse.channel === channel && !pulse.scored)
    .map((pulse) => ({ pulse, gap: Math.abs(pulse.x - HIT_LINE) }))
    .sort((a, b) => a.gap - b.gap);
  const nearest = candidates[0];
  if (!nearest || nearest.gap > HIT_WINDOW) {
    addMiss(`채널 ${channel + 1} 타이밍이 맞지 않았습니다.`);
    return;
  }
  nearest.pulse.scored = true;
  state.score += 1;
  setMessage(`정확한 조율. 남은 목표 ${Math.max(0, state.goal - state.score)}번.`);
  if (state.score >= state.goal) {
    clearRound();
  }
  render();
}

function addMiss(reason) {
  if (state.phase !== "running") {
    return;
  }
  state.misses += 1;
  setMessage(reason);
  if (state.misses >= 3) {
    failRun(reason);
  }
}

function clearRound() {
  state.phase = "cleared";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "조율 성공";
  dom.overlayTitle.textContent = `라운드 ${state.round} 완료`;
  dom.overlayText.textContent = "다음 라운드는 펄스가 더 빠르고 간격이 촘촘해집니다.";
  dom.start.textContent = `라운드 ${state.round + 1}`;
  setMessage(`성공. 곧 라운드 ${state.round + 1}로 이동합니다.`);
  window.setTimeout(() => {
    if (state.phase === "cleared") {
      startRound(state.round + 1);
    }
  }, 900);
}

function failRun(reason) {
  state.phase = "failed";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "조율 실패";
  dom.overlayTitle.textContent = "라운드 1로 복귀";
  dom.overlayText.textContent = `${reason} 박자선 안에 들어온 펄스만 선택하세요.`;
  dom.start.textContent = "라운드 1";
  setMessage("실패하면 진행도가 초기화됩니다. 라운드 1부터 다시 시작하세요.");
  render();
}

function render() {
  dom.round.textContent = String(state.round);
  dom.score.textContent = String(state.score);
  dom.goal.textContent = String(state.goal);
  dom.miss.textContent = String(state.misses);
  dom.tempo.textContent = tempoLabel(state.round);
  dom.tracks.replaceChildren(...[0, 1, 2].map(renderTrack));
}

function renderTrack(channel) {
  const track = document.createElement("div");
  track.className = "track";
  track.innerHTML = `<span class="track-label">${channel + 1} 채널</span>`;
  const pulses = state.pulses.filter((pulse) => pulse.channel === channel);
  for (const pulse of pulses) {
    const node = document.createElement("span");
    const gap = Math.abs(pulse.x - HIT_LINE);
    node.className = `pulse${pulse.scored ? " hit" : ""}${gap < HIT_WINDOW ? " danger" : ""}`;
    node.style.setProperty("--x", `${pulse.x * 100}%`);
    node.style.setProperty("--size", `${pulse.scored ? 30 : 24}px`);
    track.appendChild(node);
  }
  track.addEventListener("pointerdown", () => chooseChannel(channel));
  return track;
}

function tempoLabel(round) {
  if (round >= 7) {
    return "매우 빠름";
  }
  if (round >= 4) {
    return "빠름";
  }
  if (round >= 2) {
    return "보통";
  }
  return "느림";
}

function flashButton(channel) {
  const button = dom.channelButtons[channel];
  if (!button) {
    return;
  }
  button.classList.add("flash");
  window.setTimeout(() => button.classList.remove("flash"), 100);
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
for (const button of dom.channelButtons) {
  button.addEventListener("click", () => chooseChannel(Number(button.dataset.channel)));
}

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
  const map = { "1": 0, "2": 1, "3": 2, q: 0, w: 1, e: 2 };
  if (Object.prototype.hasOwnProperty.call(map, key)) {
    chooseChannel(map[key]);
  }
});

render();
state.lastTime = performance.now();
state.raf = window.requestAnimationFrame(update);
