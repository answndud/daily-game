const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const roundValue = document.querySelector("#roundValue");
const scoreValue = document.querySelector("#scoreValue");
const targetValue = document.querySelector("#targetValue");
const faultValue = document.querySelector("#faultValue");
const comboValue = document.querySelector("#comboValue");
const messageLine = document.querySelector("#messageLine");
const overlay = document.querySelector("#overlay");
const overlayLabel = document.querySelector("#overlayLabel");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");

const colors = {
  text: "#f6f0de",
  muted: "#aaa49a",
  grid: "rgba(255,255,255,0.08)",
  left: "#557f88",
  right: "#c08a48",
  danger: "#a45d59",
  tile: "#f1ead8"
};

const TYPES = {
  left: { key: "left", label: "TROUGH", mark: "≋", name: "저조", color: colors.left },
  right: { key: "right", label: "CREST", mark: "∿", name: "고조", color: colors.right }
};

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  phase: "idle",
  round: 1,
  score: 0,
  target: 10,
  faults: 0,
  combo: 0,
  tile: null,
  spawnTimer: 0,
  sparks: [],
  pointerStart: null,
  lastTime: 0,
  nextRoundTimer: 0,
  shake: 0,
  laneFlash: null
};

function targetFor(round) {
  return Math.min(18, 8 + round * 2);
}

function fallSpeedFor(round) {
  return 125 + round * 22;
}

function decisionLine() {
  return state.height - 126;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = rect.width;
  state.height = rect.height;
  canvas.width = Math.round(rect.width * state.dpr);
  canvas.height = Math.round(rect.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

function startRound(round = 1) {
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.target = targetFor(round);
  state.faults = 0;
  state.combo = 0;
  state.tile = null;
  state.spawnTimer = 150;
  state.sparks = [];
  state.pointerStart = null;
  state.nextRoundTimer = 0;
  state.shake = 0;
  state.laneFlash = null;
  hideOverlay();
  setMessage(`라운드 ${round}: CREST는 오른쪽, TROUGH는 왼쪽입니다.`);
  updateHud();
}

function spawnTile() {
  const type = Math.random() < 0.5 ? TYPES.left : TYPES.right;
  state.tile = {
    type,
    x: state.width / 2,
    y: -54,
    rotation: (Math.random() - 0.5) * 0.18,
    speed: fallSpeedFor(state.round) + Math.random() * 24
  };
}

function sortTile(direction) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  if (state.phase !== "running" || !state.tile) return;

  const matched = state.tile.type.key === direction;
  const tile = state.tile;
  state.tile = null;

  if (matched) {
    state.score += 1;
    state.combo += 1;
    state.laneFlash = { direction, age: 0, good: true };
    burst(direction, tile.x, tile.y, tile.type.color, 18);
    setMessage(`${tile.type.name} 분류 성공. ${state.target - state.score}개 남았습니다.`);
    if (state.combo > 0 && state.combo % 6 === 0) {
      state.faults = Math.max(0, state.faults - 1);
      setMessage(`연속 ${state.combo}. 오류 1회 복구.`);
    }
    if (state.score >= state.target) {
      clearRound();
    } else {
      state.spawnTimer = Math.max(120, 390 - state.round * 18);
    }
  } else {
    state.faults += 1;
    state.combo = 0;
    state.shake = 12;
    state.laneFlash = { direction, age: 0, good: false };
    burst(direction, tile.x, tile.y, colors.danger, 22);
    if (state.faults >= 3) {
      failRun();
    } else {
      setMessage(`수문 오류 ${state.faults}/3. 반대 방향이었습니다.`);
      state.spawnTimer = 360;
    }
  }
  updateHud();
}

function clearRound() {
  state.phase = "cleared";
  state.nextRoundTimer = 900;
  showOverlay("통과", `라운드 ${state.round + 1} 준비`, "다음 라운드는 파형이 더 빠르게 내려오고 목표 분류 수가 늘어납니다.", "즉시 진행");
  setMessage(`라운드 ${state.round} 완료. 난이도가 상승합니다.`);
}

function failRun() {
  state.phase = "failed";
  state.nextRoundTimer = 0;
  showOverlay("실패", "라운드 1로 복귀", "오류가 한계에 도달했습니다. 다시 시작하면 라운드 1부터 진행합니다.", "라운드 1 시작");
  setMessage("실패했습니다. 라운드 1부터 다시 시작하세요.");
}

function burst(direction, x, y, color, count) {
  const push = direction === "left" ? -1 : 1;
  for (let i = 0; i < count; i += 1) {
    const angle = (direction === "left" ? Math.PI : 0) + (Math.random() - 0.5) * 1.3;
    const speed = 80 + Math.random() * 170;
    state.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed + push * 70,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 340 + Math.random() * 260,
      color
    });
  }
}

function update(delta) {
  if (state.phase === "running") {
    if (!state.tile) {
      state.spawnTimer -= delta;
      if (state.spawnTimer <= 0) spawnTile();
    } else {
      state.tile.y += state.tile.speed * delta / 1000;
      if (state.tile.y >= decisionLine()) {
        state.faults += 1;
        state.combo = 0;
        state.shake = 12;
        burst(state.tile.type.key === "left" ? "right" : "left", state.tile.x, state.tile.y, colors.danger, 18);
        state.tile = null;
        if (state.faults >= 3) failRun();
        else {
          state.spawnTimer = 340;
          setMessage(`분류 지연 ${state.faults}/3. 더 빨리 스와이프하세요.`);
        }
        updateHud();
      }
    }
  }

  if (state.phase === "cleared") {
    state.nextRoundTimer -= delta;
    if (state.nextRoundTimer <= 0) startRound(state.round + 1);
  }

  state.sparks.forEach((spark) => {
    spark.age += delta;
    spark.x += spark.vx * delta / 1000;
    spark.y += spark.vy * delta / 1000;
    spark.vy += 120 * delta / 1000;
  });
  state.sparks = state.sparks.filter((spark) => spark.age < spark.life);
  state.shake = Math.max(0, state.shake - delta / 36);
  if (state.laneFlash) {
    state.laneFlash.age += delta;
    if (state.laneFlash.age > 220) state.laneFlash = null;
  }
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground();
  drawGates();
  drawTile();
  drawSparks();
  drawTopLabels();
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#17191b");
  gradient.addColorStop(0.56, "#24282a");
  gradient.addColorStop(1, "#101213");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let y = 38; y < state.height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(state.width - 18, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(246,240,222,0.2)";
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(22, decisionLine());
  ctx.lineTo(state.width - 22, decisionLine());
  ctx.stroke();
  ctx.restore();
}

function drawGates() {
  const y = state.height - 96;
  const half = state.width / 2;
  drawGate(16, y, half - 24, 64, TYPES.left, "LEFT");
  drawGate(half + 8, y, half - 24, 64, TYPES.right, "RIGHT");
}

function drawGate(x, y, width, height, type, sideLabel) {
  const flash = state.laneFlash && state.laneFlash.direction === type.key;
  ctx.save();
  ctx.fillStyle = flash ? (state.laneFlash.good ? type.color : colors.danger) : "rgba(255,255,255,0.08)";
  roundedRect(x, y, width, height, 17);
  ctx.fill();
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.font = "900 15px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${sideLabel} · ${type.label}`, x + width / 2, y + height / 2);
  ctx.restore();
}

function drawTile() {
  if (!state.tile) return;
  const tile = state.tile;
  ctx.save();
  ctx.translate(tile.x, tile.y);
  ctx.rotate(tile.rotation);
  ctx.shadowColor = tile.type.color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = colors.tile;
  roundedRect(-58, -38, 116, 76, 18);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = tile.type.color;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#151718";
  ctx.font = "900 32px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tile.type.mark, 0, -9);
  ctx.font = "900 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(tile.type.label, 0, 20);
  ctx.restore();
}

function drawSparks() {
  state.sparks.forEach((spark) => {
    const alpha = 1 - spark.age / spark.life;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 2 + alpha * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawTopLabels() {
  ctx.save();
  ctx.fillStyle = colors.muted;
  ctx.font = "800 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("← TROUGH", 18, 31);
  ctx.textAlign = "right";
  ctx.fillText("CREST →", state.width - 18, 31);
  ctx.restore();
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function handlePointerDown(event) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  state.pointerStart = pointerPosition(event);
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerUp(event) {
  if (!state.pointerStart) return;
  const end = pointerPosition(event);
  const dx = end.x - state.pointerStart.x;
  state.pointerStart = null;
  if (Math.abs(dx) < 22) return;
  sortTile(dx < 0 ? "left" : "right");
}

function updateHud() {
  roundValue.textContent = state.round;
  scoreValue.textContent = state.score;
  targetValue.textContent = state.target;
  faultValue.textContent = state.faults;
  comboValue.textContent = state.combo;
}

function showOverlay(label, title, text, buttonText) {
  overlay.hidden = false;
  overlayLabel.textContent = label;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
}

function hideOverlay() {
  overlay.hidden = true;
}

function setMessage(text) {
  messageLine.textContent = text;
}

function handleKey(event) {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") sortTile("left");
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") sortTile("right");
  if (event.key === "Enter" || event.key === " ") {
    if (state.phase === "cleared") startRound(state.round + 1);
    else if (state.phase !== "running") startRound(1);
  }
  if (event.key.toLowerCase() === "r") startRound(1);
}

function loop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const delta = Math.min(42, timestamp - state.lastTime);
  state.lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") startRound(state.round + 1);
  else startRound(1);
});
resetButton.addEventListener("click", () => startRound(1));
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", () => {
  state.pointerStart = null;
});
window.addEventListener("keydown", handleKey);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
showOverlay("시작", "파형을 수문으로 보내세요", "CREST는 오른쪽, TROUGH는 왼쪽입니다. 화면을 좌우로 스와이프하거나 방향키를 누르세요.", "시작");
updateHud();
requestAnimationFrame(loop);
