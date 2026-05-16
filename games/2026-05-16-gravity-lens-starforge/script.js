"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const dom = {
  round: document.getElementById("roundValue"),
  lit: document.getElementById("litValue"),
  target: document.getElementById("targetValue"),
  energy: document.getElementById("energyValue"),
  noise: document.getElementById("noiseValue"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  startButton: document.getElementById("startButton"),
  resetButton: document.getElementById("resetButton"),
};

const state = {
  phase: "idle",
  round: 1,
  energy: 100,
  lens: { x: 0.46, y: 0.52 },
  pointerDown: false,
  cores: [],
  noise: [],
  sparks: [],
  lastTime: 0,
  raf: 0,
};

function targetCountFor(round) {
  return Math.min(7, 3 + Math.floor((round - 1) / 2));
}

function noiseCountFor(round) {
  return Math.min(5, 1 + Math.floor(round / 2));
}

function chargeNeededFor(round) {
  return Math.max(0.78, 1.25 - round * 0.045);
}

function startRound(round = 1) {
  state.phase = "running";
  state.round = round;
  state.energy = 100;
  state.lens = { x: 0.44, y: 0.52 };
  state.cores = buildCores(round);
  state.noise = buildNoise(round);
  state.sparks = [];
  state.lastTime = performance.now();
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 광선을 별핵에 고정해 ${state.cores.length}개를 모두 점화하세요.`);
  renderHud();
}

function buildCores(round) {
  const count = targetCountFor(round);
  const cores = [];
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    cores.push({
      x: 0.62 + (index % 2) * 0.18 + Math.sin(round * 1.7 + index) * 0.025,
      y: 0.18 + t * 0.64 + Math.cos(round * 1.3 + index) * 0.035,
      charge: 0,
      lit: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }
  return cores;
}

function buildNoise(round) {
  const count = noiseCountFor(round);
  const nodes = [];
  for (let index = 0; index < count; index += 1) {
    nodes.push({
      x: 0.44 + Math.random() * 0.38,
      y: 0.18 + Math.random() * 0.64,
      r: 0.045 + Math.random() * 0.022,
      phase: Math.random() * Math.PI * 2,
      speed: 0.45 + round * 0.05 + Math.random() * 0.22,
    });
  }
  return nodes;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(rect.width * scale));
  canvas.height = Math.max(320, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function loop(now) {
  const dt = Math.min(0.04, Math.max(0, (now - state.lastTime) / 1000 || 0));
  state.lastTime = now;
  update(dt, now / 1000);
  draw(now / 1000);
  state.raf = window.requestAnimationFrame(loop);
}

function update(dt, time) {
  if (state.phase !== "running") {
    return;
  }
  const beam = traceBeam();
  const drain = 2.6 + state.round * 0.16;
  state.energy -= dt * drain;

  for (const node of state.noise) {
    node.y += Math.sin(time * node.speed + node.phase) * dt * 0.018;
    const hit = beam.some((point) => distance(point, node) < node.r + 0.018);
    if (hit) {
      state.energy -= dt * (11 + state.round * 0.9);
      addSpark(node.x, node.y, "#b56a5a", 1);
    }
  }

  let charging = false;
  for (const core of state.cores) {
    if (core.lit) {
      continue;
    }
    const hit = beam.some((point) => distance(point, core) < 0.038);
    if (hit) {
      core.charge += dt;
      charging = true;
      addSpark(core.x, core.y, "#dfb46e", 0.45);
      if (core.charge >= chargeNeededFor(state.round)) {
        core.lit = true;
        core.charge = chargeNeededFor(state.round);
        setMessage("별핵 점화 완료. 다음 별핵으로 광선을 옮기세요.");
        burst(core.x, core.y);
      }
    } else {
      core.charge = Math.max(0, core.charge - dt * 0.35);
    }
  }

  if (charging) {
    state.energy = Math.min(100, state.energy + dt * 1.8);
  }
  state.sparks = state.sparks.filter((spark) => {
    spark.life -= dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    return spark.life > 0;
  });

  if (state.cores.every((core) => core.lit)) {
    clearRound();
    return;
  }
  if (state.energy <= 0) {
    failRun("에너지가 모두 소진되었습니다.");
    return;
  }
  renderHud();
}

function traceBeam() {
  const points = [];
  const source = { x: 0.08, y: 0.5 };
  const end = { x: 0.97, y: 0.5 };
  const pull = 0.43 / (0.18 + Math.abs(state.lens.x - 0.36));
  for (let index = 0; index <= 84; index += 1) {
    const t = index / 84;
    const falloff = Math.sin(Math.PI * t);
    const curve = (state.lens.y - 0.5) * falloff * pull;
    const gravityDip = (state.lens.x - t) * falloff * -0.07;
    points.push({
      x: source.x + (end.x - source.x) * t,
      y: source.y + curve + gravityDip,
    });
  }
  return points;
}

function clearRound() {
  state.phase = "cleared";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "점화 성공";
  dom.overlayTitle.textContent = `라운드 ${state.round} 완료`;
  dom.overlayText.textContent = "다음 라운드는 별핵과 노이즈가 늘고 에너지 소모가 빨라집니다.";
  dom.startButton.textContent = `라운드 ${state.round + 1}`;
  setMessage(`성공. 곧 라운드 ${state.round + 1}로 이동합니다.`);
  renderHud();
  window.setTimeout(() => {
    if (state.phase === "cleared") {
      startRound(state.round + 1);
    }
  }, 900);
}

function failRun(reason) {
  state.phase = "failed";
  dom.overlay.classList.remove("hidden");
  dom.overlayLabel.textContent = "실패";
  dom.overlayTitle.textContent = "라운드 1로 복귀";
  dom.overlayText.textContent = `${reason} 렌즈 위치를 더 부드럽게 조정해 노이즈 구체를 피하세요.`;
  dom.startButton.textContent = "라운드 1";
  setMessage("실패하면 모든 진행이 초기화됩니다. 라운드 1부터 다시 시작하세요.");
  renderHud();
}

function draw(time) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  drawBackground(w, h);
  const beam = traceBeam();
  drawBeam(beam, w, h);
  drawCores(w, h, time);
  drawNoise(w, h, time);
  drawLens(w, h, time);
  drawSparks(w, h);
}

function drawBackground(w, h) {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#171713");
  gradient.addColorStop(1, "#25231e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 250, 240, 0.055)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h * 0.22, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 52) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y - w * 0.12);
    ctx.stroke();
  }
}

function drawBeam(points, w, h) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [width, alpha] of [[18, 0.06], [9, 0.13], [3, 0.92]]) {
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = point.x * w;
      const y = point.y * h;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = `rgba(255, 244, 211, ${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
}

function drawCores(w, h, time) {
  for (const core of state.cores) {
    const x = core.x * w;
    const y = core.y * h;
    const progress = core.charge / chargeNeededFor(state.round);
    const radius = 18 + Math.sin(time * 3 + core.pulse) * 2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 9, 0, Math.PI * 2);
    ctx.fillStyle = core.lit ? "rgba(223, 180, 110, 0.22)" : "rgba(255, 250, 240, 0.08)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = core.lit ? "#dfb46e" : "rgba(255, 250, 240, 0.42)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, radius - 6, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = "#dfb46e";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = core.lit ? "#fff0c2" : "rgba(255, 250, 240, 0.72)";
    ctx.font = "700 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(core.lit ? "점화" : "별핵", x, y + 4);
  }
}

function drawNoise(w, h, time) {
  for (const node of state.noise) {
    const x = node.x * w;
    const y = node.y * h;
    const r = node.r * Math.min(w, h) * (1 + Math.sin(time * 2.2 + node.phase) * 0.06);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(157, 63, 52, 0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(226, 118, 99, 0.64)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawLens(w, h, time) {
  const x = state.lens.x * w;
  const y = state.lens.y * h;
  const r = 34 + Math.sin(time * 4) * 2;
  ctx.beginPath();
  ctx.arc(x, y, r + 18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(82, 112, 131, 0.16)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#8fb1c0";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#fffaf0";
  ctx.fill();
}

function drawSparks(w, h) {
  for (const spark of state.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife);
    ctx.beginPath();
    ctx.arc(spark.x * w, spark.y * h, spark.size, 0, Math.PI * 2);
    ctx.fillStyle = spark.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function addSpark(x, y, color, chance) {
  if (Math.random() > chance) {
    return;
  }
  state.sparks.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 0.08,
    vy: (Math.random() - 0.5) * 0.08,
    size: 1.5 + Math.random() * 2.5,
    color,
    life: 0.35 + Math.random() * 0.35,
    maxLife: 0.7,
  });
}

function burst(x, y) {
  for (let index = 0; index < 24; index += 1) {
    addSpark(x, y, "#fff0c2", 1);
  }
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function renderHud() {
  dom.round.textContent = String(state.round);
  dom.lit.textContent = String(state.cores.filter((core) => core.lit).length);
  dom.target.textContent = String(state.cores.length || targetCountFor(state.round));
  dom.energy.textContent = String(Math.max(0, Math.ceil(state.energy)));
  dom.noise.textContent = `${state.noise.length || noiseCountFor(state.round)}개`;
}

function setMessage(text) {
  dom.message.textContent = text;
}

function setLensFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  state.lens.x = Math.max(0.18, Math.min(0.9, (event.clientX - rect.left) / rect.width));
  state.lens.y = Math.max(0.12, Math.min(0.88, (event.clientY - rect.top) / rect.height));
}

function handleStart() {
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  startRound(1);
}

canvas.addEventListener("pointerdown", (event) => {
  state.pointerDown = true;
  canvas.setPointerCapture(event.pointerId);
  if (state.phase !== "running") {
    startRound(1);
  }
  setLensFromEvent(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.pointerDown && state.phase === "running") {
    return;
  }
  setLensFromEvent(event);
});

canvas.addEventListener("pointerup", (event) => {
  state.pointerDown = false;
  canvas.releasePointerCapture(event.pointerId);
});

dom.startButton.addEventListener("click", handleStart);
dom.resetButton.addEventListener("click", () => startRound(1));

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "enter" || key === " ") {
    event.preventDefault();
    if (state.phase !== "running") {
      handleStart();
    }
    return;
  }
  if (key === "escape") {
    startRound(1);
    return;
  }
  const step = event.shiftKey ? 0.045 : 0.025;
  if (["arrowleft", "a"].includes(key)) {
    state.lens.x = Math.max(0.18, state.lens.x - step);
  } else if (["arrowright", "d"].includes(key)) {
    state.lens.x = Math.min(0.9, state.lens.x + step);
  } else if (["arrowup", "w"].includes(key)) {
    state.lens.y = Math.max(0.12, state.lens.y - step);
  } else if (["arrowdown", "s"].includes(key)) {
    state.lens.y = Math.min(0.88, state.lens.y + step);
  }
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
renderHud();
state.lastTime = performance.now();
state.raf = window.requestAnimationFrame(loop);
