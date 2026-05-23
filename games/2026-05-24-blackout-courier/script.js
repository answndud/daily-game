"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const dom = {
  round: document.getElementById("roundValue"),
  packets: document.getElementById("packetValue"),
  exposure: document.getElementById("exposureValue"),
  sentries: document.getElementById("sentryValue"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  overlayButton: document.getElementById("overlayButton"),
  start: document.getElementById("startButton"),
  restart: document.getElementById("restartButton"),
};

const world = { width: 800, height: 460 };
const keys = new Set();
let lastTime = 0;
let levelTimer = 0;

const state = {
  phase: "idle",
  round: 1,
  targetPackets: 3,
  collected: 0,
  exposure: 0,
  player: { x: 58, y: 230, radius: 12 },
  pointerTarget: null,
  packages: [],
  sentries: [],
  exit: { x: 744, y: 230, radius: 28 },
  nextTimer: 0,
};

function createRng(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function targetPacketsFor(round) {
  return Math.min(7, 2 + round);
}

function sentryCountFor(round) {
  return Math.min(6, 2 + Math.floor((round - 1) / 2));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(300, Math.floor(width * 0.575));
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio * width / world.width, 0, 0, ratio * height / world.height, 0, 0);
}

function startRun(round = 1) {
  window.clearTimeout(state.nextTimer);
  state.phase = "running";
  state.round = round;
  state.targetPackets = targetPacketsFor(round);
  state.collected = 0;
  state.exposure = 0;
  state.player = { x: 58, y: 230, radius: 12 };
  state.pointerTarget = null;
  buildLevel(round);
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 패킷 ${state.targetPackets}개를 회수한 뒤 출구로 이동하세요.`);
  renderHud();
}

function buildLevel(round) {
  const rng = createRng(20260524 + round * 7919);
  state.packages = [];
  state.sentries = [];

  const sentryTemplates = [
    { x: 230, y: 130, base: 0.4 },
    { x: 405, y: 330, base: 3.2 },
    { x: 585, y: 145, base: 1.9 },
    { x: 660, y: 335, base: 4.7 },
    { x: 165, y: 330, base: 5.6 },
    { x: 470, y: 90, base: 2.6 },
  ];

  for (let index = 0; index < sentryCountFor(round); index += 1) {
    const template = sentryTemplates[index];
    state.sentries.push({
      x: template.x,
      y: template.y,
      angle: template.base + rng() * 0.6,
      speed: (index % 2 === 0 ? 1 : -1) * (0.55 + round * 0.07 + rng() * 0.18),
      radius: Math.min(190, 124 + round * 9 + rng() * 22),
      width: Math.max(0.34, 0.56 - round * 0.015),
    });
  }

  while (state.packages.length < state.targetPackets) {
    const candidate = {
      x: 145 + rng() * 510,
      y: 58 + rng() * 344,
      radius: 11,
      taken: false,
    };

    if (distance(candidate, state.player) < 105 || distance(candidate, state.exit) < 95) continue;
    if (state.packages.some((item) => distance(item, candidate) < 72)) continue;
    state.packages.push(candidate);
  }
}

function setMessage(text) {
  dom.message.textContent = text;
}

function renderHud() {
  dom.round.textContent = String(state.round);
  dom.packets.textContent = `${state.collected}/${state.targetPackets}`;
  dom.exposure.textContent = `${Math.round(state.exposure)}%`;
  dom.sentries.textContent = String(state.sentries.length);
}

function update(dt) {
  if (state.phase !== "running") return;

  levelTimer += dt;
  state.sentries.forEach((sentry) => {
    sentry.angle += sentry.speed * dt;
  });

  movePlayer(dt);
  handleCollection();
  const exposed = isPlayerExposed();

  if (exposed) {
    state.exposure += (28 + state.round * 4) * dt;
    setMessage("탐조등에 노출 중입니다. 즉시 어둠으로 빠져나오세요.");
  } else {
    state.exposure = Math.max(0, state.exposure - 18 * dt);
  }

  if (state.exposure >= 100) {
    failRun("노출도가 100%에 도달했습니다.");
    return;
  }

  if (state.collected >= state.targetPackets && distance(state.player, state.exit) < state.exit.radius + state.player.radius) {
    clearRound();
    return;
  }

  renderHud();
}

function movePlayer(dt) {
  const speed = 218 + Math.min(42, state.round * 4);
  let dx = 0;
  let dy = 0;

  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy) || 1;
    state.pointerTarget = null;
    state.player.x += (dx / length) * speed * dt;
    state.player.y += (dy / length) * speed * dt;
  } else if (state.pointerTarget) {
    const tx = state.pointerTarget.x - state.player.x;
    const ty = state.pointerTarget.y - state.player.y;
    const dist = Math.hypot(tx, ty);
    if (dist > 3) {
      const step = Math.min(dist, speed * dt);
      state.player.x += (tx / dist) * step;
      state.player.y += (ty / dist) * step;
    }
  }

  state.player.x = clamp(state.player.x, state.player.radius, world.width - state.player.radius);
  state.player.y = clamp(state.player.y, state.player.radius, world.height - state.player.radius);
}

function handleCollection() {
  state.packages.forEach((packet) => {
    if (!packet.taken && distance(packet, state.player) < packet.radius + state.player.radius + 5) {
      packet.taken = true;
      state.collected += 1;
      if (state.collected >= state.targetPackets) {
        setMessage("모든 패킷을 회수했습니다. 오른쪽 출구로 이동하세요.");
      } else {
        setMessage(`패킷 회수. 남은 패킷 ${state.targetPackets - state.collected}개.`);
      }
    }
  });
}

function isPlayerExposed() {
  return state.sentries.some((sentry) => inCone(state.player, sentry));
}

function inCone(point, sentry) {
  const dx = point.x - sentry.x;
  const dy = point.y - sentry.y;
  const dist = Math.hypot(dx, dy);
  if (dist > sentry.radius) return false;
  const angle = Math.atan2(dy, dx);
  const delta = Math.abs(angleDelta(angle, sentry.angle));
  return delta < sentry.width;
}

function clearRound() {
  state.phase = "cleared";
  renderHud();
  dom.overlayLabel.textContent = "탈출 성공";
  dom.overlayTitle.textContent = `라운드 ${state.round} 완료`;
  dom.overlayText.textContent = "다음 라운드는 더 많은 패킷과 감시등으로 진행됩니다.";
  dom.overlayButton.textContent = `라운드 ${state.round + 1} 시작`;
  dom.overlay.classList.remove("hidden");
  setMessage(`라운드 ${state.round} 완료. 곧 다음 구역으로 이동합니다.`);
  state.nextTimer = window.setTimeout(() => {
    if (state.phase === "cleared") startRun(state.round + 1);
  }, 1050);
}

function failRun(reason) {
  state.phase = "failed";
  renderHud();
  dom.overlayLabel.textContent = "발각";
  dom.overlayTitle.textContent = "라운드 1로 복귀";
  dom.overlayText.textContent = `${reason} 탐조등의 회전 주기를 보고 이동 타이밍을 다시 잡으세요.`;
  dom.overlayButton.textContent = "라운드 1 다시 시작";
  dom.overlay.classList.remove("hidden");
  setMessage("발각되었습니다. 진행도가 초기화됩니다.");
}

function draw() {
  ctx.clearRect(0, 0, world.width, world.height);
  drawBackground();
  drawExit();
  state.packages.forEach(drawPacket);
  state.sentries.forEach(drawSentry);
  drawPlayer();
}

function drawBackground() {
  ctx.fillStyle = "#111511";
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let x = 40; x < world.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }
  for (let y = 40; y < world.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 0, 92, world.height);
  ctx.fillRect(world.width - 92, 0, 92, world.height);
}

function drawExit() {
  const active = state.collected >= state.targetPackets;
  ctx.save();
  ctx.translate(state.exit.x, state.exit.y);
  ctx.strokeStyle = active ? "rgba(111, 220, 168, 0.9)" : "rgba(255,255,255,0.22)";
  ctx.fillStyle = active ? "rgba(111, 220, 168, 0.12)" : "rgba(255,255,255,0.05)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, state.exit.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = active ? "rgba(213,255,235,0.95)" : "rgba(255,255,255,0.36)";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(active ? "EXIT" : "LOCK", 0, 5);
  ctx.restore();
}

function drawPacket(packet) {
  if (packet.taken) return;
  ctx.save();
  ctx.translate(packet.x, packet.y);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.strokeStyle = "rgba(147, 177, 255, 0.92)";
  ctx.lineWidth = 3;
  roundRect(-13, -10, 26, 20, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(21, 28, 38, 0.72)";
  ctx.fillRect(-7, -2, 14, 4);
  ctx.restore();
}

function drawSentry(sentry) {
  ctx.save();
  ctx.translate(sentry.x, sentry.y);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, sentry.radius, sentry.angle - sentry.width, sentry.angle + sentry.width);
  ctx.closePath();
  ctx.fillStyle = "rgba(237, 192, 88, 0.18)";
  ctx.fill();

  ctx.strokeStyle = "rgba(237, 192, 88, 0.34)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#d6d2c4";
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#24251f";
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const exposed = state.phase === "running" && isPlayerExposed();
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.fillStyle = exposed ? "#f2d47a" : "#dfe6dc";
  ctx.strokeStyle = exposed ? "rgba(255, 224, 126, 0.9)" : "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, state.player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(17, 21, 17, 0.75)";
  ctx.beginPath();
  ctx.arc(4, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * world.width, 0, world.width),
    y: clamp(((event.clientY - rect.top) / rect.height) * world.height, 0, world.height),
  };
}

function handlePointer(event) {
  if (state.phase !== "running") return;
  event.preventDefault();
  state.pointerTarget = canvasPoint(event);
}

function handleOverlayButton() {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }
  startRun(1);
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

canvas.addEventListener("pointerdown", handlePointer);
canvas.addEventListener("pointermove", handlePointer);
canvas.addEventListener("pointerup", () => {
  state.pointerTarget = null;
});
canvas.addEventListener("pointercancel", () => {
  state.pointerTarget = null;
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    keys.add(key);
  }
  if (event.key === "Enter") {
    event.preventDefault();
    handleOverlayButton();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("resize", resizeCanvas);
dom.start.addEventListener("click", () => startRun(1));
dom.restart.addEventListener("click", () => startRun(1));
dom.overlayButton.addEventListener("click", handleOverlayButton);

resizeCanvas();
renderHud();
requestAnimationFrame(loop);
