const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const roundValue = document.querySelector("#roundValue");
const scoreValue = document.querySelector("#scoreValue");
const targetValue = document.querySelector("#targetValue");
const stabilityValue = document.querySelector("#stabilityValue");
const comboValue = document.querySelector("#comboValue");
const messageLine = document.querySelector("#messageLine");
const overlay = document.querySelector("#overlay");
const overlayLabel = document.querySelector("#overlayLabel");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");

const COLORS = [
  { name: "청", hex: "#4d92a0" },
  { name: "금", hex: "#c4934d" },
  { name: "녹", hex: "#7b966d" },
  { name: "적", hex: "#b45e69" }
];

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  phase: "idle",
  round: 1,
  score: 0,
  target: 12,
  stability: 3,
  combo: 0,
  gateColors: [0, 1, 2, 3],
  capsules: [],
  sparks: [],
  spawnTimer: 0,
  lastTime: 0,
  clearTimer: 0,
  shake: 0
};

function roundTarget(round) {
  return 10 + round * 2;
}

function fallSpeed(round) {
  return 122 + round * 18;
}

function spawnDelay(round) {
  return Math.max(470, 1040 - round * 70);
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

function resetRun(round = 1) {
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.target = roundTarget(round);
  state.stability = 3;
  state.combo = 0;
  state.capsules = [];
  state.sparks = [];
  state.spawnTimer = 260;
  state.clearTimer = 0;
  state.shake = 0;
  state.gateColors = [0, 1, 2, 3].map((color) => (color + round - 1) % COLORS.length);
  hideOverlay();
  setMessage(`라운드 ${round}: 캡슐이 닿기 전에 게이트 색을 맞추세요.`);
  updateHud();
}

function failRun() {
  state.phase = "failed";
  state.clearTimer = 0;
  state.capsules = [];
  state.combo = 0;
  state.shake = 14;
  setMessage("안정도 붕괴. 다음 시도는 라운드 1부터 시작합니다.");
  showOverlay("실패", "라운드 1로 복귀", "게이트를 더 일찍 탭해 색을 준비하세요. 다시 시작하면 라운드 1부터 진행합니다.", "라운드 1 시작");
  updateHud();
}

function clearRound() {
  state.phase = "cleared";
  state.clearTimer = 980;
  state.capsules = [];
  setMessage(`라운드 ${state.round} 완료. 난이도가 상승합니다.`);
  showOverlay("통과", `라운드 ${state.round + 1} 준비`, "속도와 목표 처리량이 증가한 다음 라운드로 자동 진입합니다.", "즉시 진행");
  updateHud();
}

function showOverlay(label, title, text, button) {
  overlay.hidden = false;
  overlayLabel.textContent = label;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = button;
}

function hideOverlay() {
  overlay.hidden = true;
}

function setMessage(text) {
  messageLine.textContent = text;
}

function updateHud() {
  roundValue.textContent = state.round;
  scoreValue.textContent = state.score;
  targetValue.textContent = state.target;
  stabilityValue.textContent = state.stability;
  comboValue.textContent = state.combo;
}

function laneWidth() {
  return state.width / 4;
}

function gateTop() {
  return state.height - 92;
}

function spawnCapsule() {
  const lane = Math.floor(Math.random() * 4);
  let color = Math.floor(Math.random() * COLORS.length);
  if (Math.random() < 0.42) {
    color = state.gateColors[lane];
  }

  state.capsules.push({
    lane,
    color,
    y: -34,
    speed: fallSpeed(state.round) + Math.random() * 26,
    spin: Math.random() * Math.PI,
    id: makeId()
  });
}

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function cycleGate(lane) {
  if (state.phase !== "running") return;
  state.gateColors[lane] = (state.gateColors[lane] + 1) % COLORS.length;
  addSparks((lane + 0.5) * laneWidth(), gateTop() + 30, state.gateColors[lane], 8, 0.8);
  setMessage(`${lane + 1}번 게이트: ${COLORS[state.gateColors[lane]].name}`);
}

function addSparks(x, y, colorIndex, count, power) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (48 + Math.random() * 110) * power;
    state.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 380 + Math.random() * 260,
      age: 0,
      color: COLORS[colorIndex].hex
    });
  }
}

function resolveCapsule(capsule) {
  const match = state.gateColors[capsule.lane] === capsule.color;
  const x = (capsule.lane + 0.5) * laneWidth();
  const y = gateTop() + 16;

  if (match) {
    state.score += 1;
    state.combo += 1;
    addSparks(x, y, capsule.color, 16, 1.1);
    if (state.combo > 0 && state.combo % 5 === 0) {
      state.stability = Math.min(3, state.stability + 1);
      setMessage(`콤보 ${state.combo}. 안정도 보정 +1.`);
    } else {
      setMessage(`정렬 성공. ${state.target - state.score}개 남았습니다.`);
    }
    if (state.score >= state.target) {
      clearRound();
    }
  } else {
    state.stability -= 1;
    state.combo = 0;
    state.shake = 10;
    addSparks(x, y, capsule.color, 22, 1.25);
    setMessage(`색상 불일치. 안정도 ${Math.max(state.stability, 0)}.`);
    if (state.stability <= 0) {
      failRun();
    }
  }

  updateHud();
}

function update(delta) {
  if (state.phase === "cleared") {
    state.clearTimer -= delta;
    if (state.clearTimer <= 0) {
      resetRun(state.round + 1);
    }
  }

  if (state.phase === "running") {
    state.spawnTimer -= delta;
    while (state.spawnTimer <= 0) {
      spawnCapsule();
      state.spawnTimer += spawnDelay(state.round);
    }

    const bottom = gateTop();
    for (const capsule of state.capsules) {
      capsule.y += (capsule.speed * delta) / 1000;
      capsule.spin += delta / 360;
    }

    const remaining = [];
    for (const capsule of state.capsules) {
      if (capsule.y >= bottom - 18) {
        resolveCapsule(capsule);
        if (state.phase !== "running") {
          remaining.length = 0;
          break;
        }
      } else {
        remaining.push(capsule);
      }
    }
    state.capsules = remaining;
  }

  for (const spark of state.sparks) {
    spark.age += delta;
    spark.x += (spark.vx * delta) / 1000;
    spark.y += (spark.vy * delta) / 1000;
    spark.vy += (180 * delta) / 1000;
  }
  state.sparks = state.sparks.filter((spark) => spark.age < spark.life);
  state.shake = Math.max(0, state.shake - delta / 35);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#151a1e");
  gradient.addColorStop(0.52, "#22282d");
  gradient.addColorStop(1, "#111417");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let y = 34; y < state.height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(state.width - 16, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLanes() {
  const w = laneWidth();
  ctx.save();
  for (let lane = 0; lane < 4; lane += 1) {
    ctx.fillStyle = lane % 2 === 0 ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.012)";
    ctx.fillRect(lane * w, 0, w, state.height);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  for (let lane = 1; lane < 4; lane += 1) {
    ctx.beginPath();
    ctx.moveTo(lane * w, 20);
    ctx.lineTo(lane * w, state.height - 24);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(220,220,205,0.38)";
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(18, gateTop() - 8);
  ctx.lineTo(state.width - 18, gateTop() - 8);
  ctx.stroke();
  ctx.restore();
}

function drawCapsules() {
  const w = laneWidth();
  for (const capsule of state.capsules) {
    const x = (capsule.lane + 0.5) * w;
    const color = COLORS[capsule.color];
    ctx.save();
    ctx.translate(x, capsule.y);
    ctx.rotate(Math.sin(capsule.spin) * 0.12);
    ctx.shadowColor = color.hex;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color.hex;
    roundedRect(-19, -27, 38, 54, 19);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    roundedRect(-8, -18, 6, 24, 4);
    ctx.fill();
    ctx.fillStyle = "#101316";
    ctx.font = "700 15px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(color.name, 3, 8);
    ctx.restore();
  }
}

function drawGates() {
  const w = laneWidth();
  const y = gateTop();
  for (let lane = 0; lane < 4; lane += 1) {
    const x = lane * w + 10;
    const gateWidth = w - 20;
    const color = COLORS[state.gateColors[lane]];
    ctx.save();
    ctx.shadowColor = color.hex;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color.hex;
    roundedRect(x, y, gateWidth, 62, 18);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(20,22,23,0.72)";
    roundedRect(x + 8, y + 9, gateWidth - 16, 44, 13);
    ctx.fill();
    ctx.fillStyle = "#f5f1df";
    ctx.font = "800 18px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${lane + 1} · ${color.name}`, x + gateWidth / 2, y + 31);
    ctx.restore();
  }
}

function drawSparks() {
  for (const spark of state.sparks) {
    const alpha = 1 - spark.age / spark.life;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 2.4 + alpha * 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawStatusBanner() {
  ctx.save();
  ctx.fillStyle = "rgba(245, 241, 223, 0.9)";
  ctx.font = "700 13px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText(`ROUND ${state.round}`, 18, 28);
  ctx.textAlign = "right";
  ctx.fillText(`${state.score}/${state.target}`, state.width - 18, 28);
  ctx.restore();
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground();
  drawLanes();
  drawCapsules();
  drawGates();
  drawSparks();
  drawStatusBanner();
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

function handlePointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (state.phase === "idle" || state.phase === "failed") {
    resetRun(1);
    return;
  }

  if (state.phase === "cleared") {
    resetRun(state.round + 1);
    return;
  }

  if (y >= gateTop() - 22) {
    const lane = Math.max(0, Math.min(3, Math.floor(x / laneWidth())));
    cycleGate(lane);
  }
}

function handleKey(event) {
  if (event.key === " " || event.key === "Enter") {
    if (state.phase === "idle" || state.phase === "failed") resetRun(1);
    if (state.phase === "cleared") resetRun(state.round + 1);
  }
  if (event.key.toLowerCase() === "r") {
    resetRun(1);
  }
  const lane = Number(event.key) - 1;
  if (lane >= 0 && lane < 4) {
    cycleGate(lane);
  }
}

function loop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const delta = Math.min(40, timestamp - state.lastTime);
  state.lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    resetRun(state.round + 1);
  } else {
    resetRun(1);
  }
});

resetButton.addEventListener("click", () => resetRun(1));
canvas.addEventListener("pointerdown", handlePointer);
window.addEventListener("keydown", handleKey);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
showOverlay("시작", "게이트 색을 조율하세요", "캡슐이 기준선에 닿기 전 같은 색 게이트로 맞추면 처리됩니다. 통과하면 자동으로 더 어려운 다음 라운드에 진입합니다.", "시작");
updateHud();
requestAnimationFrame(loop);
