"use strict";

(function initCrackStitch() {
  const canvas = document.querySelector("#repairCanvas");
  const context = canvas.getContext("2d");

  const repairValueEl = document.querySelector("#repairValue");
  const stabilityValueEl = document.querySelector("#stabilityValue");
  const streakValueEl = document.querySelector("#streakValue");
  const pressureValueEl = document.querySelector("#pressureValue");
  const roundValueEl = document.querySelector("#roundValue");
  const stabilizeValueEl = document.querySelector("#stabilizeValue");
  const stabilizeFillEl = document.querySelector("#stabilizeFill");
  const messageLineEl = document.querySelector("#messageLine");
  const overlayEl = document.querySelector("#overlay");
  const overlayTitleEl = document.querySelector("#overlayTitle");
  const overlayTextEl = document.querySelector("#overlayText");
  const overlayButtonEl = document.querySelector("#overlayButton");
  const restartButtonEl = document.querySelector("#restartButton");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const TARGET_REPAIRS = 12;
  const MAX_STABILITY = 3;
  const CHARGE_TARGET = 4;
  const STABILIZE_DURATION = 2.6;
  const HIT_RADIUS = 18;
  const MIN_SWIPE = 22;

  const state = {
    phase: "ready",
    running: false,
    round: 1,
    cracks: [],
    particles: [],
    repaired: 0,
    stability: MAX_STABILITY,
    streak: 0,
    stabilizeCharge: 0,
    stabilizeTimeLeft: 0,
    spawnTimer: 0.35,
    nextCrackId: 1,
    lastTimestamp: 0,
    rafId: 0,
    swipe: {
      active: false,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      trailLife: 0,
    },
  };

  function setMessage(text) {
    messageLineEl.textContent = text;
  }

  function showOverlay(title, text, buttonLabel) {
    overlayTitleEl.textContent = title;
    overlayTextEl.textContent = text;
    overlayButtonEl.textContent = buttonLabel;
    overlayEl.classList.add("is-visible");
  }

  function hideOverlay() {
    overlayEl.classList.remove("is-visible");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pressureLabel() {
    if (state.stabilizeTimeLeft > 0) {
      return "안정";
    }
    if (state.round >= 4 || state.repaired >= 10) {
      return "위험";
    }
    if (state.round >= 3 || state.repaired >= 7) {
      return "높음";
    }
    if (state.round >= 2 || state.repaired >= 4) {
      return "상승";
    }
    return "보통";
  }

  function updateHud() {
    repairValueEl.textContent = `${state.repaired} / ${TARGET_REPAIRS}`;
    stabilityValueEl.textContent = `${state.stability} / ${MAX_STABILITY}`;
    streakValueEl.textContent = String(state.streak);
    pressureValueEl.textContent = pressureLabel();
    roundValueEl.textContent = String(state.round);
    const fillPercent = state.stabilizeTimeLeft > 0
      ? (state.stabilizeTimeLeft / STABILIZE_DURATION) * 100
      : (state.stabilizeCharge / CHARGE_TARGET) * 100;
    stabilizeValueEl.textContent = `${Math.round(clamp(fillPercent, 0, 100))}%`;
    stabilizeFillEl.style.width = `${clamp(fillPercent, 0, 100)}%`;
  }

  function addParticle(x, y, color, size, life, dx, dy) {
    state.particles.push({
      x,
      y,
      color,
      size,
      life,
      maxLife: life,
      dx,
      dy,
    });
  }

  function burst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.2;
      const velocity = speed * (0.55 + Math.random() * 0.45);
      addParticle(
        x,
        y,
        color,
        3.5 + Math.random() * 5,
        0.34 + Math.random() * 0.2,
        Math.cos(angle) * velocity,
        Math.sin(angle) * velocity
      );
    }
  }

  function resetRoundState() {
    state.cracks = [];
    state.particles = [];
    state.repaired = 0;
    state.stability = MAX_STABILITY;
    state.streak = 0;
    state.stabilizeCharge = 0;
    state.stabilizeTimeLeft = 0;
    state.spawnTimer = 0.35;
    state.nextCrackId = 1;
    state.lastTimestamp = 0;
    state.swipe.active = false;
    state.swipe.trailLife = 0;
    updateHud();
  }

  function startRound() {
    resetRoundState();
    state.phase = "running";
    state.running = true;
    hideOverlay();
    setMessage(`라운드 ${state.round} 시작. 균열 위를 빠르게 그어 봉합하세요.`);
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    state.rafId = requestAnimationFrame(step);
  }

  function advanceRound() {
    state.phase = "between-rounds";
    state.running = false;
    state.swipe.active = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    state.round += 1;
    showOverlay(
      `라운드 ${state.round} 준비`,
      `균열 ${TARGET_REPAIRS}개를 모두 봉합했습니다. 다음 라운드에서는 균열이 더 자주 생기고 더 빨리 터집니다.`,
      "다음 라운드"
    );
    setMessage(`라운드 ${state.round - 1} 클리어. 다음 패널 준비.`);
    updateHud();
  }

  function endGame() {
    const failedRound = state.round;
    state.phase = "ended";
    state.running = false;
    state.swipe.active = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    state.round = 1;
    showOverlay(
      "패널 붕괴",
      `${failedRound}라운드에서 안정도를 모두 잃었습니다. 다음 시도는 1라운드부터 다시 시작합니다.`,
      "다시 시도"
    );
    setMessage("안정도가 모두 소진되었습니다.");
    updateHud();
  }

  function resetGame() {
    state.phase = "ready";
    state.running = false;
    state.round = 1;
    state.swipe.active = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    resetRoundState();
    drawScene(0.016);
    showOverlay(
      "패널 점검",
      "균열 위를 손가락으로 빠르게 그어 봉합하세요. 균열이 터지기 전에 12개를 수리하면 더 빡빡한 다음 라운드가 시작됩니다.",
      "시작"
    );
    setMessage("시작 후 균열 위를 짧게 스와이프하세요.");
  }

  function difficultyStep() {
    return Math.min(TARGET_REPAIRS - 1, state.repaired + (state.round - 1) * 3);
  }

  function currentSpawnInterval() {
    const base = 1.08 - difficultyStep() * 0.045 - (state.round - 1) * 0.035;
    return state.stabilizeTimeLeft > 0 ? Math.max(0.72, base + 0.18) : Math.max(0.42, base);
  }

  function currentCrackLife() {
    const base = 4.8 - difficultyStep() * 0.13 - (state.round - 1) * 0.24;
    return state.stabilizeTimeLeft > 0 ? Math.max(2.5, base + 0.9) : Math.max(2.1, base);
  }

  function maxActiveCracks() {
    return Math.min(7, 3 + Math.floor((state.round - 1) / 2) + Math.floor(state.repaired / 5));
  }

  function createCrackPoints(cx, cy, length, angle) {
    const normal = angle + Math.PI / 2;
    const pieces = 4;
    const points = [];
    for (let index = 0; index <= pieces; index += 1) {
      const t = index / pieces - 0.5;
      const jitter = index === 0 || index === pieces ? 0 : randomBetween(-7, 7);
      points.push({
        x: cx + Math.cos(angle) * length * t + Math.cos(normal) * jitter,
        y: cy + Math.sin(angle) * length * t + Math.sin(normal) * jitter,
      });
    }
    return points;
  }

  function spawnCrack() {
    const length = randomBetween(44, 72);
    const x = randomBetween(48, WIDTH - 48);
    const y = randomBetween(70, HEIGHT - 86);
    const angle = randomBetween(-Math.PI * 0.88, Math.PI * 0.88);
    const life = currentCrackLife();
    state.cracks.push({
      id: state.nextCrackId++,
      x,
      y,
      length,
      angle,
      points: createCrackPoints(x, y, length, angle),
      life,
      maxLife: life,
      sealed: false,
    });
  }

  function pointToSegmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
      return Math.hypot(px - ax, py - ay);
    }
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
    const x = ax + dx * t;
    const y = ay + dy * t;
    return Math.hypot(px - x, py - y);
  }

  function orientation(ax, ay, bx, by, cx, cy) {
    return (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  }

  function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a.x, a.y, b.x, b.y, c.x, c.y);
    const o2 = orientation(a.x, a.y, b.x, b.y, d.x, d.y);
    const o3 = orientation(c.x, c.y, d.x, d.y, a.x, a.y);
    const o4 = orientation(c.x, c.y, d.x, d.y, b.x, b.y);
    return o1 * o2 < 0 && o3 * o4 < 0;
  }

  function swipeHitsCrack(start, end, crack) {
    for (let index = 0; index < crack.points.length - 1; index += 1) {
      const a = crack.points[index];
      const b = crack.points[index + 1];
      if (segmentsIntersect(start, end, a, b)) {
        return true;
      }
      const distance = Math.min(
        pointToSegmentDistance(a.x, a.y, start.x, start.y, end.x, end.y),
        pointToSegmentDistance(b.x, b.y, start.x, start.y, end.x, end.y),
        pointToSegmentDistance(start.x, start.y, a.x, a.y, b.x, b.y),
        pointToSegmentDistance(end.x, end.y, a.x, a.y, b.x, b.y)
      );
      if (distance <= HIT_RADIUS) {
        return true;
      }
    }
    return false;
  }

  function triggerStabilize() {
    state.stabilizeCharge = 0;
    state.stabilizeTimeLeft = STABILIZE_DURATION;
    burst(WIDTH / 2, HEIGHT / 2, "rgba(166, 223, 207, ALPHA)", 16, 90);
    setMessage("연속 봉합 성공. 패널 안정화가 켜져 균열 진행이 느려집니다.");
    updateHud();
  }

  function sealCrack(crack) {
    crack.sealed = true;
    state.repaired += 1;
    state.streak += 1;
    burst(crack.x, crack.y, "rgba(216, 245, 237, ALPHA)", 9, 74);

    if (state.stabilizeTimeLeft <= 0) {
      state.stabilizeCharge = Math.min(CHARGE_TARGET, state.stabilizeCharge + 1);
      if (state.stabilizeCharge >= CHARGE_TARGET) {
        triggerStabilize();
      }
    }
  }

  function handleSwipe(start, end) {
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < MIN_SWIPE) {
      setMessage("균열을 가로질러 조금 더 길게 그어주세요.");
      return;
    }

    const hits = state.cracks.filter((crack) => !crack.sealed && swipeHitsCrack(start, end, crack));
    if (hits.length === 0) {
      state.streak = 0;
      state.stabilizeCharge = 0;
      setMessage("스와이프가 균열을 빗나갔습니다.");
      updateHud();
      return;
    }

    for (const crack of hits) {
      sealCrack(crack);
    }
    state.cracks = state.cracks.filter((crack) => !crack.sealed);
    setMessage(`균열 ${hits.length}개 봉합. 연속 ${state.streak}회.`);
    updateHud();

    if (state.repaired >= TARGET_REPAIRS) {
      drawScene(0);
      advanceRound();
    }
  }

  function expireCrack(crack) {
    crack.sealed = true;
    state.stability -= 1;
    state.streak = 0;
    state.stabilizeCharge = 0;
    burst(crack.x, crack.y, "rgba(233, 135, 114, ALPHA)", 11, 88);
    updateHud();

    if (state.stability <= 0) {
      drawScene(0);
      endGame();
      return;
    }

    setMessage(`균열이 터졌습니다. 안정도 ${state.stability}/${MAX_STABILITY}`);
  }

  function drawBackground() {
    context.clearRect(0, 0, WIDTH, HEIGHT);

    const background = context.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, "#121719");
    background.addColorStop(1, "#080b0d");
    context.fillStyle = background;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.fillStyle = "rgba(255,255,255,0.025)";
    context.fillRect(24, 48, WIDTH - 48, HEIGHT - 100);

    context.strokeStyle = "rgba(255,255,255,0.05)";
    context.lineWidth = 1;
    for (let x = 52; x < WIDTH - 30; x += 52) {
      context.beginPath();
      context.moveTo(x, 50);
      context.lineTo(x, HEIGHT - 54);
      context.stroke();
    }
    for (let y = 76; y < HEIGHT - 54; y += 52) {
      context.beginPath();
      context.moveTo(26, y);
      context.lineTo(WIDTH - 26, y);
      context.stroke();
    }

    context.strokeStyle = "rgba(166, 223, 207, 0.13)";
    context.strokeRect(24, 48, WIDTH - 48, HEIGHT - 100);

    context.fillStyle = "rgba(152,164,170,0.82)";
    context.font = "700 12px -apple-system";
    context.fillText("패널 표면", 24, 28);
  }

  function drawCracks() {
    for (const crack of state.cracks) {
      const lifeRatio = clamp(crack.life / crack.maxLife, 0, 1);
      const danger = 1 - lifeRatio;
      const glow = danger > 0.62 ? "rgba(233, 135, 114, 0.42)" : "rgba(232, 189, 130, 0.22)";

      context.strokeStyle = glow;
      context.lineWidth = 9;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(crack.points[0].x, crack.points[0].y);
      for (let index = 1; index < crack.points.length; index += 1) {
        context.lineTo(crack.points[index].x, crack.points[index].y);
      }
      context.stroke();

      context.strokeStyle = danger > 0.62 ? "#f0a38f" : "#e8bd82";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(crack.points[0].x, crack.points[0].y);
      for (let index = 1; index < crack.points.length; index += 1) {
        context.lineTo(crack.points[index].x, crack.points[index].y);
      }
      context.stroke();

      context.strokeStyle = "rgba(255,255,255,0.14)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(crack.x, crack.y, 18, 0, Math.PI * 2 * lifeRatio);
      context.stroke();
    }
    context.lineCap = "butt";
    context.lineJoin = "miter";
  }

  function drawSwipeTrail() {
    if (!state.swipe.active && state.swipe.trailLife <= 0) {
      return;
    }

    const alpha = state.swipe.active ? 1 : clamp(state.swipe.trailLife / 0.22, 0, 1);
    context.strokeStyle = `rgba(216, 245, 237, ${alpha.toFixed(3)})`;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(state.swipe.startX, state.swipe.startY);
    context.lineTo(state.swipe.x, state.swipe.y);
    context.stroke();
    context.lineCap = "butt";
  }

  function drawParticles(delta) {
    state.particles = state.particles.filter((particle) => {
      particle.life -= delta;
      if (particle.life <= 0) {
        return false;
      }
      particle.x += particle.dx * delta;
      particle.y += particle.dy * delta;
      const alpha = particle.life / particle.maxLife;
      context.fillStyle = particle.color.replace("ALPHA", alpha.toFixed(3));
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      context.fill();
      return true;
    });
  }

  function drawScene(delta) {
    drawBackground();
    drawCracks();
    drawSwipeTrail();
    drawParticles(delta);
  }

  function updateCracks(delta) {
    state.spawnTimer -= delta;
    if (state.repaired < TARGET_REPAIRS && state.cracks.length < maxActiveCracks() && state.spawnTimer <= 0) {
      spawnCrack();
      state.spawnTimer = currentSpawnInterval();
    }

    const decayScale = state.stabilizeTimeLeft > 0 ? 0.48 : 1;
    for (const crack of state.cracks) {
      crack.life -= delta * decayScale;
      if (!crack.sealed && crack.life <= 0) {
        expireCrack(crack);
      }
      if (!state.running) {
        break;
      }
    }
    state.cracks = state.cracks.filter((crack) => !crack.sealed);
  }

  function updateParticles(delta) {
    if (Math.random() < delta * 4) {
      addParticle(
        randomBetween(26, WIDTH - 26),
        HEIGHT + 10,
        "rgba(216, 245, 237, ALPHA)",
        2 + Math.random() * 3,
        1.2 + Math.random() * 0.7,
        randomBetween(-3, 3),
        -14 - Math.random() * 18
      );
    }
  }

  function update(delta) {
    if (state.stabilizeTimeLeft > 0) {
      state.stabilizeTimeLeft = Math.max(0, state.stabilizeTimeLeft - delta);
    }
    if (state.swipe.trailLife > 0 && !state.swipe.active) {
      state.swipe.trailLife = Math.max(0, state.swipe.trailLife - delta);
    }

    updateCracks(delta);
    updateParticles(delta);
    updateHud();
  }

  function step(timestamp) {
    if (!state.running) {
      return;
    }

    const delta = state.lastTimestamp === 0 ? 0.016 : Math.min(0.033, (timestamp - state.lastTimestamp) / 1000);
    state.lastTimestamp = timestamp;

    update(delta);
    drawScene(delta);

    if (state.running) {
      state.rafId = requestAnimationFrame(step);
    }
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function beginSwipe(event) {
    if (state.phase !== "running") {
      return;
    }
    const point = canvasPoint(event);
    state.swipe.active = true;
    state.swipe.startX = point.x;
    state.swipe.startY = point.y;
    state.swipe.x = point.x;
    state.swipe.y = point.y;
    state.swipe.trailLife = 0.22;
  }

  function moveSwipe(event) {
    if (!state.swipe.active) {
      return;
    }
    const point = canvasPoint(event);
    state.swipe.x = point.x;
    state.swipe.y = point.y;
  }

  function finishSwipe(event) {
    if (!state.swipe.active) {
      return;
    }
    const point = canvasPoint(event);
    const start = { x: state.swipe.startX, y: state.swipe.startY };
    const end = { x: point.x, y: point.y };
    state.swipe.x = end.x;
    state.swipe.y = end.y;
    state.swipe.active = false;
    state.swipe.trailLife = 0.22;
    if (state.phase === "running") {
      handleSwipe(start, end);
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerId !== undefined) {
      canvas.setPointerCapture(event.pointerId);
    }
    beginSwipe(event);
  });

  canvas.addEventListener("pointermove", moveSwipe);
  canvas.addEventListener("pointerup", finishSwipe);
  canvas.addEventListener("pointercancel", () => {
    state.swipe.active = false;
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyR") {
      event.preventDefault();
      resetGame();
    }
  });

  overlayButtonEl.addEventListener("click", startRound);
  restartButtonEl.addEventListener("click", resetGame);

  resetGame();
})();
