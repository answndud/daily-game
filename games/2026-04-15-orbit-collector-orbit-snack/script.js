"use strict";

(function initOrbitSnack() {
  const canvas = document.querySelector("#arenaCanvas");
  const context = canvas.getContext("2d");

  const scoreValueEl = document.querySelector("#scoreValue");
  const timeValueEl = document.querySelector("#timeValue");
  const laneValueEl = document.querySelector("#laneValue");
  const bandValueEl = document.querySelector("#bandValue");
  const cooldownValueEl = document.querySelector("#cooldownValue");
  const cooldownFillEl = document.querySelector("#cooldownFill");
  const messageLineEl = document.querySelector("#messageLine");
  const overlayEl = document.querySelector("#overlay");
  const overlayTitleEl = document.querySelector("#overlayTitle");
  const overlayTextEl = document.querySelector("#overlayText");
  const overlayButtonEl = document.querySelector("#overlayButton");
  const restartButtonEl = document.querySelector("#restartButton");

  const ARENA_SIZE = canvas.width;
  const CENTER = ARENA_SIZE / 2;
  const GOAL_SCORE = 20;
  const TOTAL_TIME = 45;
  const BASE_OUTER_RADIUS = 128;
  const BASE_INNER_RADIUS = 82;
  const OUTER_MIN_RADIUS = 92;
  const INNER_MAX_RADIUS = 108;
  const BASE_ANGULAR_SPEED = 1.6;
  const PULSE_BOOST = 0.9;
  const PULSE_DURATION = 0.26;
  const PULSE_COOLDOWN = 0.45;
  const TARGET_RADIUS = 10;
  const PLAYER_RADIUS = 11;
  const COLLECTION_THRESHOLD = 0.17;
  const SHRINK_STEPS = 3;

  const state = {
    running: false,
    score: 0,
    timeLeft: TOTAL_TIME,
    angle: -Math.PI / 2,
    angularSpeed: BASE_ANGULAR_SPEED,
    pulseBoostLeft: 0,
    pulseCooldownLeft: 0,
    laneIndex: 0,
    laneRadius: BASE_OUTER_RADIUS,
    targetLaneIndex: 0,
    targetAngle: Math.PI / 2,
    targetGlow: 0,
    shrinkLevel: 0,
    lastTimestamp: 0,
    flashes: [],
    rafId: 0,
  };

  function setMessage(text) {
    messageLineEl.textContent = text;
  }

  function currentBandPercent() {
    const outer = getOuterRadius();
    const inner = getInnerRadius();
    const width = outer - inner;
    const maxWidth = BASE_OUTER_RADIUS - BASE_INNER_RADIUS;
    return Math.max(0, Math.round((width / maxWidth) * 100));
  }

  function getOuterRadius() {
    return Math.max(OUTER_MIN_RADIUS, BASE_OUTER_RADIUS - state.shrinkLevel * 7);
  }

  function getInnerRadius() {
    return Math.min(INNER_MAX_RADIUS, BASE_INNER_RADIUS + state.shrinkLevel * 4);
  }

  function laneRadiusFor(index) {
    return index === 0 ? getOuterRadius() : getInnerRadius();
  }

  function wrapAngle(value) {
    let angle = value;
    while (angle < -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
  }

  function spawnTarget() {
    state.targetLaneIndex = Math.random() > 0.5 ? 0 : 1;
    state.targetAngle = Math.random() * Math.PI * 2;
    state.targetGlow = 1;
  }

  function addFlash(radius, angle, color) {
    state.flashes.push({
      radius,
      angle,
      color,
      life: 0.4,
      maxLife: 0.4,
    });
  }

  function updateHud() {
    scoreValueEl.textContent = `${state.score} / ${GOAL_SCORE}`;
    timeValueEl.textContent = `${state.timeLeft.toFixed(1)}s`;
    laneValueEl.textContent = state.laneIndex === 0 ? "Outer" : "Inner";
    bandValueEl.textContent = `${currentBandPercent()}%`;

    const cooldown = Math.max(0, state.pulseCooldownLeft);
    if (cooldown <= 0) {
      cooldownValueEl.textContent = "Ready";
      cooldownFillEl.style.width = "0%";
    } else {
      const progress = Math.min(100, (cooldown / PULSE_COOLDOWN) * 100);
      cooldownValueEl.textContent = `${cooldown.toFixed(1)}s`;
      cooldownFillEl.style.width = `${progress}%`;
    }
  }

  function drawBackground() {
    context.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);

    const background = context.createRadialGradient(CENTER, CENTER, 10, CENTER, CENTER, CENTER);
    background.addColorStop(0, "rgba(126, 246, 255, 0.08)");
    background.addColorStop(0.45, "rgba(17, 25, 43, 0.24)");
    background.addColorStop(1, "rgba(3, 8, 14, 0.96)");
    context.fillStyle = background;
    context.fillRect(0, 0, ARENA_SIZE, ARENA_SIZE);

    context.save();
    context.translate(CENTER, CENTER);

    context.strokeStyle = "rgba(126, 246, 255, 0.08)";
    context.lineWidth = 1;
    for (let ring = 48; ring <= 148; ring += 20) {
      context.beginPath();
      context.arc(0, 0, ring, 0, Math.PI * 2);
      context.stroke();
    }

    for (let spoke = 0; spoke < 12; spoke += 1) {
      const angle = (Math.PI * 2 * spoke) / 12;
      context.beginPath();
      context.moveTo(Math.cos(angle) * 36, Math.sin(angle) * 36);
      context.lineTo(Math.cos(angle) * 152, Math.sin(angle) * 152);
      context.stroke();
    }
    context.restore();
  }

  function drawSafeBand() {
    const outer = getOuterRadius();
    const inner = getInnerRadius();

    context.save();
    context.translate(CENTER, CENTER);

    context.beginPath();
    context.arc(0, 0, outer + 18, 0, Math.PI * 2);
    context.arc(0, 0, inner - 18, Math.PI * 2, 0, true);
    context.fillStyle = "rgba(255, 191, 105, 0.06)";
    context.fill();

    [outer, inner].forEach((radius, index) => {
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.lineWidth = 8;
      context.strokeStyle = index === 0 ? "rgba(126, 246, 255, 0.25)" : "rgba(255, 143, 199, 0.2)";
      context.stroke();
    });

    context.beginPath();
    context.arc(0, 0, inner - 22, 0, Math.PI * 2);
    context.fillStyle = "rgba(2, 7, 14, 0.96)";
    context.fill();
    context.restore();
  }

  function pointFor(radius, angle) {
    return {
      x: CENTER + Math.cos(angle) * radius,
      y: CENTER + Math.sin(angle) * radius,
    };
  }

  function drawTarget() {
    const radius = laneRadiusFor(state.targetLaneIndex);
    const point = pointFor(radius, state.targetAngle);

    context.save();
    context.translate(point.x, point.y);

    const pulseScale = 1 + Math.sin(state.targetGlow * 8) * 0.08;
    context.scale(pulseScale, pulseScale);

    const glow = context.createRadialGradient(0, 0, 0, 0, 0, 24);
    glow.addColorStop(0, "rgba(255, 191, 105, 1)");
    glow.addColorStop(0.6, "rgba(255, 143, 199, 0.55)");
    glow.addColorStop(1, "rgba(255, 143, 199, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, 24, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#fff4be";
    context.beginPath();
    context.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = state.targetLaneIndex === 0 ? "rgba(126, 246, 255, 0.9)" : "rgba(255, 143, 199, 0.9)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, TARGET_RADIUS + 5, 0, Math.PI * 2);
    context.stroke();

    context.restore();
  }

  function drawPlayer() {
    const point = pointFor(state.laneRadius, state.angle);

    context.save();
    context.translate(point.x, point.y);

    const glow = context.createRadialGradient(0, 0, 0, 0, 0, 28);
    glow.addColorStop(0, "rgba(126, 246, 255, 1)");
    glow.addColorStop(0.7, "rgba(126, 246, 255, 0.26)");
    glow.addColorStop(1, "rgba(126, 246, 255, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, 28, 0, Math.PI * 2);
    context.fill();

    context.rotate(state.angle + Math.PI / 2);
    context.fillStyle = "#d6fbff";
    context.beginPath();
    context.moveTo(0, -PLAYER_RADIUS - 4);
    context.lineTo(PLAYER_RADIUS - 2, PLAYER_RADIUS + 2);
    context.lineTo(0, PLAYER_RADIUS - 3);
    context.lineTo(-PLAYER_RADIUS + 2, PLAYER_RADIUS + 2);
    context.closePath();
    context.fill();

    context.restore();
  }

  function drawCenterPulse() {
    context.save();
    context.translate(CENTER, CENTER);
    context.fillStyle = "rgba(126, 246, 255, 0.1)";
    context.beginPath();
    context.arc(0, 0, 18, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(126, 246, 255, 0.2)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, 28, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawFlashes(delta) {
    state.flashes = state.flashes.filter((flash) => {
      flash.life -= delta;
      if (flash.life <= 0) {
        return false;
      }

      const point = pointFor(flash.radius, flash.angle);
      const alpha = flash.life / flash.maxLife;
      const size = 8 + (1 - alpha) * 24;

      context.save();
      context.translate(point.x, point.y);
      context.strokeStyle = flash.color.replace("ALPHA", alpha.toFixed(3));
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, size, 0, Math.PI * 2);
      context.stroke();
      context.restore();

      return true;
    });
  }

  function drawArena(delta) {
    drawBackground();
    drawSafeBand();
    drawTarget();
    drawCenterPulse();
    drawPlayer();
    drawFlashes(delta);
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

  function updateDifficulty() {
    const level = Math.min(SHRINK_STEPS, Math.floor(state.score / 5));
    if (level !== state.shrinkLevel) {
      state.shrinkLevel = level;
      setMessage(`Orbit band tightened. Stay sharp on the ${state.laneIndex === 0 ? "outer" : "inner"} lane.`);
    }
    state.angularSpeed = BASE_ANGULAR_SPEED + state.shrinkLevel * 0.18 + (state.pulseBoostLeft > 0 ? PULSE_BOOST : 0);
  }

  function movePlayerTowardLane(delta) {
    const targetRadius = laneRadiusFor(state.laneIndex);
    state.laneRadius += (targetRadius - state.laneRadius) * Math.min(1, delta * 8.5);
  }

  function checkCollection() {
    const laneMatch = state.laneIndex === state.targetLaneIndex;
    if (!laneMatch) {
      return;
    }

    const difference = Math.abs(wrapAngle(state.angle - state.targetAngle));
    if (difference <= COLLECTION_THRESHOLD) {
      state.score += 1;
      addFlash(laneRadiusFor(state.targetLaneIndex), state.targetAngle, "rgba(255, 191, 105, ALPHA)");
      spawnTarget();
      updateDifficulty();

      if (state.score >= GOAL_SCORE) {
        endGame(true);
        return;
      }

      if (state.score % 5 === 0) {
        setMessage("Safe band shrank. Pulse early and keep your orbit clean.");
      } else {
        setMessage(`Snack secured. ${GOAL_SCORE - state.score} to go.`);
      }
    }
  }

  function endGame(won) {
    state.running = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    if (won) {
      showOverlay(
        "Collection Complete",
        `You caught all ${GOAL_SCORE} snacks before the orbit fully tightened. Run it again for a cleaner line.`,
        "Play Again"
      );
      setMessage("Orbit cleared.");
    } else {
      showOverlay(
        "Time Burned Out",
        `You reached ${state.score} snacks. Tap earlier on lane swaps and keep the target lined up as the band shrinks.`,
        "Try Again"
      );
      setMessage("Timer expired.");
    }
  }

  function tick(timestamp) {
    if (!state.running) {
      return;
    }

    if (!state.lastTimestamp) {
      state.lastTimestamp = timestamp;
    }

    const delta = Math.min(0.035, (timestamp - state.lastTimestamp) / 1000);
    state.lastTimestamp = timestamp;

    if (state.pulseCooldownLeft > 0) {
      state.pulseCooldownLeft = Math.max(0, state.pulseCooldownLeft - delta);
    }

    if (state.pulseBoostLeft > 0) {
      state.pulseBoostLeft = Math.max(0, state.pulseBoostLeft - delta);
    }

    updateDifficulty();
    state.angle += state.angularSpeed * delta;
    movePlayerTowardLane(delta);
    checkCollection();

    state.timeLeft = Math.max(0, state.timeLeft - delta);
    state.targetGlow += delta;
    updateHud();
    drawArena(delta);

    if (state.timeLeft <= 0) {
      endGame(false);
      return;
    }

    state.rafId = requestAnimationFrame(tick);
  }

  function triggerPulse() {
    if (!state.running || state.pulseCooldownLeft > 0) {
      return;
    }

    state.laneIndex = state.laneIndex === 0 ? 1 : 0;
    state.pulseCooldownLeft = PULSE_COOLDOWN;
    state.pulseBoostLeft = PULSE_DURATION;
    addFlash(state.laneRadius, state.angle, "rgba(126, 246, 255, ALPHA)");
    setMessage(`Pulse to ${state.laneIndex === 0 ? "outer" : "inner"} lane.`);
    updateHud();
  }

  function resetGame() {
    state.running = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    state.score = 0;
    state.timeLeft = TOTAL_TIME;
    state.angle = -Math.PI / 2;
    state.angularSpeed = BASE_ANGULAR_SPEED;
    state.pulseBoostLeft = 0;
    state.pulseCooldownLeft = 0;
    state.laneIndex = 0;
    state.laneRadius = BASE_OUTER_RADIUS;
    state.targetLaneIndex = 0;
    state.targetAngle = Math.PI / 2;
    state.targetGlow = 0;
    state.shrinkLevel = 0;
    state.lastTimestamp = 0;
    state.flashes = [];
    spawnTarget();
    updateHud();
    drawArena(0);
    showOverlay(
      "Start Collection",
      "Tap to swap between the outer and inner lane. Match the snack lane, pass through it, and reach 20 points before time ends.",
      "Start"
    );
    setMessage("Tap start, then pulse between lanes to catch the next snack.");
  }

  function startGame() {
    hideOverlay();
    state.running = true;
    state.lastTimestamp = 0;
    updateHud();
    setMessage("Collection started. Tap to swap lanes.");
    state.rafId = requestAnimationFrame(tick);
  }

  overlayButtonEl.addEventListener("click", startGame);
  restartButtonEl.addEventListener("click", resetGame);
  window.addEventListener("pointerdown", (event) => {
    if (overlayEl.classList.contains("is-visible")) {
      return;
    }
    if (event.target === restartButtonEl) {
      return;
    }
    triggerPulse();
  });
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      if (!overlayEl.classList.contains("is-visible")) {
        triggerPulse();
      }
    }
  });

  resetGame();
})();
