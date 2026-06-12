(function () {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const roundText = document.querySelector("#roundText");
  const coreText = document.querySelector("#coreText");
  const energyText = document.querySelector("#energyText");
  const fieldText = document.querySelector("#fieldText");
  const statusText = document.querySelector("#statusText");
  const fieldButtons = Array.from(document.querySelectorAll("[data-field]"));
  const restartButton = document.querySelector("#restartButton");

  const FIELD_NAMES = {
    "-1": "밀어냄",
    0: "중립",
    1: "끌어당김"
  };

  const state = {
    round: 1,
    field: 0,
    energy: 100,
    capsule: { x: 72, y: 270, vx: 0.9, vy: -0.7 },
    cores: [],
    hazards: [],
    running: true,
    lastTime: 0,
    frameId: 0
  };

  function config() {
    return {
      coreCount: Math.min(6, 3 + Math.floor((state.round - 1) / 2)),
      hazardCount: Math.min(4, Math.floor(state.round / 2)),
      drain: 5.8 + state.round * 0.75,
      force: 58 + state.round * 4,
      speedLimit: 178 + state.round * 6
    };
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function seededPoint(seed, min, max) {
    const raw = Math.sin(seed * 91.73 + state.round * 17.13) * 10000;
    return min + (raw - Math.floor(raw)) * (max - min);
  }

  function makeCores() {
    const count = config().coreCount;
    const cores = [];
    for (let index = 0; index < count; index += 1) {
      cores.push({
        x: seededPoint(index + 1, 62, 298),
        y: seededPoint(index + 11, 58, 292),
        r: 13,
        done: false
      });
    }
    return cores;
  }

  function makeHazards() {
    const count = config().hazardCount;
    const hazards = [];
    for (let index = 0; index < count; index += 1) {
      hazards.push({
        x: seededPoint(index + 21, 72, 288),
        y: seededPoint(index + 31, 72, 288),
        r: 16 + (index % 2) * 6
      });
    }
    return hazards;
  }

  function resetRound(message) {
    state.energy = 100;
    state.field = 0;
    state.running = true;
    state.capsule = {
      x: 70 + (state.round % 3) * 18,
      y: 282 - (state.round % 2) * 28,
      vx: 0.8 + state.round * 0.05,
      vy: -0.65
    };
    state.cores = makeCores();
    state.hazards = makeHazards();
    state.lastTime = 0;
    setStatus(message || "자기장을 전환해 모든 코어를 통과하세요.");
    renderHud();
  }

  function resetRun(message) {
    state.round = 1;
    resetRound(message || "실패했습니다. 라운드 1로 돌아갑니다.");
  }

  function renderHud() {
    const collected = state.cores.filter((core) => core.done).length;
    roundText.textContent = String(state.round);
    coreText.textContent = `${collected} / ${state.cores.length}`;
    energyText.textContent = String(Math.max(0, Math.ceil(state.energy)));
    fieldText.textContent = FIELD_NAMES[state.field];
    fieldButtons.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.field) === state.field);
    });
  }

  function setField(value) {
    state.field = value;
    renderHud();
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function nearestOpenCore() {
    let best = null;
    state.cores.forEach((core) => {
      if (core.done) {
        return;
      }
      if (!best || distance(state.capsule, core) < distance(state.capsule, best)) {
        best = core;
      }
    });
    return best;
  }

  function limitVelocity() {
    const limit = config().speedLimit;
    const speed = Math.hypot(state.capsule.vx, state.capsule.vy);
    if (speed > limit) {
      state.capsule.vx = (state.capsule.vx / speed) * limit;
      state.capsule.vy = (state.capsule.vy / speed) * limit;
    }
  }

  function updatePhysics(dt) {
    const target = nearestOpenCore() || { x: 180, y: 180 };
    const dx = target.x - state.capsule.x;
    const dy = target.y - state.capsule.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const force = config().force * state.field;
    state.capsule.vx += (dx / length) * force * dt;
    state.capsule.vy += (dy / length) * force * dt;
    state.capsule.vx *= 0.992;
    state.capsule.vy *= 0.992;
    limitVelocity();

    state.capsule.x += state.capsule.vx * dt;
    state.capsule.y += state.capsule.vy * dt;
    bounceWalls();
    state.energy -= config().drain * dt;
  }

  function bounceWalls() {
    const radius = 10;
    if (state.capsule.x < radius || state.capsule.x > canvas.width - radius) {
      state.capsule.x = Math.max(radius, Math.min(canvas.width - radius, state.capsule.x));
      state.capsule.vx *= -0.72;
    }
    if (state.capsule.y < radius || state.capsule.y > canvas.height - radius) {
      state.capsule.y = Math.max(radius, Math.min(canvas.height - radius, state.capsule.y));
      state.capsule.vy *= -0.72;
    }
  }

  function resolveCollisions() {
    state.cores.forEach((core) => {
      if (!core.done && distance(state.capsule, core) < core.r + 10) {
        core.done = true;
        state.energy = Math.min(100, state.energy + 14);
        setStatus("코어를 통과했습니다. 남은 코어를 이어서 수집하세요.");
      }
    });

    const hitHazard = state.hazards.some((hazard) => distance(state.capsule, hazard) < hazard.r + 9);
    if (hitHazard) {
      resetRun("위험 띠에 닿았습니다. 라운드 1로 돌아갑니다.");
      return;
    }

    if (state.energy <= 0) {
      resetRun("에너지가 모두 떨어졌습니다. 라운드 1로 돌아갑니다.");
      return;
    }

    if (state.cores.every((core) => core.done)) {
      state.round += 1;
      resetRound(`라운드 클리어. 더 많은 코어가 있는 라운드 ${state.round}로 바로 이동합니다.`);
    }
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f7f5ef";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(29, 36, 40, 0.08)";
    ctx.lineWidth = 1;
    for (let pos = 30; pos < canvas.width; pos += 30) {
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, canvas.height);
      ctx.moveTo(0, pos);
      ctx.lineTo(canvas.width, pos);
      ctx.stroke();
    }
  }

  function drawCores() {
    state.cores.forEach((core) => {
      ctx.beginPath();
      ctx.arc(core.x, core.y, core.r, 0, Math.PI * 2);
      ctx.fillStyle = core.done ? "#d7d2ca" : "#2d6371";
      ctx.fill();
      ctx.strokeStyle = core.done ? "#aaa39a" : "#173f49";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  function drawHazards() {
    state.hazards.forEach((hazard) => {
      ctx.beginPath();
      ctx.arc(hazard.x, hazard.y, hazard.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(163, 75, 63, 0.18)";
      ctx.fill();
      ctx.strokeStyle = "#a34b3f";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawCapsule() {
    const target = nearestOpenCore();
    if (target) {
      ctx.beginPath();
      ctx.moveTo(state.capsule.x, state.capsule.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = state.field === 0 ? "rgba(29,36,40,0.14)" : "rgba(45,99,113,0.28)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(state.capsule.x, state.capsule.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#1d2428";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(state.capsule.x - 3, state.capsule.y - 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#fffefa";
    ctx.fill();
  }

  function draw() {
    drawGrid();
    drawHazards();
    drawCores();
    drawCapsule();
  }

  function tick(time) {
    const dt = Math.min(0.035, (time - state.lastTime) / 1000 || 0.016);
    state.lastTime = time;
    updatePhysics(dt);
    resolveCollisions();
    renderHud();
    draw();
    state.frameId = requestAnimationFrame(tick);
  }

  fieldButtons.forEach((button) => {
    button.addEventListener("click", () => setField(Number(button.dataset.field)));
  });

  restartButton.addEventListener("click", () => {
    resetRun("라운드 1부터 다시 시작합니다.");
  });

  document.addEventListener("keydown", (event) => {
    const map = { a: -1, A: -1, s: 0, S: 0, d: 1, D: 1 };
    if (Object.prototype.hasOwnProperty.call(map, event.key)) {
      event.preventDefault();
      setField(map[event.key]);
    }
  });

  resetRound("중립 상태로 시작합니다. 끌어당김과 밀어냄을 번갈아 써서 코어를 지나가세요.");
  draw();
  state.frameId = requestAnimationFrame(tick);
}());
