"use strict";

(function initDeepSignal() {
  const canvas = document.querySelector("#diveCanvas");
  const context = canvas.getContext("2d");

  const gateValueEl = document.querySelector("#gateValue");
  const stabilityValueEl = document.querySelector("#stabilityValue");
  const alignmentValueEl = document.querySelector("#alignmentValue");
  const flowValueEl = document.querySelector("#flowValue");
  const calmValueEl = document.querySelector("#calmValue");
  const calmFillEl = document.querySelector("#calmFill");
  const messageLineEl = document.querySelector("#messageLine");
  const overlayEl = document.querySelector("#overlay");
  const overlayTitleEl = document.querySelector("#overlayTitle");
  const overlayTextEl = document.querySelector("#overlayText");
  const overlayButtonEl = document.querySelector("#overlayButton");
  const restartButtonEl = document.querySelector("#restartButton");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const PLAYER_X = 96;
  const PLAYER_RADIUS = 18;
  const TOP_BOUND = 54;
  const BOTTOM_BOUND = HEIGHT - 58;
  const TARGET_GATES = 14;
  const MAX_STABILITY = 3;
  const CALM_DURATION = 2.6;
  const ALIGNMENT_TARGET = 4;
  const PERFECT_WINDOW = 16;

  const state = {
    phase: "ready",
    running: false,
    holding: false,
    playerY: HEIGHT / 2,
    playerVelocity: 0,
    gates: [],
    particles: [],
    spawned: 0,
    cleared: 0,
    stability: MAX_STABILITY,
    alignment: 0,
    calmTimeLeft: 0,
    spawnTimer: 0.95,
    lastGapY: HEIGHT / 2,
    nextGateId: 1,
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
    if (state.calmTimeLeft > 0) {
      return "정지";
    }
    if (state.cleared >= 10) {
      return "빠름";
    }
    if (state.cleared >= 5) {
      return "상승";
    }
    return "보통";
  }

  function updateHud() {
    gateValueEl.textContent = `${state.cleared} / ${TARGET_GATES}`;
    stabilityValueEl.textContent = `${state.stability} / ${MAX_STABILITY}`;
    alignmentValueEl.textContent = `${state.alignment} / ${ALIGNMENT_TARGET}`;
    flowValueEl.textContent = flowLabel();
    const calmPercent = Math.max(0, Math.min(100, (state.calmTimeLeft / CALM_DURATION) * 100));
    calmValueEl.textContent = `${Math.round(calmPercent)}%`;
    calmFillEl.style.width = `${calmPercent}%`;
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
        4 + Math.random() * 6,
        0.35 + Math.random() * 0.18,
        Math.cos(angle) * velocity,
        Math.sin(angle) * velocity
      );
    }
  }

  function resetGameState() {
    state.holding = false;
    state.playerY = HEIGHT / 2;
    state.playerVelocity = 0;
    state.gates = [];
    state.particles = [];
    state.spawned = 0;
    state.cleared = 0;
    state.stability = MAX_STABILITY;
    state.alignment = 0;
    state.calmTimeLeft = 0;
    state.spawnTimer = 0.95;
    state.lastGapY = HEIGHT / 2;
    state.nextGateId = 1;
    state.lastTimestamp = 0;
    updateHud();
  }

  function startRun() {
    resetGameState();
    state.phase = "running";
    state.running = true;
    hideOverlay();
    setMessage("길게 눌러 하강하고, 빈 틈 중앙에 맞춰 통과하세요.");
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    state.rafId = requestAnimationFrame(step);
  }

  function endGame(won) {
    state.phase = "ended";
    state.running = false;
    state.holding = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    if (won) {
      showOverlay(
        "신호 안정화 성공",
        `압력 게이트 ${TARGET_GATES}개를 통과했습니다. 마지막 정렬은 ${state.alignment}회였고 안정도는 ${state.stability}칸 남았습니다.`,
        "다시 플레이"
      );
      setMessage("모든 게이트를 통과했습니다.");
      return;
    }

    showOverlay(
      "신호 붕괴",
      "게이트 벽에 세 번 닿아 탐사선이 흔들렸습니다. 더 일찍 눌러 내려가고, 빈 틈 중앙에서 손을 떼어 보세요.",
      "다시 시도"
    );
    setMessage("안정도가 모두 소진되었습니다.");
  }

  function currentSpeed() {
    const base = 122 + state.spawned * 4.5 + state.cleared * 2.2;
    return state.calmTimeLeft > 0 ? base * 0.62 : base;
  }

  function currentSpawnInterval() {
    const base = 1.52 - state.spawned * 0.03;
    return state.calmTimeLeft > 0 ? Math.max(0.95, base + 0.22) : Math.max(0.88, base);
  }

  function currentGapHeight() {
    return Math.max(112, 142 - state.spawned * 2);
  }

  function spawnGate() {
    const gapHeight = currentGapHeight();
    const minCenter = TOP_BOUND + gapHeight / 2 + 16;
    const maxCenter = BOTTOM_BOUND - gapHeight / 2 - 16;
    const shift = randomBetween(-124, 124);
    const gapY = clamp(state.lastGapY + shift, minCenter, maxCenter);
    state.lastGapY = gapY;

    state.gates.push({
      id: state.nextGateId++,
      x: WIDTH + 40,
      width: 56,
      gapY,
      gapHeight,
      resolved: false,
    });

    state.spawned += 1;
  }

  function fillRoundedRect(x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
    context.fill();
  }

  function strokeRoundedRect(x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
    context.stroke();
  }

  function drawBackground() {
    context.clearRect(0, 0, WIDTH, HEIGHT);

    const background = context.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, "#10181d");
    background.addColorStop(1, "#071015");
    context.fillStyle = background;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    for (let index = 0; index < 9; index += 1) {
      const y = 40 + index * 54;
      context.strokeStyle = "rgba(255,255,255,0.05)";
      context.lineWidth = index % 2 === 0 ? 1.2 : 1;
      context.beginPath();
      context.moveTo(22, y);
      context.lineTo(WIDTH - 22, y);
      context.stroke();
    }

    context.setLineDash([10, 10]);
    context.strokeStyle = "rgba(132, 216, 220, 0.24)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(PLAYER_X, 32);
    context.lineTo(PLAYER_X, HEIGHT - 30);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "rgba(154,167,174,0.8)";
    context.font = "700 12px -apple-system";
    context.fillText("정렬선", PLAYER_X - 22, 26);
  }

  function drawBounds() {
    context.strokeStyle = "rgba(255,255,255,0.06)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(20, TOP_BOUND);
    context.lineTo(WIDTH - 20, TOP_BOUND);
    context.moveTo(20, BOTTOM_BOUND);
    context.lineTo(WIDTH - 20, BOTTOM_BOUND);
    context.stroke();
  }

  function drawGates() {
    for (const gate of state.gates) {
      const gapTop = gate.gapY - gate.gapHeight / 2;
      const gapBottom = gate.gapY + gate.gapHeight / 2;
      const glow = context.createLinearGradient(gate.x, 0, gate.x + gate.width, 0);
      glow.addColorStop(0, "rgba(255, 133, 117, 0.55)");
      glow.addColorStop(1, "rgba(255, 191, 122, 0.42)");
      context.fillStyle = glow;
      fillRoundedRect(gate.x, TOP_BOUND, gate.width, gapTop - TOP_BOUND, 14);
      fillRoundedRect(gate.x, gapBottom, gate.width, BOTTOM_BOUND - gapBottom, 14);

      context.strokeStyle = "rgba(255,255,255,0.1)";
      context.lineWidth = 1.5;
      strokeRoundedRect(gate.x, TOP_BOUND, gate.width, gapTop - TOP_BOUND, 14);
      strokeRoundedRect(gate.x, gapBottom, gate.width, BOTTOM_BOUND - gapBottom, 14);

      context.strokeStyle = "rgba(132, 216, 220, 0.8)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(gate.x + 6, gate.gapY);
      context.lineTo(gate.x + gate.width - 6, gate.gapY);
      context.stroke();

      context.strokeStyle = "rgba(132, 216, 220, 0.34)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(gate.x, gapTop);
      context.lineTo(gate.x + gate.width, gapTop);
      context.moveTo(gate.x, gapBottom);
      context.lineTo(gate.x + gate.width, gapBottom);
      context.stroke();
    }
  }

  function drawPlayer() {
    const glow = context.createRadialGradient(PLAYER_X, state.playerY, 0, PLAYER_X, state.playerY, 42);
    glow.addColorStop(0, "rgba(214, 246, 247, 0.9)");
    glow.addColorStop(0.46, "rgba(132, 216, 220, 0.2)");
    glow.addColorStop(1, "rgba(132, 216, 220, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(PLAYER_X, state.playerY, 42, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#eaf6f7";
    context.beginPath();
    context.arc(PLAYER_X, state.playerY, PLAYER_RADIUS, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(16, 24, 29, 0.28)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(PLAYER_X, state.playerY, PLAYER_RADIUS - 2, 0.4, Math.PI * 1.7);
    context.stroke();

    context.fillStyle = "rgba(132, 216, 220, 0.9)";
    context.beginPath();
    context.moveTo(PLAYER_X - 9, state.playerY + PLAYER_RADIUS + 4);
    context.lineTo(PLAYER_X, state.playerY + PLAYER_RADIUS + 16);
    context.lineTo(PLAYER_X + 9, state.playerY + PLAYER_RADIUS + 4);
    context.closePath();
    context.fill();
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
    drawBounds();
    drawGates();
    drawPlayer();
    drawParticles(delta);
  }

  function triggerCalm() {
    state.alignment = 0;
    state.calmTimeLeft = CALM_DURATION;
    burst(PLAYER_X, state.playerY, "rgba(132, 216, 220, ALPHA)", 12, 92);
    setMessage("정지 필드 활성화. 다음 게이트들이 잠깐 느려집니다.");
    updateHud();
  }

  function judgeGate(gate) {
    if (gate.resolved) {
      return;
    }
    gate.resolved = true;

    const gapTop = gate.gapY - gate.gapHeight / 2;
    const gapBottom = gate.gapY + gate.gapHeight / 2;
    const safe = state.playerY - PLAYER_RADIUS >= gapTop + 4 && state.playerY + PLAYER_RADIUS <= gapBottom - 4;

    if (safe) {
      state.cleared += 1;
      const centered = Math.abs(state.playerY - gate.gapY) <= PERFECT_WINDOW;
      if (centered) {
        state.alignment += 1;
        setMessage(`정중앙 통과. 정렬 ${state.alignment}/${ALIGNMENT_TARGET}`);
        burst(PLAYER_X, state.playerY, "rgba(255, 191, 122, ALPHA)", 8, 74);
        if (state.alignment >= ALIGNMENT_TARGET) {
          triggerCalm();
        }
      } else {
        state.alignment = 0;
        setMessage("통과 성공. 중앙선에 더 가깝게 맞추면 정렬이 쌓입니다.");
        burst(PLAYER_X, state.playerY, "rgba(214, 246, 247, ALPHA)", 6, 56);
      }

      if (state.cleared >= TARGET_GATES) {
        updateHud();
        drawScene(0);
        endGame(true);
        return;
      }
    } else {
      state.stability -= 1;
      state.alignment = 0;
      state.calmTimeLeft = 0;
      state.playerVelocity = 0;
      burst(PLAYER_X, state.playerY, "rgba(255, 133, 117, ALPHA)", 10, 88);
      if (state.stability <= 0) {
        updateHud();
        drawScene(0);
        endGame(false);
        return;
      }
      setMessage(`벽에 닿았습니다. 안정도 ${state.stability}/${MAX_STABILITY}`);
    }

    updateHud();
  }

  function updatePlayer(delta) {
    const targetVelocity = state.holding ? 210 : -154;
    state.playerVelocity += (targetVelocity - state.playerVelocity) * Math.min(1, delta * 4.2);
    state.playerY += state.playerVelocity * delta;
    state.playerY = clamp(state.playerY, TOP_BOUND + PLAYER_RADIUS, BOTTOM_BOUND - PLAYER_RADIUS);

    if (state.playerY === TOP_BOUND + PLAYER_RADIUS || state.playerY === BOTTOM_BOUND - PLAYER_RADIUS) {
      state.playerVelocity = 0;
    }
  }

  function updateGates(delta) {
    state.spawnTimer -= delta;
    if (state.spawned < TARGET_GATES && state.spawnTimer <= 0) {
      spawnGate();
      state.spawnTimer = currentSpawnInterval();
    }

    const speed = currentSpeed();
    for (const gate of state.gates) {
      gate.x -= speed * delta;
      if (!gate.resolved && gate.x + gate.width / 2 <= PLAYER_X) {
        judgeGate(gate);
      }
    }

    state.gates = state.gates.filter((gate) => gate.x + gate.width > -30);
  }

  function updateParticles(delta) {
    if (Math.random() < delta * 5.5) {
      addParticle(
        randomBetween(20, WIDTH - 20),
        HEIGHT + 10,
        "rgba(214, 246, 247, ALPHA)",
        3 + Math.random() * 3,
        1.4 + Math.random() * 0.8,
        randomBetween(-4, 4),
        -18 - Math.random() * 22
      );
    }
  }

  function update(delta) {
    if (state.calmTimeLeft > 0) {
      state.calmTimeLeft = Math.max(0, state.calmTimeLeft - delta);
    }

    updatePlayer(delta);
    updateGates(delta);
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

  function setHolding(nextHolding) {
    if (state.phase !== "running") {
      return;
    }
    state.holding = nextHolding;
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerId !== undefined) {
      canvas.setPointerCapture(event.pointerId);
    }
    setHolding(true);
  });

  canvas.addEventListener("pointerup", () => {
    setHolding(false);
  });

  canvas.addEventListener("pointercancel", () => {
    setHolding(false);
  });

  window.addEventListener("pointerup", () => {
    setHolding(false);
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowDown") {
      event.preventDefault();
      setHolding(true);
    } else if (event.code === "KeyR") {
      event.preventDefault();
      startRun();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "Space" || event.code === "ArrowDown") {
      event.preventDefault();
      setHolding(false);
    }
  });

  overlayButtonEl.addEventListener("click", startRun);
  restartButtonEl.addEventListener("click", startRun);

  resetGameState();
  drawScene(0.016);
})();
