const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const roundValue = document.querySelector("#roundValue");
const scoreValue = document.querySelector("#scoreValue");
const targetValue = document.querySelector("#targetValue");
const faultValue = document.querySelector("#faultValue");
const timeValue = document.querySelector("#timeValue");
const messageLine = document.querySelector("#messageLine");
const overlay = document.querySelector("#overlay");
const overlayLabel = document.querySelector("#overlayLabel");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");

const palette = {
  ink: "#f7f1df",
  muted: "#aaa79f",
  grid: "rgba(255,255,255,0.09)",
  node: "#487d8d",
  nodeHot: "#c08b4a",
  trace: "#f0d08a",
  wrong: "#a95a58"
};

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  phase: "idle",
  round: 1,
  score: 0,
  target: 4,
  faults: 0,
  timeLeft: 10000,
  timeLimit: 10000,
  nodes: [],
  route: [],
  progress: 0,
  pointer: null,
  trail: [],
  sparks: [],
  lastTime: 0,
  nextRoundTimer: 0,
  shake: 0
};

function targetFor(round) {
  return Math.min(9, 3 + round);
}

function nodeCountFor(round) {
  return Math.min(10, 5 + round);
}

function routeLengthFor(round) {
  return Math.min(7, 3 + Math.floor(round / 2));
}

function timeLimitFor(round) {
  return Math.max(5200, 11200 - round * 760);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = rect.width;
  state.height = rect.height;
  canvas.width = Math.round(rect.width * state.dpr);
  canvas.height = Math.round(rect.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  if (state.phase !== "idle") {
    buildRoundGeometry();
    createRoute();
  }
}

function startRound(round = 1) {
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.target = targetFor(round);
  state.faults = 0;
  state.timeLimit = timeLimitFor(round);
  state.sparks = [];
  state.trail = [];
  state.pointer = null;
  state.nextRoundTimer = 0;
  state.shake = 0;
  hideOverlay();
  buildRoundGeometry();
  createRoute();
  setMessage(`라운드 ${round}: 1번 노드에서 시작해 순서대로 이어 주세요.`);
  updateHud();
}

function buildRoundGeometry() {
  const count = nodeCountFor(state.round);
  const marginX = Math.max(34, state.width * 0.11);
  const top = Math.max(72, state.height * 0.13);
  const bottom = state.height - 104;
  const centerX = state.width / 2;
  const centerY = (top + bottom) / 2;
  const rx = Math.max(76, (state.width - marginX * 2) / 2);
  const ry = Math.max(118, (bottom - top) / 2);

  state.nodes = Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count + (state.round % 3) * 0.1;
    const wobble = 0.82 + ((index * 17 + state.round * 11) % 19) / 100;
    return {
      x: centerX + Math.cos(angle) * rx * wobble,
      y: centerY + Math.sin(angle) * ry * (0.88 + (index % 2) * 0.08),
      label: index + 1
    };
  });
}

function createRoute() {
  const length = routeLengthFor(state.round);
  const available = state.nodes.map((_, index) => index);
  const start = Math.floor(Math.random() * available.length);
  const route = [available.splice(start, 1)[0]];

  while (route.length < length && available.length) {
    const lastNode = state.nodes[route[route.length - 1]];
    available.sort((a, b) => distanceScore(lastNode, state.nodes[a]) - distanceScore(lastNode, state.nodes[b]));
    const pickWindow = Math.min(3, available.length);
    const pick = Math.floor(Math.random() * pickWindow);
    route.push(available.splice(pick, 1)[0]);
  }

  state.route = route;
  state.progress = 0;
  state.timeLeft = state.timeLimit;
  state.trail = [];
  state.pointer = null;
}

function distanceScore(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function hitRadius() {
  return Math.max(24, Math.min(34, state.width * 0.065));
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function nearestNode(point) {
  let best = null;
  let bestDistance = Infinity;
  state.nodes.forEach((node, index) => {
    const distance = Math.hypot(point.x - node.x, point.y - node.y);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return bestDistance <= hitRadius() ? best : null;
}

function beginTrace(event) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  if (state.phase !== "running") return;

  const point = pointerPosition(event);
  const hit = nearestNode(point);
  if (hit === state.route[0]) {
    state.pointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    state.progress = 1;
    state.trail = [point];
    pulseNode(hit, palette.trace, 12);
    setMessage("좋습니다. 다음 번호로 계속 이어 주세요.");
  } else if (hit !== null) {
    registerFault("시작점은 1번 노드입니다.");
  }
}

function moveTrace(event) {
  if (state.phase !== "running" || state.pointer !== event.pointerId) return;
  const point = pointerPosition(event);
  state.trail.push(point);
  if (state.trail.length > 80) state.trail.shift();

  const hit = nearestNode(point);
  if (hit === null) return;

  const expected = state.route[state.progress];
  if (hit === expected) {
    state.progress += 1;
    pulseNode(hit, palette.trace, 12);
    if (state.progress >= state.route.length) {
      completeRoute();
    } else {
      setMessage(`${state.progress + 1}번 노드로 이어가세요.`);
    }
    return;
  }

  if (!state.route.slice(0, state.progress).includes(hit)) {
    registerFault("경로를 벗어났습니다.");
  }
}

function endTrace(event) {
  if (state.pointer === event.pointerId) {
    state.pointer = null;
    state.trail = [];
  }
}

function completeRoute() {
  state.score += 1;
  state.pointer = null;
  state.trail = [];
  state.route.forEach((nodeIndex) => pulseNode(nodeIndex, palette.trace, 8));
  if (state.score >= state.target) {
    clearRound();
  } else {
    createRoute();
    setMessage(`회로 완성. ${state.target - state.score}개 더 완성하세요.`);
  }
  updateHud();
}

function registerFault(reason) {
  if (state.phase !== "running") return;
  state.faults += 1;
  state.pointer = null;
  state.trail = [];
  state.shake = 12;
  state.route.forEach((nodeIndex) => pulseNode(nodeIndex, palette.wrong, 7));
  if (state.faults >= 3) {
    failRun(reason);
  } else {
    createRoute();
    setMessage(`${reason} 실패 ${state.faults}/3. 새 경로가 열렸습니다.`);
  }
  updateHud();
}

function clearRound() {
  state.phase = "cleared";
  state.nextRoundTimer = 900;
  showOverlay("통과", `라운드 ${state.round + 1} 준비`, "다음 라운드는 노드가 늘고 제한 시간이 짧아집니다. 곧 자동으로 진행됩니다.", "즉시 진행");
  setMessage(`라운드 ${state.round} 완료. 난이도를 올립니다.`);
}

function failRun(reason) {
  state.phase = "failed";
  state.nextRoundTimer = 0;
  showOverlay("실패", "라운드 1로 복귀", `${reason} 다시 시작하면 라운드 1부터 진행합니다.`, "라운드 1 시작");
  setMessage("실패했습니다. 라운드 1부터 다시 시작하세요.");
}

function pulseNode(nodeIndex, color, count) {
  const node = state.nodes[nodeIndex];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 120;
    state.sparks.push({
      x: node.x,
      y: node.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 320 + Math.random() * 260,
      color
    });
  }
}

function update(delta) {
  if (state.phase === "running") {
    state.timeLeft -= delta;
    if (state.timeLeft <= 0) {
      registerFault("시간이 초과됐습니다.");
    }
  }

  if (state.phase === "cleared") {
    state.nextRoundTimer -= delta;
    if (state.nextRoundTimer <= 0) {
      startRound(state.round + 1);
    }
  }

  state.sparks.forEach((spark) => {
    spark.age += delta;
    spark.x += (spark.vx * delta) / 1000;
    spark.y += (spark.vy * delta) / 1000;
    spark.vy += (120 * delta) / 1000;
  });
  state.sparks = state.sparks.filter((spark) => spark.age < spark.life);
  state.shake = Math.max(0, state.shake - delta / 34);
  updateHud();
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground();
  drawRoute();
  drawTrail();
  drawNodes();
  drawSparks();
  drawTimer();
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#17191b");
  gradient.addColorStop(0.58, "#22282b");
  gradient.addColorStop(1, "#101214");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.save();
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  for (let y = 36; y < state.height; y += 42) {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(state.width - 18, y);
    ctx.stroke();
  }
  for (let x = 28; x < state.width; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, 22);
    ctx.lineTo(x, state.height - 22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoute() {
  if (!state.route.length) return;
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(240, 208, 138, 0.24)";
  ctx.beginPath();
  state.route.forEach((nodeIndex, order) => {
    const node = state.nodes[nodeIndex];
    if (order === 0) ctx.moveTo(node.x, node.y);
    else ctx.lineTo(node.x, node.y);
  });
  ctx.stroke();

  ctx.strokeStyle = palette.trace;
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  state.route.slice(0, Math.max(1, state.progress)).forEach((nodeIndex, order) => {
    const node = state.nodes[nodeIndex];
    if (order === 0) ctx.moveTo(node.x, node.y);
    else ctx.lineTo(node.x, node.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawTrail() {
  if (state.trail.length < 2) return;
  ctx.save();
  ctx.strokeStyle = "rgba(240, 208, 138, 0.72)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  state.trail.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawNodes() {
  const radius = hitRadius();
  state.nodes.forEach((node, index) => {
    const routeIndex = state.route.indexOf(index);
    const isRoute = routeIndex >= 0;
    const isDone = isRoute && routeIndex < state.progress;
    const isNext = isRoute && routeIndex === state.progress;

    ctx.save();
    ctx.fillStyle = isDone ? palette.trace : isNext ? palette.nodeHot : isRoute ? "#d8d1c2" : palette.node;
    ctx.globalAlpha = isRoute ? 1 : 0.55;
    ctx.shadowColor = isNext ? palette.nodeHot : "transparent";
    ctx.shadowBlur = isNext ? 18 : 0;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * (isNext ? 0.72 : 0.58), 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#151718";
    ctx.font = "800 15px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isRoute ? String(routeIndex + 1) : "·", node.x, node.y + 0.5);
    ctx.restore();
  });
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

function drawTimer() {
  const ratio = Math.max(0, state.timeLeft / state.timeLimit);
  const x = 18;
  const y = state.height - 34;
  const width = state.width - 36;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.11)";
  roundedRect(x, y, width, 10, 5);
  ctx.fill();
  ctx.fillStyle = ratio < 0.28 ? palette.wrong : palette.trace;
  roundedRect(x, y, width * ratio, 10, 5);
  ctx.fill();
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

function updateHud() {
  roundValue.textContent = state.round;
  scoreValue.textContent = state.score;
  targetValue.textContent = state.target;
  faultValue.textContent = state.faults;
  timeValue.textContent = Math.max(0, state.timeLeft / 1000).toFixed(1);
}

function handleKey(event) {
  if (event.key === "Enter" || event.key === " ") {
    if (state.phase === "cleared") startRound(state.round + 1);
    else if (state.phase !== "running") startRound(1);
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
canvas.addEventListener("pointerdown", beginTrace);
canvas.addEventListener("pointermove", moveTrace);
canvas.addEventListener("pointerup", endTrace);
canvas.addEventListener("pointercancel", endTrace);
window.addEventListener("keydown", handleKey);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
buildRoundGeometry();
createRoute();
showOverlay("시작", "경로를 이어 주세요", "1번 노드에서 시작해 숫자 순서대로 손가락을 끌면 회로가 완성됩니다.", "시작");
updateHud();
requestAnimationFrame(loop);
