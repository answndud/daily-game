"use strict";

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const KEY_TO_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const dom = {
  round: document.getElementById("roundValue"),
  core: document.getElementById("coreValue"),
  coreTotal: document.getElementById("coreTotalValue"),
  fault: document.getElementById("faultValue"),
  speed: document.getElementById("speedValue"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  startButton: document.getElementById("startButton"),
  resetButton: document.getElementById("resetButton"),
  directionButtons: Array.from(document.querySelectorAll("[data-dir]")),
};

const state = {
  phase: "idle",
  round: 1,
  faults: 0,
  puck: { x: 380, y: 380, vx: 0, vy: 0, r: 17 },
  cores: [],
  cracks: [],
  collected: 0,
  lastTime: 0,
  nextRoundTimer: 0,
  animationId: 0,
};

function coreCountFor(round) {
  return Math.min(8, 3 + round);
}

function crackCountFor(round) {
  return Math.min(7, 2 + Math.floor(round * 1.2));
}

function impulseFor(round) {
  return Math.max(105, 155 - round * 4);
}

function frictionFor(round) {
  return Math.max(0.988, 0.994 - round * 0.0006);
}

function startRound(round = 1) {
  stopTimers();
  state.phase = "running";
  state.round = round;
  state.faults = 0;
  state.collected = 0;
  state.puck = { x: 380, y: 380, vx: 0, vy: 0, r: Math.max(13, 18 - round * 0.4) };
  state.cores = makeSpots(coreCountFor(round), 16, []);
  state.cracks = makeSpots(crackCountFor(round), 24, state.cores);
  state.lastTime = performance.now();
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 펄스로 관성을 조절해 코어를 모두 회수하세요.`);
  renderHud();
  ensureLoop();
}

function stopTimers() {
  if (state.nextRoundTimer) {
    window.clearTimeout(state.nextRoundTimer);
    state.nextRoundTimer = 0;
  }
}

function ensureLoop() {
  if (!state.animationId) {
    state.animationId = window.requestAnimationFrame(loop);
  }
}

function loop(time) {
  state.animationId = window.requestAnimationFrame(loop);
  const dt = Math.min(0.035, (time - state.lastTime) / 1000 || 0.016);
  state.lastTime = time;

  if (state.phase === "running") {
    update(dt);
  }
  draw();
}

function update(dt) {
  const puck = state.puck;
  puck.x += puck.vx * dt;
  puck.y += puck.vy * dt;
  puck.vx *= Math.pow(frictionFor(state.round), dt * 60);
  puck.vy *= Math.pow(frictionFor(state.round), dt * 60);

  bounceWalls();
  collectCores();
  checkCracks();
  renderHud();
}

function bounceWalls() {
  const puck = state.puck;
  const min = 32 + puck.r;
  const max = canvas.width - 32 - puck.r;

  if (puck.x < min || puck.x > max) {
    puck.x = Math.max(min, Math.min(max, puck.x));
    puck.vx *= -0.78;
  }
  if (puck.y < min || puck.y > max) {
    puck.y = Math.max(min, Math.min(max, puck.y));
    puck.vy *= -0.78;
  }
}

function collectCores() {
  for (const core of state.cores) {
    if (!core.done && distance(state.puck, core) < state.puck.r + core.r) {
      core.done = true;
      state.collected += 1;
      setMessage(`코어 회수. ${state.cores.length - state.collected}개 남았습니다.`);
    }
  }

  if (state.collected >= state.cores.length) {
    clearRound();
  }
}

function checkCracks() {
  for (const crack of state.cracks) {
    if (crack.cooldown > 0) {
      crack.cooldown -= 1;
      continue;
    }
    if (distance(state.puck, crack) < state.puck.r + crack.r) {
      crack.cooldown = 45;
      state.faults += 1;
      state.puck.vx *= -0.5;
      state.puck.vy *= -0.5;
      setMessage(`균열 접촉 ${state.faults}/3. 실패하면 라운드 1로 돌아갑니다.`);
      if (state.faults >= 3) {
        failRun();
      }
      return;
    }
  }
}

function pulse(dirName) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }

  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }

  const dir = DIRS[dirName];
  if (!dir) {
    return;
  }

  const force = impulseFor(state.round);
  state.puck.vx += dir.x * force;
  state.puck.vy += dir.y * force;
  const maxSpeed = 470 + state.round * 15;
  const speed = Math.hypot(state.puck.vx, state.puck.vy);
  if (speed > maxSpeed) {
    state.puck.vx = (state.puck.vx / speed) * maxSpeed;
    state.puck.vy = (state.puck.vy / speed) * maxSpeed;
  }
  setMessage(`${dirName.toUpperCase()} 펄스 적용. 다음 충돌 경로를 확인하세요.`);
}

function clearRound() {
  state.phase = "cleared";
  renderHud();
  showOverlay(
    "클리어",
    `라운드 ${state.round} 코어 회수 완료`,
    "다음 라운드는 코어와 균열이 늘고 펄스가 조금 약해집니다. 곧 자동으로 시작합니다.",
    "다음 라운드"
  );
  setMessage(`라운드 ${state.round + 1}로 이동합니다.`);
  state.nextRoundTimer = window.setTimeout(() => startRound(state.round + 1), 900);
}

function failRun() {
  state.phase = "failed";
  stopTimers();
  renderHud();
  showOverlay(
    "실패",
    "균열 충돌이 누적됐습니다",
    "이번 run은 종료됩니다. 다시 시작하면 라운드 1부터 관성 조절을 다시 시작합니다.",
    "라운드 1 재시작"
  );
  setMessage("실패: 라운드 1로 돌아갑니다.");
}

function makeSpots(count, radius, occupied) {
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard < 1000) {
    guard += 1;
    const spot = {
      x: 70 + Math.random() * (canvas.width - 140),
      y: 70 + Math.random() * (canvas.height - 140),
      r: radius,
      done: false,
      cooldown: 0,
    };
    if (distance(spot, { x: 380, y: 380 }) < 95) {
      continue;
    }
    if ([...occupied, ...spots].every((other) => distance(spot, other) > radius + other.r + 42)) {
      spots.push(spot);
    }
  }
  return spots;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArena();
  drawCores();
  drawCracks();
  drawPuck();
}

function drawArena() {
  ctx.fillStyle = "#fbfaf5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d9d5c9";
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

  ctx.strokeStyle = "rgba(32, 32, 29, 0.06)";
  ctx.lineWidth = 1;
  for (let line = 80; line < canvas.width; line += 80) {
    ctx.beginPath();
    ctx.moveTo(line, 32);
    ctx.lineTo(line, canvas.height - 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(32, line);
    ctx.lineTo(canvas.width - 32, line);
    ctx.stroke();
  }
}

function drawCores() {
  for (const core of state.cores) {
    if (core.done) {
      continue;
    }
    ctx.beginPath();
    ctx.fillStyle = "#dfe8dd";
    ctx.strokeStyle = "#6a7352";
    ctx.lineWidth = 2;
    ctx.arc(core.x, core.y, core.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = "#6a7352";
    ctx.arc(core.x, core.y, core.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCracks() {
  for (const crack of state.cracks) {
    ctx.save();
    ctx.translate(crack.x, crack.y);
    ctx.strokeStyle = crack.cooldown > 0 ? "rgba(150, 59, 51, 0.35)" : "#963b33";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-crack.r, -crack.r * 0.2);
    ctx.lineTo(-crack.r * 0.25, crack.r * 0.1);
    ctx.lineTo(0, -crack.r * 0.7);
    ctx.lineTo(crack.r * 0.25, crack.r * 0.2);
    ctx.lineTo(crack.r, crack.r * 0.05);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPuck() {
  const puck = state.puck;
  ctx.beginPath();
  ctx.fillStyle = "#fffefa";
  ctx.strokeStyle = "#24231f";
  ctx.lineWidth = 3;
  ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "#536a76";
  ctx.lineWidth = 2;
  ctx.moveTo(puck.x, puck.y);
  ctx.lineTo(puck.x + puck.vx * 0.16, puck.y + puck.vy * 0.16);
  ctx.stroke();
}

function renderHud() {
  dom.round.textContent = String(state.round);
  dom.core.textContent = String(state.collected);
  dom.coreTotal.textContent = String(state.cores.length);
  dom.fault.textContent = String(state.faults);
  dom.speed.textContent = (Math.hypot(state.puck.vx, state.puck.vy) / 100).toFixed(1);
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

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function handleStart() {
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  startRound(1);
}

dom.directionButtons.forEach((button) => {
  button.addEventListener("click", () => pulse(button.dataset.dir));
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

  const dir = KEY_TO_DIR[event.key] || KEY_TO_DIR[event.key.toLowerCase()];
  if (dir) {
    event.preventDefault();
    pulse(dir);
  }
});

renderHud();
draw();
