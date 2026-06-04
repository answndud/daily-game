const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d");
const roundEl = document.querySelector("#round");
const stageEl = document.querySelector("#stage");
const energyEl = document.querySelector("#energy");
const statusEl = document.querySelector("#status");
const restartBtn = document.querySelector("#restart");

const state = {
  round: 1,
  stage: 1,
  stagesNeeded: 2,
  energy: 100,
  pulse: { x: 120, y: 120, vx: 2.2, vy: 1.7, lastHit: -1 },
  reflectors: [],
  targets: [],
  lastTime: 0,
  running: true
};

function config() {
  return {
    stagesNeeded: Math.min(4, 2 + Math.floor((state.round - 1) / 2)),
    targetCount: Math.min(5, 2 + Math.floor(state.round / 2)),
    speed: 2.2 + state.round * 0.22,
    drain: 0.018 + state.round * 0.004
  };
}

function setStatus(message) {
  statusEl.textContent = message;
}

function resetRun() {
  state.round = 1;
  state.stage = 1;
  startStage("라운드 1부터 다시 시작합니다.");
}

function startStage(message = "반사판을 눌러 펄스 궤도를 바꾸세요.") {
  const c = config();
  state.stagesNeeded = c.stagesNeeded;
  state.energy = 100;
  state.pulse = {
    x: 92 + state.stage * 18,
    y: 108 + state.round * 9,
    vx: c.speed,
    vy: c.speed * (0.62 + state.stage * 0.08),
    lastHit: -1
  };
  state.reflectors = makeReflectors();
  state.targets = makeTargets(c.targetCount);
  state.running = true;
  setStatus(message);
  renderHud();
  draw();
}

function makeReflectors() {
  const shift = (state.round + state.stage) % 3;
  return [
    { x: 190, y: 210, angle: 25 + shift * 20 },
    { x: 430, y: 210, angle: 135 - shift * 15 },
    { x: 220, y: 435, angle: 330 + shift * 12 },
    { x: 455, y: 420, angle: 45 + shift * 18 }
  ];
}

function makeTargets(count) {
  const points = [
    [510, 120],
    [510, 525],
    [115, 510],
    [320, 105],
    [330, 535]
  ];
  return points.slice(0, count).map(([x, y], index) => ({
    x,
    y,
    r: 24,
    done: false,
    index
  }));
}

function renderHud() {
  roundEl.textContent = state.round;
  stageEl.textContent = `${state.stage}/${state.stagesNeeded}`;
  energyEl.textContent = Math.max(0, Math.ceil(state.energy));
}

function rotateReflector(index) {
  const reflector = state.reflectors[index];
  reflector.angle = (reflector.angle + 45) % 360;
  setStatus(`${index + 1}번 반사판 각도를 조정했습니다.`);
  draw();
}

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function handlePointer(event) {
  const point = pointerToCanvas(event);
  const hit = state.reflectors.findIndex((reflector) => {
    const dx = point.x - reflector.x;
    const dy = point.y - reflector.y;
    return Math.hypot(dx, dy) < 48;
  });
  if (hit >= 0) {
    rotateReflector(hit);
  }
}

function tick(time) {
  if (!state.lastTime) {
    state.lastTime = time;
  }
  const delta = Math.min(32, time - state.lastTime);
  state.lastTime = time;

  if (state.running) {
    step(delta / 16.67);
    draw();
  }
  requestAnimationFrame(tick);
}

function step(scale) {
  const p = state.pulse;
  p.x += p.vx * scale;
  p.y += p.vy * scale;
  state.energy -= config().drain * scale;

  if (p.x < 18 || p.x > canvas.width - 18) {
    p.vx *= -1;
    p.x = Math.max(18, Math.min(canvas.width - 18, p.x));
    p.lastHit = -1;
  }
  if (p.y < 18 || p.y > canvas.height - 18) {
    p.vy *= -1;
    p.y = Math.max(18, Math.min(canvas.height - 18, p.y));
    p.lastHit = -1;
  }

  state.reflectors.forEach((reflector, index) => reflectPulse(reflector, index));
  state.targets.forEach((target) => {
    if (!target.done && Math.hypot(p.x - target.x, p.y - target.y) < target.r) {
      target.done = true;
      state.energy = Math.min(100, state.energy + 16);
      setStatus("목표 링을 통과했습니다. 남은 링을 이어서 노리세요.");
    }
  });

  if (state.targets.every((target) => target.done)) {
    advanceStage();
    return;
  }

  if (state.energy <= 0) {
    state.round = 1;
    state.stage = 1;
    startStage("에너지가 떨어졌습니다. 실패 처리되어 라운드 1로 돌아갑니다.");
    return;
  }

  renderHud();
}

function reflectPulse(reflector, index) {
  const p = state.pulse;
  const rad = reflector.angle * Math.PI / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const dx = p.x - reflector.x;
  const dy = p.y - reflector.y;
  const along = dx * ux + dy * uy;
  const perp = dx * -uy + dy * ux;

  if (Math.abs(along) < 48 && Math.abs(perp) < 12 && p.lastHit !== index) {
    const dot = p.vx * -uy + p.vy * ux;
    p.vx -= 2 * dot * -uy;
    p.vy -= 2 * dot * ux;
    p.lastHit = index;
    state.energy = Math.max(0, state.energy - 2);
    setStatus("펄스가 반사판에 튕겼습니다.");
  }

  if (Math.abs(perp) > 22) {
    p.lastHit = -1;
  }
}

function advanceStage() {
  if (state.stage >= state.stagesNeeded) {
    state.round += 1;
    state.stage = 1;
    startStage(`라운드 클리어. 더 빠른 펄스의 라운드 ${state.round}로 바로 이동했습니다.`);
    return;
  }

  state.stage += 1;
  startStage("실험 성공. 다음 목표 배치로 넘어갑니다.");
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  state.targets.forEach(drawTarget);
  state.reflectors.forEach(drawReflector);
  drawPulse();
}

function drawGrid() {
  ctx.fillStyle = "#f9f6ef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#e3ded3";
  ctx.lineWidth = 1;
  for (let x = 64; x < canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 64; y < canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawTarget(target) {
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2);
  ctx.strokeStyle = target.done ? "#4f7466" : "#a25c35";
  ctx.lineWidth = target.done ? 5 : 3;
  ctx.stroke();
  ctx.fillStyle = target.done ? "rgba(79, 116, 102, 0.12)" : "rgba(162, 92, 53, 0.10)";
  ctx.fill();
}

function drawReflector(reflector, index) {
  const rad = reflector.angle * Math.PI / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#242320";
  ctx.beginPath();
  ctx.moveTo(reflector.x - ux * 42, reflector.y - uy * 42);
  ctx.lineTo(reflector.x + ux * 42, reflector.y + uy * 42);
  ctx.stroke();
  ctx.fillStyle = "#fffefa";
  ctx.beginPath();
  ctx.arc(reflector.x, reflector.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#242320";
  ctx.font = "700 13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(index + 1), reflector.x, reflector.y);
}

function drawPulse() {
  const p = state.pulse;
  ctx.fillStyle = "#4f7466";
  ctx.beginPath();
  ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(79, 116, 102, 0.28)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
  ctx.stroke();
}

canvas.addEventListener("pointerdown", handlePointer);
restartBtn.addEventListener("click", resetRun);
document.addEventListener("keydown", (event) => {
  const index = Number(event.key) - 1;
  if (index >= 0 && index < state.reflectors.length) {
    rotateReflector(index);
  }
});

startStage();
requestAnimationFrame(tick);
