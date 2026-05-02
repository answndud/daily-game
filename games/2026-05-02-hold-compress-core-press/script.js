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
  shell: "#151718",
  text: "#f6f0de",
  muted: "#a9a49a",
  grid: "rgba(255,255,255,0.08)",
  band: "#bf8b4a",
  bandSoft: "rgba(191,139,74,0.2)",
  ring: "#f1d28d",
  core: "#527d86",
  danger: "#a35a55"
};

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  phase: "idle",
  round: 1,
  score: 0,
  target: 7,
  faults: 0,
  combo: 0,
  pressure: 1,
  isHolding: false,
  bandCenter: 0.55,
  bandWidth: 0.18,
  drift: 0,
  sparks: [],
  lastTime: 0,
  nextRoundTimer: 0,
  shake: 0,
  feedback: 0
};

function targetFor(round) {
  return Math.min(13, 6 + round);
}

function bandWidthFor(round) {
  return Math.max(0.07, 0.2 - round * 0.014);
}

function compressSpeedFor(round) {
  return 0.42 + round * 0.035;
}

function recoverSpeedFor(round) {
  return 0.34 + round * 0.02;
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
  state.pressure = 1;
  state.isHolding = false;
  state.bandWidth = bandWidthFor(round);
  state.bandCenter = 0.5 + Math.sin(round * 1.7) * 0.16;
  state.drift = 0;
  state.sparks = [];
  state.nextRoundTimer = 0;
  state.shake = 0;
  state.feedback = 0;
  hideOverlay();
  setMessage(`라운드 ${round}: 목표 밴드에서 손을 떼어 ${state.target}회 보정하세요.`);
  updateHud();
}

function pointerDown(event) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
  }
  if (state.phase !== "running") return;
  event.preventDefault();
  state.isHolding = true;
  canvas.setPointerCapture(event.pointerId);
  setMessage("압축 중입니다. 링이 밝은 밴드에 닿으면 손을 떼세요.");
}

function pointerUp(event) {
  if (state.phase !== "running") return;
  event.preventDefault();
  state.isHolding = false;
  evaluateRelease();
}

function evaluateRelease() {
  const half = state.bandWidth / 2;
  const offset = Math.abs(state.pressure - state.bandCenter);
  const perfect = offset <= half * 0.34;
  const hit = offset <= half;

  if (hit) {
    state.score += 1;
    state.combo += 1;
    state.feedback = perfect ? 1.1 : 0.8;
    burst(perfect ? colors.ring : colors.band, perfect ? 22 : 14);
    if (perfect && state.combo % 3 === 0) {
      state.faults = Math.max(0, state.faults - 1);
      setMessage(`정밀 보정. 연속 ${state.combo}, 균열 1회 회복.`);
    } else {
      setMessage(perfect ? "정밀 보정 성공." : "보정 성공.");
    }
    if (state.score >= state.target) {
      clearRound();
    } else {
      shiftBand();
    }
  } else {
    state.faults += 1;
    state.combo = 0;
    state.shake = 12;
    state.feedback = -0.9;
    burst(colors.danger, 18);
    if (state.faults >= 3) {
      failRun();
    } else {
      shiftBand();
      setMessage(`목표 밴드를 벗어났습니다. 균열 ${state.faults}/3.`);
    }
  }
  updateHud();
}

function shiftBand() {
  const base = 0.46 + Math.random() * 0.22;
  const nudge = (Math.random() - 0.5) * 0.28;
  state.bandCenter = Math.max(0.22, Math.min(0.78, base + nudge));
}

function clearRound() {
  state.phase = "cleared";
  state.isHolding = false;
  state.nextRoundTimer = 900;
  showOverlay("통과", `라운드 ${state.round + 1} 준비`, "목표 밴드가 더 좁아지고 압축 속도가 올라갑니다. 곧 다음 라운드로 진행됩니다.", "즉시 진행");
  setMessage(`라운드 ${state.round} 완료. 다음 라운드로 난이도가 상승합니다.`);
}

function failRun() {
  state.phase = "failed";
  state.isHolding = false;
  state.nextRoundTimer = 0;
  showOverlay("실패", "라운드 1로 복귀", "균열이 한계에 도달했습니다. 다시 시작하면 라운드 1부터 진행합니다.", "라운드 1 시작");
  setMessage("실패했습니다. 라운드 1부터 다시 시작하세요.");
}

function burst(color, count) {
  const center = centerPoint();
  const radius = ringRadius();
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 160;
    state.sparks.push({
      x: center.x + Math.cos(angle) * radius * state.pressure,
      y: center.y + Math.sin(angle) * radius * state.pressure,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 360 + Math.random() * 260,
      color
    });
  }
}

function update(delta) {
  if (state.phase === "running") {
    const amount = (state.isHolding ? compressSpeedFor(state.round) : -recoverSpeedFor(state.round)) * delta / 1000;
    state.pressure = Math.max(0.08, Math.min(1, state.pressure - amount));
    if (state.pressure <= 0.08 && state.isHolding) {
      state.isHolding = false;
      state.faults += 1;
      state.combo = 0;
      state.shake = 14;
      burst(colors.danger, 22);
      if (state.faults >= 3) failRun();
      else {
        state.pressure = 1;
        shiftBand();
        setMessage(`과압축입니다. 균열 ${state.faults}/3.`);
      }
      updateHud();
    }

    state.drift += delta / 1000;
    const driftAmount = Math.sin(state.drift * (0.85 + state.round * 0.06)) * 0.0008;
    state.bandCenter = Math.max(0.2, Math.min(0.8, state.bandCenter + driftAmount));
  }

  if (state.phase === "cleared") {
    state.nextRoundTimer -= delta;
    if (state.nextRoundTimer <= 0) {
      startRound(state.round + 1);
    }
  }

  state.sparks.forEach((spark) => {
    spark.age += delta;
    spark.x += spark.vx * delta / 1000;
    spark.y += spark.vy * delta / 1000;
    spark.vy += 90 * delta / 1000;
  });
  state.sparks = state.sparks.filter((spark) => spark.age < spark.life);
  state.shake = Math.max(0, state.shake - delta / 36);
  state.feedback *= 0.92;
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground();
  drawPressField();
  drawSparks();
  drawGuide();
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
  for (let y = 36; y < state.height; y += 44) {
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

function drawPressField() {
  const center = centerPoint();
  const radius = ringRadius();
  const bandOuter = radius * (state.bandCenter + state.bandWidth / 2);
  const bandInner = radius * Math.max(0.04, state.bandCenter - state.bandWidth / 2);
  const ring = radius * state.pressure;
  const corePulse = 1 + Math.abs(state.feedback) * 0.06;

  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.fillStyle = "rgba(255,255,255,0.045)";
  ctx.beginPath();
  ctx.arc(0, 0, radius + 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.bandSoft;
  ctx.beginPath();
  ctx.arc(0, 0, bandOuter, 0, Math.PI * 2);
  ctx.arc(0, 0, bandInner, 0, Math.PI * 2, true);
  ctx.fill();

  ctx.strokeStyle = colors.band;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, bandOuter, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, bandInner, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 1; i <= 4; i += 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius * i / 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.shadowColor = state.feedback < 0 ? colors.danger : colors.ring;
  ctx.shadowBlur = state.isHolding ? 24 : 12;
  ctx.strokeStyle = state.feedback < 0 ? colors.danger : colors.ring;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, 0, ring, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = colors.core;
  ctx.beginPath();
  ctx.arc(0, 0, 42 * corePulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.text;
  ctx.font = "800 15px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(state.pressure * 100)}%`, 0, 1);
  ctx.restore();
}

function drawGuide() {
  ctx.save();
  ctx.fillStyle = colors.muted;
  ctx.font = "800 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(state.isHolding ? "압축 중" : "누르고 시작", state.width / 2, 34);
  ctx.fillStyle = colors.text;
  ctx.font = "700 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("목표 밴드에서 RELEASE", state.width / 2, state.height - 30);
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

function centerPoint() {
  return {
    x: state.width / 2,
    y: state.height * 0.52
  };
}

function ringRadius() {
  return Math.min(state.width * 0.39, state.height * 0.34, 250);
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
  if (event.key === "Enter" || event.key === " ") {
    if (state.phase === "running") {
      state.isHolding = event.type === "keydown";
    } else if (state.phase === "cleared") {
      startRound(state.round + 1);
    } else {
      startRound(1);
    }
  }
  if (event.key.toLowerCase() === "r") {
    startRound(1);
  }
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
canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
window.addEventListener("keydown", handleKey);
window.addEventListener("keyup", (event) => {
  if ((event.key === "Enter" || event.key === " ") && state.phase === "running" && state.isHolding) {
    state.isHolding = false;
    evaluateRelease();
  }
});
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
showOverlay("시작", "눌렀다가 정확히 떼세요", "압축 링이 목표 밴드 안에 들어왔을 때 손을 떼면 보정됩니다. 실패 세 번이면 라운드 1로 돌아갑니다.", "시작");
updateHud();
requestAnimationFrame(loop);
