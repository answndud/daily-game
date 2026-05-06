const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const roundValue = document.querySelector("#roundValue");
const scoreValue = document.querySelector("#scoreValue");
const targetValue = document.querySelector("#targetValue");
const faultValue = document.querySelector("#faultValue");
const holdValue = document.querySelector("#holdValue");
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
  notch: "#bd8b4b",
  needle: "#f1ead8",
  dial: "#567f86",
  danger: "#a45d59"
};

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  phase: "idle",
  round: 1,
  score: 0,
  target: 6,
  faults: 0,
  dialAngle: -Math.PI / 2,
  needleAngle: -Math.PI / 2,
  targetAngle: 0,
  notchWidth: 0.42,
  lockTime: 0,
  noiseTime: 0,
  drift: 0,
  isDragging: false,
  lastPointerAngle: 0,
  lastTime: 0,
  nextRoundTimer: 0,
  shake: 0,
  sparks: []
};

function targetFor(round) {
  return Math.min(12, 5 + round);
}

function notchWidthFor(round) {
  return Math.max(0.16, 0.46 - round * 0.032);
}

function lockNeedFor(round) {
  return Math.max(0.68, 1.05 - round * 0.035);
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
  state.dialAngle = -Math.PI / 2;
  state.needleAngle = -Math.PI / 2;
  state.notchWidth = notchWidthFor(round);
  state.lockTime = 0;
  state.noiseTime = 0;
  state.drift = 0;
  state.isDragging = false;
  state.nextRoundTimer = 0;
  state.shake = 0;
  state.sparks = [];
  setNewTarget();
  hideOverlay();
  setMessage(`라운드 ${round}: 목표 노치 안에 바늘을 ${lockNeedFor(round).toFixed(1)}초 고정하세요.`);
  updateHud();
}

function setNewTarget() {
  const base = -Math.PI + Math.random() * Math.PI * 2;
  state.targetAngle = normalizeAngle(base);
  state.lockTime = 0;
}

function update(delta) {
  const seconds = delta / 1000;
  if (state.phase === "running") {
    state.noiseTime += seconds;
    const noise = Math.sin(state.noiseTime * (1.7 + state.round * 0.08)) * (0.018 + state.round * 0.002);
    const wobble = Math.sin(state.noiseTime * 3.1 + state.round) * 0.011;
    state.needleAngle = normalizeAngle(state.dialAngle + noise + wobble + state.drift);
    state.drift += Math.sin(state.noiseTime * 0.9) * seconds * (0.003 + state.round * 0.0009);
    state.drift = Math.max(-0.22, Math.min(0.22, state.drift));

    if (isNeedleInNotch()) {
      state.lockTime += seconds;
      if (state.lockTime >= lockNeedFor(state.round)) {
        completeTune();
      }
    } else {
      state.lockTime = Math.max(0, state.lockTime - seconds * 0.9);
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
    spark.vy += 100 * seconds;
  });
  state.sparks = state.sparks.filter((spark) => spark.age < spark.life);
  state.shake = Math.max(0, state.shake - delta / 34);
  updateHud();
}

function completeTune() {
  state.score += 1;
  burst(colors.notch, 18);
  if (state.score >= state.target) {
    clearRound();
    return;
  }
  setNewTarget();
  setMessage(`보정 성공. ${state.target - state.score}개 남았습니다.`);
}

function registerFault() {
  if (state.phase !== "running") return;
  state.faults += 1;
  state.lockTime = 0;
  state.shake = 12;
  burst(colors.danger, 20);
  if (state.faults >= 3) {
    failRun();
  } else {
    setNewTarget();
    setMessage(`잡음 폭주 ${state.faults}/3. 새 노치로 전환합니다.`);
  }
  updateHud();
}

function clearRound() {
  state.phase = "cleared";
  state.isDragging = false;
  state.nextRoundTimer = 900;
  showOverlay("통과", `라운드 ${state.round + 1} 준비`, "다음 라운드는 목표 노치가 좁아지고 바늘 흔들림이 커집니다.", "즉시 진행");
  setMessage(`라운드 ${state.round} 완료. 난이도가 상승합니다.`);
}

function failRun() {
  state.phase = "failed";
  state.isDragging = false;
  state.nextRoundTimer = 0;
  showOverlay("실패", "라운드 1로 복귀", "잡음이 한계에 도달했습니다. 다시 시작하면 라운드 1부터 진행합니다.", "라운드 1 시작");
  setMessage("실패했습니다. 라운드 1부터 다시 시작하세요.");
}

function isNeedleInNotch() {
  return Math.abs(angleDiff(state.needleAngle, state.targetAngle)) <= state.notchWidth / 2;
}

function burst(color, count) {
  const center = dialCenter();
  const radius = dialRadius() * 0.78;
  for (let i = 0; i < count; i += 1) {
    const angle = state.needleAngle + (Math.random() - 0.5) * 0.8;
    const speed = 70 + Math.random() * 155;
    state.sparks.push({
      x: center.x + Math.cos(state.needleAngle) * radius,
      y: center.y + Math.sin(state.needleAngle) * radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 340 + Math.random() * 260,
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
  drawDial();
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
  for (let x = 26; x < state.width; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, state.height - 24);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDial() {
  const center = dialCenter();
  const radius = dialRadius();
  const lockRatio = Math.min(1, state.lockTime / lockNeedFor(state.round));

  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.fillStyle = "rgba(255,255,255,0.045)";
  ctx.beginPath();
  ctx.arc(0, 0, radius + 18, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 36; i += 1) {
    const angle = (Math.PI * 2 * i) / 36;
    const inner = radius * (i % 3 === 0 ? 0.82 : 0.89);
    ctx.strokeStyle = i % 3 === 0 ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.1)";
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.76, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = colors.notch;
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.76, state.targetAngle - state.notchWidth / 2, state.targetAngle + state.notchWidth / 2);
  ctx.stroke();

  ctx.strokeStyle = colors.dial;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(state.dialAngle) * radius * 0.56, Math.sin(state.dialAngle) * radius * 0.56);
  ctx.stroke();

  ctx.shadowColor = isNeedleInNotch() ? colors.notch : colors.needle;
  ctx.shadowBlur = isNeedleInNotch() ? 20 : 8;
  ctx.strokeStyle = isNeedleInNotch() ? colors.notch : colors.needle;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(state.needleAngle) * radius * 0.8, Math.sin(state.needleAngle) * radius * 0.8);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = colors.dial;
  ctx.beginPath();
  ctx.arc(0, 0, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.text;
  ctx.font = "900 14px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(lockRatio * 100)}%`, 0, 0);
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
  ctx.fillText("DRAG DIAL", 18, 31);
  ctx.textAlign = "right";
  ctx.fillText("LOCK NOTCH", state.width - 18, 31);
  ctx.restore();
}

function dialCenter() {
  return { x: state.width / 2, y: state.height * 0.53 };
}

function dialRadius() {
  return Math.min(state.width * 0.38, state.height * 0.32, 245);
}

function pointerAngle(event) {
  const rect = canvas.getBoundingClientRect();
  const center = dialCenter();
  return Math.atan2(event.clientY - rect.top - center.y, event.clientX - rect.left - center.x);
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
  state.lastPointerAngle = pointerAngle(event);
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!state.isDragging || state.phase !== "running") return;
  const next = pointerAngle(event);
  const delta = angleDiff(next, state.lastPointerAngle);
  state.dialAngle = normalizeAngle(state.dialAngle + delta);
  state.lastPointerAngle = next;
  if (Math.abs(delta) > 0.42) {
    registerFault();
  }
}

function handlePointerUp() {
  state.isDragging = false;
}

function normalizeAngle(angle) {
  let result = angle;
  while (result <= -Math.PI) result += Math.PI * 2;
  while (result > Math.PI) result -= Math.PI * 2;
  return result;
}

function angleDiff(a, b) {
  return normalizeAngle(a - b);
}

function updateHud() {
  roundValue.textContent = state.round;
  scoreValue.textContent = state.score;
  targetValue.textContent = state.target;
  faultValue.textContent = state.faults;
  holdValue.textContent = state.lockTime.toFixed(1);
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
    state.dialAngle = normalizeAngle(state.dialAngle - 0.08);
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    state.dialAngle = normalizeAngle(state.dialAngle + 0.08);
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
showOverlay("시작", "다이얼을 돌려 맞추세요", "손가락으로 원형 다이얼을 돌려 바늘을 밝은 목표 노치 안에 유지하세요. 잡음 세 번이면 라운드 1로 돌아갑니다.", "시작");
updateHud();
requestAnimationFrame(loop);
