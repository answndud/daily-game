"use strict";

(function initSlitPort() {
  const canvas = document.querySelector("#portCanvas");
  const context = canvas.getContext("2d");

  const catchValueEl = document.querySelector("#catchValue");
  const stabilityValueEl = document.querySelector("#stabilityValue");
  const streakValueEl = document.querySelector("#streakValue");
  const flowValueEl = document.querySelector("#flowValue");
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
  const TARGET_CATCHES = 10;
  const MAX_STABILITY = 3;
  const CHARGE_TARGET = 4;
  const STABILIZE_DURATION = 2.4;
  const DOCK_Y = HEIGHT - 84;
  const DOCK_HEIGHT = 26;
  const BASE_DOCK_WIDTH = 110;
  const MIN_DOCK_WIDTH = 56;

  const state = {
    phase: "ready",
    running: false,
    round: 1,
    dockX: WIDTH / 2,
    targetDockX: WIDTH / 2,
    dragging: false,
    cargoes: [],
    particles: [],
    collected: 0,
    stability: MAX_STABILITY,
    streak: 0,
    stabilizeCharge: 0,
    stabilizeTimeLeft: 0,
    spawnTimer: 0.42,
    nextCargoId: 1,
    lastTimestamp: 0,
    rafId: 0,
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

  function flowLabel() {
    if (state.stabilizeTimeLeft > 0) {
      return "안정";
    }
    if (state.round >= 4 || state.collected >= 8) {
      return "과밀";
    }
    if (state.round >= 3 || state.collected >= 5) {
      return "빠름";
    }
    if (state.round >= 2 || state.collected >= 3) {
      return "상승";
    }
    return "보통";
  }

  function currentDockWidth() {
    const stableBonus = state.stabilizeTimeLeft > 0 ? 30 : 0;
    return Math.max(MIN_DOCK_WIDTH, BASE_DOCK_WIDTH - (state.round - 1) * 10 + stableBonus);
  }

  function updateHud() {
    catchValueEl.textContent = `${state.collected} / ${TARGET_CATCHES}`;
    stabilityValueEl.textContent = `${state.stability} / ${MAX_STABILITY}`;
    streakValueEl.textContent = String(state.streak);
    flowValueEl.textContent = flowLabel();
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
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.25;
      const velocity = speed * (0.5 + Math.random() * 0.5);
      addParticle(
        x,
        y,
        color,
        4 + Math.random() * 5,
        0.35 + Math.random() * 0.2,
        Math.cos(angle) * velocity,
        Math.sin(angle) * velocity
      );
    }
  }

  function resetRoundState() {
    state.dockX = WIDTH / 2;
    state.targetDockX = WIDTH / 2;
    state.dragging = false;
    state.cargoes = [];
    state.particles = [];
    state.collected = 0;
    state.stability = MAX_STABILITY;
    state.streak = 0;
    state.stabilizeCharge = 0;
    state.stabilizeTimeLeft = 0;
    state.spawnTimer = 0.42;
    state.nextCargoId = 1;
    state.lastTimestamp = 0;
    updateHud();
  }

  function startRound() {
    resetRoundState();
    state.phase = "running";
    state.running = true;
    hideOverlay();
    setMessage(`라운드 ${state.round} 시작. 도크를 끌어 클린 캡슐만 받으세요.`);
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    state.rafId = requestAnimationFrame(step);
  }

  function advanceRound() {
    state.phase = "between-rounds";
    state.running = false;
    state.dragging = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    state.round += 1;
    showOverlay(
      `라운드 ${state.round} 준비`,
      `클린 캡슐 ${TARGET_CATCHES}개를 모두 회수했습니다. 다음 라운드에서는 도크가 더 좁아지고 파손 화물 비율이 올라갑니다.`,
      "다음 라운드"
    );
    setMessage(`라운드 ${state.round - 1} 클리어. 다음 화물열 준비.`);
    updateHud();
  }

  function endGame() {
    const failedRound = state.round;
    state.phase = "ended";
    state.running = false;
    state.dragging = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    state.round = 1;
    showOverlay(
      "포트 붕괴",
      `${failedRound}라운드에서 파손 화물을 세 번 받아 안정도가 모두 떨어졌습니다. 다음 시도는 1라운드부터 다시 시작합니다.`,
      "다시 시도"
    );
    setMessage("안정도가 모두 소진되었습니다.");
    updateHud();
  }

  function resetGame() {
    state.phase = "ready";
    state.running = false;
    state.round = 1;
    state.dragging = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    resetRoundState();
    drawScene(0.016);
    showOverlay(
      "도크 준비",
      "하단 도크를 좌우로 끌어 맑은 캡슐만 받으세요. 파손 화물은 흘려보내고, 연속 4회 포집 시 잠깐 안정화가 켜집니다.",
      "시작"
    );
    setMessage("시작 후 캔버스를 좌우로 드래그해 도크를 움직이세요.");
  }

  function difficultyStep() {
    return Math.min(TARGET_CATCHES - 1, state.collected + (state.round - 1) * 3);
  }

  function currentSpawnInterval() {
    const base = 0.78 - difficultyStep() * 0.028 - (state.round - 1) * 0.025;
    return state.stabilizeTimeLeft > 0 ? Math.max(0.5, base + 0.16) : Math.max(0.34, base);
  }

  function currentFallSpeed() {
    const base = 148 + difficultyStep() * 10 + (state.round - 1) * 18;
    return state.stabilizeTimeLeft > 0 ? base * 0.76 : base;
  }

  function currentBadChance() {
    return Math.min(0.48, 0.22 + (state.round - 1) * 0.05 + difficultyStep() * 0.008);
  }

  function spawnCargo() {
    const isBad = Math.random() < currentBadChance();
    const radius = isBad ? randomBetween(14, 17) : randomBetween(12, 16);
    const x = randomBetween(28 + radius, WIDTH - 28 - radius);
    state.cargoes.push({
      id: state.nextCargoId++,
      type: isBad ? "bad" : "good",
      x,
      y: -radius - 12,
      radius,
      vy: currentFallSpeed() * (0.92 + Math.random() * 0.16),
      vx: randomBetween(-18, 18),
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: randomBetween(1.5, 2.8),
      rotation: Math.random() * Math.PI * 2,
      resolved: false,
    });
  }

  function drawBackground() {
    context.clearRect(0, 0, WIDTH, HEIGHT);

    const background = context.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, "#12181c");
    background.addColorStop(1, "#090c10");
    context.fillStyle = background;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    for (let index = 0; index < 9; index += 1) {
      const y = 44 + index * 52;
      context.strokeStyle = "rgba(255,255,255,0.05)";
      context.lineWidth = index % 2 === 0 ? 1.2 : 1;
      context.beginPath();
      context.moveTo(22, y);
      context.lineTo(WIDTH - 22, y);
      context.stroke();
    }

    for (let index = 0; index < 4; index += 1) {
      const x = 54 + index * 84;
      context.strokeStyle = "rgba(158, 217, 214, 0.08)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, 22);
      context.lineTo(x, HEIGHT - 120);
      context.stroke();
    }

    context.fillStyle = "rgba(150,163,170,0.82)";
    context.font = "700 12px -apple-system";
    context.fillText("입항 구역", 24, 26);
  }

  function drawDock() {
    const width = currentDockWidth();
    const left = state.dockX - width / 2;
    const stableGlow = state.stabilizeTimeLeft > 0 ? 0.95 : 0.7;

    context.fillStyle = "rgba(255,255,255,0.08)";
    context.fillRect(18, DOCK_Y + DOCK_HEIGHT + 10, WIDTH - 36, 18);

    context.fillStyle = "#20272c";
    context.fillRect(24, DOCK_Y, WIDTH - 48, DOCK_HEIGHT);

    const glow = context.createLinearGradient(left, DOCK_Y, left + width, DOCK_Y + DOCK_HEIGHT);
    glow.addColorStop(0, `rgba(158, 217, 214, ${stableGlow.toFixed(3)})`);
    glow.addColorStop(1, `rgba(213, 243, 242, ${stableGlow.toFixed(3)})`);
    context.fillStyle = glow;
    context.fillRect(left, DOCK_Y, width, DOCK_HEIGHT);

    context.strokeStyle = "rgba(255,255,255,0.12)";
    context.lineWidth = 2;
    context.strokeRect(24, DOCK_Y, WIDTH - 48, DOCK_HEIGHT);

    context.strokeStyle = "rgba(255,255,255,0.18)";
    context.lineWidth = 1.5;
    context.strokeRect(left, DOCK_Y, width, DOCK_HEIGHT);

    if (state.stabilizeTimeLeft > 0) {
      context.strokeStyle = "rgba(158, 217, 214, 0.34)";
      context.lineWidth = 4;
      context.strokeRect(left - 4, DOCK_Y - 4, width + 8, DOCK_HEIGHT + 8);
    }
  }

  function drawGoodCargo(cargo) {
    const glow = context.createRadialGradient(cargo.x, cargo.y, 0, cargo.x, cargo.y, cargo.radius * 2.4);
    glow.addColorStop(0, "rgba(213, 243, 242, 0.9)");
    glow.addColorStop(0.5, "rgba(158, 217, 214, 0.22)");
    glow.addColorStop(1, "rgba(158, 217, 214, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cargo.x, cargo.y, cargo.radius * 2.2, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#eef7f7";
    context.beginPath();
    context.ellipse(cargo.x, cargo.y, cargo.radius * 1.05, cargo.radius * 0.86, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(18, 24, 29, 0.18)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(cargo.x, cargo.y, cargo.radius * 0.88, cargo.radius * 0.68, 0, 0.2, Math.PI * 1.82);
    context.stroke();
  }

  function drawBadCargo(cargo) {
    context.save();
    context.translate(cargo.x, cargo.y);
    context.rotate(cargo.rotation);

    const glow = context.createRadialGradient(0, 0, 0, 0, 0, cargo.radius * 2.1);
    glow.addColorStop(0, "rgba(240, 187, 138, 0.88)");
    glow.addColorStop(0.5, "rgba(237, 143, 116, 0.2)");
    glow.addColorStop(1, "rgba(237, 143, 116, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, cargo.radius * 1.9, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#f1b58c";
    context.beginPath();
    for (let corner = 0; corner < 6; corner += 1) {
      const angle = (Math.PI * 2 * corner) / 6;
      const length = cargo.radius * (corner % 2 === 0 ? 1 : 0.72);
      const x = Math.cos(angle) * length;
      const y = Math.sin(angle) * length;
      if (corner === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
    context.fill();

    context.strokeStyle = "rgba(78, 39, 28, 0.48)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-cargo.radius * 0.35, -cargo.radius * 0.1);
    context.lineTo(cargo.radius * 0.24, cargo.radius * 0.22);
    context.moveTo(cargo.radius * 0.15, -cargo.radius * 0.34);
    context.lineTo(-cargo.radius * 0.2, cargo.radius * 0.34);
    context.stroke();

    context.restore();
  }

  function drawCargoes() {
    for (const cargo of state.cargoes) {
      if (cargo.type === "good") {
        drawGoodCargo(cargo);
      } else {
        drawBadCargo(cargo);
      }
    }
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
    drawDock();
    drawCargoes();
    drawParticles(delta);
  }

  function triggerStabilize() {
    state.streak = 0;
    state.stabilizeCharge = 0;
    state.stabilizeTimeLeft = STABILIZE_DURATION;
    burst(state.dockX, DOCK_Y + DOCK_HEIGHT / 2, "rgba(158, 217, 214, ALPHA)", 14, 92);
    setMessage("연속 포집 성공. 정박 안정화가 켜져 도크가 잠깐 넓어집니다.");
    updateHud();
  }

  function handleGoodCatch(cargo) {
    cargo.resolved = true;
    state.collected += 1;
    burst(cargo.x, DOCK_Y + 10, "rgba(213, 243, 242, ALPHA)", 8, 72);

    if (state.stabilizeTimeLeft <= 0) {
      state.streak += 1;
      state.stabilizeCharge = Math.min(CHARGE_TARGET, state.stabilizeCharge + 1);
      if (state.stabilizeCharge >= CHARGE_TARGET) {
        triggerStabilize();
      } else {
        setMessage(`클린 캡슐 회수. 연속 포집 ${state.streak}회.`);
      }
    } else {
      setMessage("안정화 중. 넓어진 도크로 연속 회수하세요.");
    }

    updateHud();
    if (state.collected >= TARGET_CATCHES) {
      drawScene(0);
      advanceRound();
    }
  }

  function handleBadCatch(cargo) {
    cargo.resolved = true;
    state.stability -= 1;
    state.streak = 0;
    state.stabilizeCharge = 0;
    state.stabilizeTimeLeft = 0;
    burst(cargo.x, DOCK_Y + 12, "rgba(237, 143, 116, ALPHA)", 10, 84);
    updateHud();

    if (state.stability <= 0) {
      drawScene(0);
      endGame();
      return;
    }

    setMessage(`파손 화물을 받았습니다. 안정도 ${state.stability}/${MAX_STABILITY}`);
  }

  function missGoodCargo(cargo) {
    cargo.resolved = true;
    state.streak = 0;
    state.stabilizeCharge = 0;
    burst(cargo.x, HEIGHT - 24, "rgba(240, 187, 138, ALPHA)", 7, 52);
    setMessage("클린 캡슐을 놓쳤습니다. 다시 포지션을 맞추세요.");
    updateHud();
  }

  function updateDock(delta) {
    const halfWidth = currentDockWidth() / 2;
    const minX = 24 + halfWidth;
    const maxX = WIDTH - 24 - halfWidth;
    state.targetDockX = clamp(state.targetDockX, minX, maxX);
    state.dockX += (state.targetDockX - state.dockX) * Math.min(1, delta * 12);
    state.dockX = clamp(state.dockX, minX, maxX);
  }

  function updateCargoes(delta) {
    state.spawnTimer -= delta;
    if (state.collected < TARGET_CATCHES && state.spawnTimer <= 0) {
      spawnCargo();
      state.spawnTimer = currentSpawnInterval();
    }

    const dockWidth = currentDockWidth();
    const dockLeft = state.dockX - dockWidth / 2;
    const dockRight = state.dockX + dockWidth / 2;

    for (const cargo of state.cargoes) {
      cargo.wobble += cargo.wobbleSpeed * delta;
      cargo.x += cargo.vx * delta + Math.sin(cargo.wobble) * 8 * delta;
      cargo.y += cargo.vy * delta;
      cargo.rotation += (cargo.type === "bad" ? 1.4 : 0.8) * delta;

      if (cargo.x < cargo.radius + 18 || cargo.x > WIDTH - cargo.radius - 18) {
        cargo.vx *= -1;
        cargo.x = clamp(cargo.x, cargo.radius + 18, WIDTH - cargo.radius - 18);
      }

      if (!cargo.resolved && cargo.y + cargo.radius >= DOCK_Y) {
        const inDock = cargo.x >= dockLeft - cargo.radius * 0.2 && cargo.x <= dockRight + cargo.radius * 0.2;
        if (inDock) {
          if (cargo.type === "good") {
            handleGoodCatch(cargo);
          } else {
            handleBadCatch(cargo);
          }
        }
      }

      if (!state.running) {
        break;
      }

      if (!cargo.resolved && cargo.y - cargo.radius > HEIGHT + 12) {
        if (cargo.type === "good") {
          missGoodCargo(cargo);
        } else {
          cargo.resolved = true;
        }
      }
    }

    state.cargoes = state.cargoes.filter((cargo) => !cargo.resolved);
  }

  function updateParticles(delta) {
    if (Math.random() < delta * 4.2) {
      addParticle(
        randomBetween(24, WIDTH - 24),
        HEIGHT + 10,
        "rgba(213, 243, 242, ALPHA)",
        2 + Math.random() * 3,
        1.3 + Math.random() * 0.7,
        randomBetween(-3, 3),
        -16 - Math.random() * 20
      );
    }
  }

  function update(delta) {
    if (state.stabilizeTimeLeft > 0) {
      state.stabilizeTimeLeft = Math.max(0, state.stabilizeTimeLeft - delta);
    }

    updateDock(delta);
    updateCargoes(delta);
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

  function dockTargetFromClientX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    return x;
  }

  function beginDrag(clientX) {
    state.dragging = true;
    state.targetDockX = dockTargetFromClientX(clientX);
  }

  function moveDrag(clientX) {
    if (!state.dragging || state.phase !== "running") {
      return;
    }
    state.targetDockX = dockTargetFromClientX(clientX);
  }

  function endDrag() {
    state.dragging = false;
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerId !== undefined) {
      canvas.setPointerCapture(event.pointerId);
    }
    if (state.phase !== "running") {
      return;
    }
    beginDrag(event.clientX);
  });

  canvas.addEventListener("pointermove", (event) => {
    moveDrag(event.clientX);
  });

  canvas.addEventListener("pointerup", () => {
    endDrag();
  });

  canvas.addEventListener("pointercancel", () => {
    endDrag();
  });

  window.addEventListener("pointerup", () => {
    endDrag();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowLeft") {
      event.preventDefault();
      state.targetDockX -= 28;
    } else if (event.code === "ArrowRight") {
      event.preventDefault();
      state.targetDockX += 28;
    } else if (event.code === "KeyR") {
      event.preventDefault();
      resetGame();
    }
  });

  overlayButtonEl.addEventListener("click", startRound);
  restartButtonEl.addEventListener("click", resetGame);

  resetGame();
})();
