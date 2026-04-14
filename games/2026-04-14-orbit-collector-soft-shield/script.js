"use strict";

(function initSoftShield() {
  const GOAL_SCORE = 12;
  const PLAYER_SPEED = 1.22;
  const SWITCH_COOLDOWN_MS = 170;
  const COLLECT_ARC = 0.17;
  const COLLISION_ARC = 0.15;
  const PERFECT_ARC = 0.46;
  const PERFECT_WINDOW_MS = 320;
  const SHIELD_TARGET = 3;
  const SHIELD_GRACE_MS = 1100;
  const FULL_TURN = Math.PI * 2;

  const state = {
    running: false,
    rafId: 0,
    lastTick: 0,
    playerAngle: -Math.PI / 2,
    playerLane: 1,
    score: 0,
    perfectStreak: 0,
    shieldReady: false,
    shieldFlashUntil: 0,
    collisionGraceUntil: 0,
    message: "아레나를 탭해 궤도를 바꾸세요.",
    hazards: [],
    target: null,
    nextTargetId: 1,
    lastSwitchAt: -Infinity,
    lastSwitchTargetId: -1,
    canvasSize: 640,
  };

  const arenaButtonEl = document.querySelector("#arenaButton");
  const canvasEl = document.querySelector("#arena");
  const context = canvasEl.getContext("2d");
  const messageLineEl = document.querySelector("#messageLine");
  const scoreValueEl = document.querySelector("#scoreValue");
  const shieldValueEl = document.querySelector("#shieldValue");
  const hazardValueEl = document.querySelector("#hazardValue");
  const overlayEl = document.querySelector("#overlay");
  const overlayTitleEl = document.querySelector("#overlayTitle");
  const overlayTextEl = document.querySelector("#overlayText");
  const overlayButtonEl = document.querySelector("#overlayButton");
  const restartButtonEl = document.querySelector("#restartButton");

  function normalizeAngle(angle) {
    let value = angle % FULL_TURN;
    if (value < 0) {
      value += FULL_TURN;
    }
    return value;
  }

  function angleDistance(left, right) {
    const a = normalizeAngle(left);
    const b = normalizeAngle(right);
    const diff = Math.abs(a - b);
    return Math.min(diff, FULL_TURN - diff);
  }

  function randomAngle() {
    return Math.random() * FULL_TURN;
  }

  function setMessage(text) {
    state.message = text;
    messageLineEl.textContent = text;
  }

  function updateHud() {
    scoreValueEl.textContent = `${state.score} / ${GOAL_SCORE}`;
    shieldValueEl.textContent = state.shieldReady ? "준비 완료" : `${state.perfectStreak} / ${SHIELD_TARGET}`;
    hazardValueEl.textContent = String(state.hazards.length);
  }

  function showOverlay(title, text, buttonText) {
    overlayTitleEl.textContent = title;
    overlayTextEl.textContent = text;
    overlayButtonEl.textContent = buttonText;
    overlayEl.classList.add("is-visible");
  }

  function hideOverlay() {
    overlayEl.classList.remove("is-visible");
  }

  function updateCanvasSize() {
    const rect = canvasEl.getBoundingClientRect();
    const size = Math.max(280, Math.round(Math.min(rect.width || 640, 640)));
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.round(size * dpr);
    canvasEl.height = Math.round(size * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.canvasSize = size;
    drawScene(performance.now());
  }

  function createHazard(lane, angle, speed) {
    return { lane, angle, speed };
  }

  function resetHazards() {
    state.hazards = [
      createHazard(1, Math.PI * 0.85, -0.82),
    ];
  }

  function maybeUnlockSecondHazard() {
    if (state.score < 6 || state.hazards.length > 1) {
      return;
    }

    state.hazards.push(createHazard(0, normalizeAngle(state.playerAngle + Math.PI * 0.55), 1.08));
    setMessage("두 번째 위협이 등장했습니다. 실드를 아껴 교차 구간을 버티세요.");
    updateHud();
  }

  function spawnTarget() {
    let lane = Math.random() > 0.5 ? 1 : 0;
    let angle = randomAngle();

    for (let attempt = 0; attempt < 80; attempt += 1) {
      lane = Math.random() > 0.5 ? 1 : 0;
      angle = randomAngle();

      const tooCloseToPlayer = lane === state.playerLane && angleDistance(angle, state.playerAngle) < 0.72;
      const tooCloseToHazard = state.hazards.some((hazard) => hazard.lane === lane && angleDistance(angle, hazard.angle) < 0.52);

      if (!tooCloseToPlayer && !tooCloseToHazard) {
        break;
      }
    }

    state.target = {
      id: state.nextTargetId,
      lane,
      angle,
    };
    state.nextTargetId += 1;
  }

  function resetGame() {
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    state.running = false;
    state.lastTick = 0;
    state.playerAngle = -Math.PI / 2;
    state.playerLane = 1;
    state.score = 0;
    state.perfectStreak = 0;
    state.shieldReady = false;
    state.shieldFlashUntil = 0;
    state.collisionGraceUntil = 0;
    state.lastSwitchAt = -Infinity;
    state.lastSwitchTargetId = -1;
    state.nextTargetId = 1;
    resetHazards();
    spawnTarget();
    updateHud();
    setMessage("아레나를 탭해 궤도를 바꾸세요.");
    drawScene(performance.now());
  }

  function startGame() {
    resetGame();
    state.running = true;
    state.lastTick = performance.now();
    hideOverlay();
    setMessage("맞닿기 직전에 코어 레인으로 들어가세요.");
    state.rafId = window.requestAnimationFrame(step);
  }

  function endGame(win) {
    state.running = false;
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;

    if (win) {
      showOverlay(
        "실드 주행 완료",
        "부드러운 코어 12개를 모두 모았습니다. 다시 시작해 더 적은 위험 전환으로 깔끔한 루트를 노려보세요.",
        "다시 플레이"
      );
      setMessage("모든 코어를 확보했습니다.");
      return;
    }

    showOverlay(
      "궤도 붕괴",
      "실드가 준비되기 전에 위협과 충돌했습니다. 다시 시작해서 완벽 전환 세 번을 더 빨리 모아보세요.",
      "다시 도전"
    );
    setMessage("충돌이 발생했습니다. 다시 시작하세요.");
  }

  function consumeShield(now) {
    state.shieldReady = false;
    state.perfectStreak = 0;
    state.collisionGraceUntil = now + SHIELD_GRACE_MS;
    state.shieldFlashUntil = now + 280;
    updateHud();
    setMessage("실드가 충돌을 막았습니다. 다음 실드를 다시 모으세요.");
  }

  function handleCollect(now) {
    const perfect = state.lastSwitchTargetId === state.target.id && now - state.lastSwitchAt <= PERFECT_WINDOW_MS;
    state.score += 1;

    if (perfect) {
      if (!state.shieldReady) {
        state.perfectStreak += 1;
        if (state.perfectStreak >= SHIELD_TARGET) {
          state.perfectStreak = 0;
          state.shieldReady = true;
          setMessage("완벽 연속 성공. 실드 준비 완료.");
        } else {
          setMessage(`완벽 전환. 실드 충전 ${state.perfectStreak}/${SHIELD_TARGET}.`);
        }
      } else {
        setMessage("코어 확보. 실드는 이미 준비되어 있습니다.");
      }
    } else {
      state.perfectStreak = 0;
      setMessage(state.score >= 6
        ? "코어 확보. 이제 두 레인의 위협을 같이 읽어야 합니다."
        : "코어 확보. 정확한 타이밍이 실드를 만듭니다.");
    }

    if (state.score >= GOAL_SCORE) {
      updateHud();
      drawScene(now);
      endGame(true);
      return;
    }

    maybeUnlockSecondHazard();
    spawnTarget();
    updateHud();
  }

  function trySwitchLane() {
    if (!state.running) {
      return;
    }

    const now = performance.now();
    if (now - state.lastSwitchAt < SWITCH_COOLDOWN_MS) {
      return;
    }

    const nextLane = state.playerLane === 0 ? 1 : 0;
    state.playerLane = nextLane;
    state.lastSwitchAt = now;
    state.lastSwitchTargetId = nextLane === state.target.lane && angleDistance(state.playerAngle, state.target.angle) <= PERFECT_ARC
      ? state.target.id
      : -1;

    if (state.lastSwitchTargetId === state.target.id) {
      setMessage("좋은 타이밍입니다. 그대로 코어를 통과하세요.");
    } else {
      setMessage("레인을 바꿨습니다. 다음 코어 링에 맞추세요.");
    }
  }

  function step(timestamp) {
    if (!state.running) {
      return;
    }

    const deltaMs = Math.min(32, timestamp - state.lastTick || 16);
    const deltaSeconds = deltaMs / 1000;
    state.lastTick = timestamp;

    const speedBoost = state.score >= 9 ? 0.18 : state.score >= 6 ? 0.1 : 0;
    state.playerAngle = normalizeAngle(state.playerAngle + (PLAYER_SPEED + speedBoost) * deltaSeconds);

    for (const hazard of state.hazards) {
      hazard.angle = normalizeAngle(hazard.angle + hazard.speed * deltaSeconds);
    }

    if (state.target && state.playerLane === state.target.lane && angleDistance(state.playerAngle, state.target.angle) <= COLLECT_ARC) {
      handleCollect(timestamp);
      if (!state.running) {
        return;
      }
    }

    if (timestamp >= state.collisionGraceUntil) {
      for (const hazard of state.hazards) {
        if (hazard.lane === state.playerLane && angleDistance(state.playerAngle, hazard.angle) <= COLLISION_ARC) {
          if (state.shieldReady) {
            consumeShield(timestamp);
          } else {
            drawScene(timestamp);
            endGame(false);
            return;
          }
          break;
        }
      }
    }

    drawScene(timestamp);
    state.rafId = window.requestAnimationFrame(step);
  }

  function polarPoint(radius, angle) {
    const center = state.canvasSize / 2;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  }

  function laneRadius(lane) {
    const base = state.canvasSize / 2;
    return lane === 0 ? base * 0.42 : base * 0.68;
  }

  function drawRing(radius, color, width) {
    context.beginPath();
    context.lineWidth = width;
    context.strokeStyle = color;
    context.arc(state.canvasSize / 2, state.canvasSize / 2, radius, 0, FULL_TURN);
    context.stroke();
  }

  function drawScene(now) {
    const size = state.canvasSize;
    const center = size / 2;

    context.clearRect(0, 0, size, size);

    const field = context.createRadialGradient(center, center, size * 0.08, center, center, size * 0.52);
    field.addColorStop(0, "rgba(255,255,255,0.05)");
    field.addColorStop(1, "rgba(9,12,16,0.96)");
    context.fillStyle = field;
    context.fillRect(0, 0, size, size);

    drawRing(laneRadius(0), "rgba(255,255,255,0.18)", size * 0.025);
    drawRing(laneRadius(1), "rgba(255,255,255,0.12)", size * 0.025);

    context.beginPath();
    context.fillStyle = "rgba(255,255,255,0.04)";
    context.arc(center, center, size * 0.14, 0, FULL_TURN);
    context.fill();

    if (state.target) {
      const targetPoint = polarPoint(laneRadius(state.target.lane), state.target.angle);
      const glow = context.createRadialGradient(targetPoint.x, targetPoint.y, 2, targetPoint.x, targetPoint.y, size * 0.08);
      glow.addColorStop(0, "rgba(139, 211, 255, 0.95)");
      glow.addColorStop(1, "rgba(139, 211, 255, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(targetPoint.x, targetPoint.y, size * 0.08, 0, FULL_TURN);
      context.fill();

      context.beginPath();
      context.fillStyle = "#8bd3ff";
      context.arc(targetPoint.x, targetPoint.y, size * 0.022, 0, FULL_TURN);
      context.fill();

      context.beginPath();
      context.lineWidth = size * 0.008;
      context.strokeStyle = "rgba(139, 211, 255, 0.75)";
      context.arc(targetPoint.x, targetPoint.y, size * 0.04, 0, FULL_TURN);
      context.stroke();
    }

    for (const hazard of state.hazards) {
      const point = polarPoint(laneRadius(hazard.lane), hazard.angle);
      const glow = context.createRadialGradient(point.x, point.y, 2, point.x, point.y, size * 0.07);
      glow.addColorStop(0, "rgba(255, 138, 122, 0.9)");
      glow.addColorStop(1, "rgba(255, 138, 122, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(point.x, point.y, size * 0.065, 0, FULL_TURN);
      context.fill();

      context.beginPath();
      context.fillStyle = "#ff8a7a";
      context.arc(point.x, point.y, size * 0.019, 0, FULL_TURN);
      context.fill();
    }

    if (state.shieldReady || now < state.shieldFlashUntil || now < state.collisionGraceUntil) {
      const shieldRadius = laneRadius(state.playerLane) + size * 0.035;
      context.beginPath();
      context.lineWidth = size * 0.013;
      context.strokeStyle = state.shieldReady
        ? "rgba(157, 255, 203, 0.7)"
        : "rgba(157, 255, 203, 0.35)";
      context.arc(center, center, shieldRadius, state.playerAngle - 0.45, state.playerAngle + 0.45);
      context.stroke();
    }

    const playerPoint = polarPoint(laneRadius(state.playerLane), state.playerAngle);
    const playerGlow = context.createRadialGradient(playerPoint.x, playerPoint.y, 2, playerPoint.x, playerPoint.y, size * 0.08);
    playerGlow.addColorStop(0, "rgba(255,255,255,1)");
    playerGlow.addColorStop(1, "rgba(207,232,255,0)");
    context.fillStyle = playerGlow;
    context.beginPath();
    context.arc(playerPoint.x, playerPoint.y, size * 0.075, 0, FULL_TURN);
    context.fill();

    context.beginPath();
    context.fillStyle = "#f6fbff";
    context.arc(playerPoint.x, playerPoint.y, size * 0.024, 0, FULL_TURN);
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.6)";
    context.font = `${Math.round(size * 0.035)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.fillText("탭해 궤도 전환", center, center + size * 0.01);
  }

  function handleStartOrRestart() {
    startGame();
  }

  arenaButtonEl.addEventListener("click", trySwitchLane);
  overlayButtonEl.addEventListener("click", handleStartOrRestart);
  restartButtonEl.addEventListener("click", startGame);

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space") {
      return;
    }
    event.preventDefault();
    if (overlayEl.classList.contains("is-visible")) {
      handleStartOrRestart();
      return;
    }
    trySwitchLane();
  });

  window.addEventListener("resize", updateCanvasSize);

  updateCanvasSize();
  resetGame();
})();
