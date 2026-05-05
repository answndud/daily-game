const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const roundValue = document.querySelector("#roundValue");
const scoreValue = document.querySelector("#scoreValue");
const targetValue = document.querySelector("#targetValue");
const faultValue = document.querySelector("#faultValue");
const windValue = document.querySelector("#windValue");
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
  safe: "#bd8b4b",
  hull: "#f1ead8",
  water: "#567f86",
  danger: "#a45d59"
};

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  phase: "idle",
  round: 1,
  stableTime: 0,
  targetTime: 8,
  faults: 0,
  tilt: 0,
  tiltVelocity: 0,
  control: 0,
  wind: 0,
  windTimer: 0,
  isDragging: false,
  lastTime: 0,
  nextRoundTimer: 0,
  shake: 0,
  sparks: []
};

function targetFor(round) {
  return Math.min(14, 7 + round);
}

function safeLimitFor(round) {
  return Math.max(0.13, 0.28 - round * 0.018);
}

function windStrengthFor(round) {
  return 0.18 + round * 0.035;
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
  state.stableTime = 0;
  state.targetTime = targetFor(round);
  state.faults = 0;
  state.tilt = 0;
  state.tiltVelocity = 0;
  state.control = 0;
  state.wind = randomWind();
  state.windTimer = 900;
  state.isDragging = false;
  state.nextRoundTimer = 0;
  state.shake = 0;
  state.sparks = [];
  hideOverlay();
  setMessage(`라운드 ${round}: 선체를 안정선 안에 ${state.targetTime.toFixed(1)}초 유지하세요.`);
  updateHud();
}

function randomWind() {
  const direction = Math.random() < 0.5 ? -1 : 1;
  return direction * (windStrengthFor(state.round) * (0.55 + Math.random() * 0.7));
}

function clearRound() {
  state.phase = "cleared";
  state.isDragging = false;
  state.nextRoundTimer = 900;
  showOverlay("통과", `라운드 ${state.round + 1} 준비`, "다음 라운드는 안정선이 좁아지고 바람이 더 강해집니다. 곧 자동으로 진행됩니다.", "즉시 진행");
  setMessage(`라운드 ${state.round} 완료. 난이도가 상승합니다.`);
}

function failRun() {
  state.phase = "failed";
  state.isDragging = false;
  state.nextRoundTimer = 0;
  showOverlay("실패", "라운드 1로 복귀", "균열이 한계에 도달했습니다. 다시 시작하면 라운드 1부터 진행합니다.", "라운드 1 시작");
  setMessage("실패했습니다. 라운드 1부터 다시 시작하세요.");
}

function registerFault() {
  state.faults += 1;
  state.shake = 14;
  burst(colors.danger, 16);
  state.tilt *= 0.45;
  state.tiltVelocity *= -0.25;
  if (state.faults >= 3) {
    failRun();
  } else {
    setMessage(`안정선을 벗어났습니다. 균열 ${state.faults}/3.`);
  }
  updateHud();
}

function update(delta) {
  const seconds = delta / 1000;
  if (state.phase === "running") {
    state.windTimer -= delta;
    if (state.windTimer <= 0) {
      state.wind = randomWind();
      state.windTimer = Math.max(520, 1500 - state.round * 80);
    }

    const correction = -state.control * (0.62 + state.round * 0.015);
    const restoring = -state.tilt * 0.72;
    const noise = Math.sin(performance.now() / 520 + state.round) * 0.025;
    const acceleration = state.wind + correction + restoring + noise;
    state.tiltVelocity += acceleration * seconds;
    state.tiltVelocity *= Math.pow(0.86, seconds * 10);
    state.tilt += state.tiltVelocity * seconds;
    state.tilt = Math.max(-0.7, Math.min(0.7, state.tilt));

    if (Math.abs(state.tilt) <= safeLimitFor(state.round)) {
      state.stableTime += seconds;
      if (state.stableTime >= state.targetTime) {
        clearRound();
      }
    } else if (Math.abs(state.tilt) > safeLimitFor(state.round) * 1.75) {
      registerFault();
    }
  }

  if (state.phase === "cleared") {
    state.nextRoundTimer -= delta;
    if (state.nextRoundTimer <= 0) startRound(state.round + 1);
  }

  state.sparks.forEach((spark) => {
    spark.age += delta;
    spark.x += spark.vx * seconds;
    spark.y += spark.vy * seconds;
    spark.vy += 110 * seconds;
  });
  state.sparks = state.sparks.filter((spark) => spark.age < spark.life);
  state.shake = Math.max(0, state.shake - delta / 34);
  updateHud();
}

function burst(color, count) {
  const center = hullCenter();
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 150;
    state.sparks.push({
      x: center.x,
      y: center.y + 18,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 360 + Math.random() * 260,
      color
    });
  }
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground();
  drawGauge();
  drawHull();
  drawControls();
  drawSparks();
  drawLabels();
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
  ctx.restore();
}

function drawGauge() {
  const center = hullCenter();
  const radius = Math.min(state.width * 0.38, 230);
  const safe = safeLimitFor(state.round);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  ctx.strokeStyle = colors.safe;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI * 1.5 - safe, Math.PI * 1.5 + safe);
  ctx.stroke();

  const needleAngle = Math.PI * 1.5 + state.tilt;
  ctx.strokeStyle = Math.abs(state.tilt) <= safe ? colors.hull : colors.danger;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(needleAngle) * radius, Math.sin(needleAngle) * radius);
  ctx.stroke();
  ctx.restore();
}

function drawHull() {
  const center = hullCenter();
  ctx.save();
  ctx.translate(center.x, center.y + 36);
  ctx.rotate(state.tilt);
  ctx.fillStyle = colors.hull;
  roundedRect(-118, -26, 236, 52, 24);
  ctx.fill();
  ctx.fillStyle = colors.water;
  ctx.beginPath();
  ctx.moveTo(-88, 20);
  ctx.lineTo(88, 20);
  ctx.lineTo(42, 64);
  ctx.lineTo(-42, 64);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#151718";
  ctx.font = "900 15px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("KEEL", 0, 0);
  ctx.restore();
}

function drawControls() {
  const y = state.height - 78;
  const left = 36;
  const width = state.width - 72;
  const knobX = left + width * ((state.control + 1) / 2);
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundedRect(left, y, width, 18, 9);
  ctx.fill();
  ctx.fillStyle = colors.safe;
  roundedRect(knobX - 34, y - 18, 68, 54, 18);
  ctx.fill();
  ctx.fillStyle = "#151718";
  ctx.font = "900 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DRAG", knobX, y + 9);
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

function drawLabels() {
  ctx.save();
  ctx.fillStyle = colors.muted;
  ctx.font = "800 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SAFE ARC", 18, 31);
  ctx.textAlign = "right";
  ctx.fillText(state.wind < 0 ? "WIND ←" : "WIND →", state.width - 18, 31);
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

function hullCenter() {
  return { x: state.width / 2, y: state.height * 0.48 };
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function setControlFromX(x) {
  const left = 36;
  const width = state.width - 72;
  state.control = Math.max(-1, Math.min(1, ((x - left) / width) * 2 - 1));
}

function handlePointerDown(event) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
  }
  if (state.phase !== "running") return;
  state.isDragging = true;
  setControlFromX(pointerPosition(event).x);
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!state.isDragging || state.phase !== "running") return;
  setControlFromX(pointerPosition(event).x);
}

function handlePointerUp() {
  state.isDragging = false;
}

function updateHud() {
  roundValue.textContent = state.round;
  scoreValue.textContent = state.stableTime.toFixed(1);
  targetValue.textContent = state.targetTime.toFixed(1);
  faultValue.textContent = state.faults;
  windValue.textContent = state.wind < 0 ? "←" : "→";
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
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    state.control = Math.max(-1, state.control - 0.1);
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    state.control = Math.min(1, state.control + 0.1);
  }
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
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
window.addEventListener("keydown", handleKey);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
showOverlay("시작", "핸들을 끌어 균형을 잡으세요", "하단 핸들을 좌우로 드래그해 선체를 중앙 안정선 안에 머물게 하세요. 실패 세 번이면 라운드 1로 돌아갑니다.", "시작");
updateHud();
requestAnimationFrame(loop);
