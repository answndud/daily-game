const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const roundValue = document.querySelector("#roundValue");
const scoreValue = document.querySelector("#scoreValue");
const targetValue = document.querySelector("#targetValue");
const faultValue = document.querySelector("#faultValue");
const tempoValue = document.querySelector("#tempoValue");
const messageLine = document.querySelector("#messageLine");
const overlay = document.querySelector("#overlay");
const overlayLabel = document.querySelector("#overlayLabel");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const choiceButtons = [...document.querySelectorAll(".choice-button")];

const colors = {
  text: "#f6f0de",
  muted: "#aaa49a",
  grid: "rgba(255,255,255,0.08)",
  beat: "#bd8b4b",
  lane: "#567f86",
  danger: "#a45d59",
  lantern: "#f1ead8"
};

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  phase: "idle",
  round: 1,
  score: 0,
  target: 9,
  faults: 0,
  tempo: 72,
  requests: [],
  spawnTimer: 0,
  beatPulse: 0,
  lastTime: 0,
  nextRoundTimer: 0,
  shake: 0,
  sparks: []
};

function targetFor(round) {
  return Math.min(18, 7 + round * 2);
}

function tempoFor(round) {
  return Math.min(132, 66 + round * 6);
}

function fallSpeedFor(round) {
  return 104 + round * 14;
}

function hitWindowFor(round) {
  return Math.max(34, 58 - round * 2.4);
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
  state.tempo = tempoFor(round);
  state.requests = [];
  state.spawnTimer = 240;
  state.beatPulse = 0;
  state.nextRoundTimer = 0;
  state.shake = 0;
  state.sparks = [];
  hideOverlay();
  setMessage(`라운드 ${round}: 박자선에 닿은 가장 긴급한 랜턴 번호를 누르세요.`);
  updateHud();
}

function beatLine() {
  return state.height - 150;
}

function laneCenter(lane) {
  return (lane + 0.5) * (state.width / 3);
}

function spawnDelay() {
  return Math.max(420, 1080 - state.round * 70);
}

function spawnRequest() {
  const occupied = new Set(state.requests.map((request) => request.lane));
  const open = [0, 1, 2].filter((lane) => !occupied.has(lane));
  const lane = open.length ? open[Math.floor(Math.random() * open.length)] : Math.floor(Math.random() * 3);
  const priorityMax = Math.min(5, 2 + Math.floor(state.round / 2));
  state.requests.push({
    lane,
    y: -48,
    priority: 1 + Math.floor(Math.random() * priorityMax),
    speed: fallSpeedFor(state.round) + Math.random() * 18,
    wobble: Math.random() * Math.PI * 2
  });
}

function chooseLane(lane) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  if (state.phase !== "running") return;

  const candidates = state.requests.filter((request) => Math.abs(request.y - beatLine()) <= hitWindowFor(state.round));
  if (candidates.length === 0) {
    registerFault("박자선에 닿은 랜턴이 없습니다.");
    return;
  }

  candidates.sort((a, b) => b.priority - a.priority || b.y - a.y);
  const expected = candidates[0];
  if (expected.lane !== lane) {
    registerFault(`${expected.lane + 1}번 랜턴이 더 긴급했습니다.`);
    return;
  }

  state.score += 1;
  state.beatPulse = 1;
  burst(expected, colors.beat, 18);
  state.requests = state.requests.filter((request) => request !== expected);
  if (state.score >= state.target) {
    clearRound();
  } else {
    setMessage(`처리 성공. ${state.target - state.score}개 남았습니다.`);
  }
  updateHud();
}

function registerFault(reason) {
  if (state.phase !== "running") return;
  state.faults += 1;
  state.shake = 12;
  state.beatPulse = -1;
  const request = state.requests.find((item) => Math.abs(item.y - beatLine()) <= hitWindowFor(state.round));
  if (request) burst(request, colors.danger, 16);
  if (state.faults >= 3) {
    failRun(reason);
  } else {
    setMessage(`${reason} 오판 ${state.faults}/3.`);
  }
  updateHud();
}

function clearRound() {
  state.phase = "cleared";
  state.nextRoundTimer = 900;
  state.requests = [];
  showOverlay("통과", `라운드 ${state.round + 1} 준비`, "다음 라운드는 템포가 빨라지고 우선순위 단계가 촘촘해집니다.", "즉시 진행");
  setMessage(`라운드 ${state.round} 완료. 난이도가 상승합니다.`);
}

function failRun(reason) {
  state.phase = "failed";
  state.nextRoundTimer = 0;
  state.requests = [];
  showOverlay("실패", "라운드 1로 복귀", `${reason} 다시 시작하면 라운드 1부터 진행합니다.`, "라운드 1 시작");
  setMessage("실패했습니다. 라운드 1부터 다시 시작하세요.");
}

function burst(request, color, count) {
  const x = laneCenter(request.lane);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 150;
    state.sparks.push({
      x,
      y: request.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 340 + Math.random() * 260,
      color
    });
  }
}

function update(delta) {
  const seconds = delta / 1000;
  if (state.phase === "running") {
    state.spawnTimer -= delta;
    if (state.spawnTimer <= 0) {
      spawnRequest();
      state.spawnTimer += spawnDelay();
    }

    for (const request of state.requests) {
      request.y += request.speed * seconds;
      request.wobble += seconds * 3;
    }

    const missed = state.requests.find((request) => request.y > beatLine() + hitWindowFor(state.round) + 28);
    if (missed) {
      state.requests = state.requests.filter((request) => request !== missed);
      registerFault(`${missed.lane + 1}번 랜턴을 놓쳤습니다.`);
    }
  }

  if (state.phase === "cleared") {
    state.nextRoundTimer -= delta;
    if (state.nextRoundTimer <= 0) startRound(state.round + 1);
  }

  for (const spark of state.sparks) {
    spark.age += delta;
    spark.x += spark.vx * seconds;
    spark.y += spark.vy * seconds;
    spark.vy += 110 * seconds;
  }
  state.sparks = state.sparks.filter((spark) => spark.age < spark.life);
  state.shake = Math.max(0, state.shake - delta / 34);
  state.beatPulse *= 0.9;
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground();
  drawLanes();
  drawRequests();
  drawSparks();
  drawLabels();
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#17191b");
  gradient.addColorStop(0.58, "#24282a");
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

function drawLanes() {
  const laneWidth = state.width / 3;
  ctx.save();
  for (let lane = 0; lane < 3; lane += 1) {
    ctx.fillStyle = lane % 2 === 0 ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.015)";
    ctx.fillRect(lane * laneWidth, 0, laneWidth, state.height);
    ctx.fillStyle = colors.muted;
    ctx.font = "900 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`LANE ${lane + 1}`, laneCenter(lane), 32);
  }

  const pulseColor = state.beatPulse < 0 ? colors.danger : colors.beat;
  ctx.strokeStyle = pulseColor;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 5 + Math.abs(state.beatPulse) * 4;
  ctx.beginPath();
  ctx.moveTo(22, beatLine());
  ctx.lineTo(state.width - 22, beatLine());
  ctx.stroke();

  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 1;
  ctx.setLineDash([7, 10]);
  ctx.beginPath();
  ctx.moveTo(22, beatLine() - hitWindowFor(state.round));
  ctx.lineTo(state.width - 22, beatLine() - hitWindowFor(state.round));
  ctx.moveTo(22, beatLine() + hitWindowFor(state.round));
  ctx.lineTo(state.width - 22, beatLine() + hitWindowFor(state.round));
  ctx.stroke();
  ctx.restore();
}

function drawRequests() {
  for (const request of state.requests) {
    const x = laneCenter(request.lane) + Math.sin(request.wobble) * 5;
    ctx.save();
    ctx.translate(x, request.y);
    ctx.shadowColor = priorityColor(request.priority);
    ctx.shadowBlur = 14;
    ctx.fillStyle = colors.lantern;
    roundedRect(-42, -32, 84, 64, 18);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = priorityColor(request.priority);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#151718";
    ctx.font = "900 23px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`P${request.priority}`, 0, -4);
    ctx.font = "800 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText(`${request.lane + 1}`, 0, 18);
    ctx.restore();
  }
}

function priorityColor(priority) {
  return priority >= 4 ? colors.danger : priority >= 3 ? colors.beat : colors.lane;
}

function drawSparks() {
  for (const spark of state.sparks) {
    const alpha = 1 - spark.age / spark.life;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 2 + alpha * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawLabels() {
  ctx.save();
  ctx.fillStyle = colors.text;
  ctx.font = "800 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("highest priority at beat line", state.width / 2, beatLine() - 15);
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

function updateHud() {
  roundValue.textContent = state.round;
  scoreValue.textContent = state.score;
  targetValue.textContent = state.target;
  faultValue.textContent = state.faults;
  tempoValue.textContent = state.tempo;
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
  const lane = Number(event.key) - 1;
  if (lane >= 0 && lane < 3) chooseLane(lane);
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

choiceButtons.forEach((button) => {
  button.addEventListener("click", () => chooseLane(Number(button.dataset.lane)));
});
startButton.addEventListener("click", () => {
  if (state.phase === "cleared") startRound(state.round + 1);
  else startRound(1);
});
resetButton.addEventListener("click", () => startRound(1));
window.addEventListener("keydown", handleKey);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
showOverlay("시작", "긴급한 랜턴을 고르세요", "랜턴이 박자선에 닿을 때 가장 높은 PRIORITY 번호를 누르세요. 같은 우선순위면 더 아래쪽 랜턴이 먼저입니다.", "시작");
updateHud();
requestAnimationFrame(loop);
