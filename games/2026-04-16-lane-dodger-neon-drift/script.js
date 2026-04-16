"use strict";

(function initNeonDrift() {
  const canvas = document.querySelector("#roadCanvas");
  const context = canvas.getContext("2d");

  const waveValueEl = document.querySelector("#waveValue");
  const timeValueEl = document.querySelector("#timeValue");
  const comboValueEl = document.querySelector("#comboValue");
  const speedValueEl = document.querySelector("#speedValue");
  const slowValueEl = document.querySelector("#slowValue");
  const slowFillEl = document.querySelector("#slowFill");
  const messageLineEl = document.querySelector("#messageLine");
  const overlayEl = document.querySelector("#overlay");
  const overlayTitleEl = document.querySelector("#overlayTitle");
  const overlayTextEl = document.querySelector("#overlayText");
  const overlayButtonEl = document.querySelector("#overlayButton");
  const restartButtonEl = document.querySelector("#restartButton");
  const leftButtonEl = document.querySelector("#leftButton");
  const rightButtonEl = document.querySelector("#rightButton");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const LANE_COUNT = 4;
  const ROAD_TOP = 34;
  const ROAD_BOTTOM = HEIGHT - 26;
  const PLAYER_Y = HEIGHT - 82;
  const PLAYER_WIDTH = 42;
  const PLAYER_HEIGHT = 66;
  const OBSTACLE_WIDTH = 42;
  const OBSTACLE_HEIGHT = 58;
  const WAVE_DURATION = 12;
  const TOTAL_WAVES = 3;
  const SWIPE_THRESHOLD = 24;
  const BASE_SLOW_TIME = 1.8;

  const laneCenters = Array.from({ length: LANE_COUNT }, (_, index) => {
    const usableWidth = WIDTH - 68;
    return 34 + (usableWidth / LANE_COUNT) * index + usableWidth / LANE_COUNT / 2;
  });

  const state = {
    phase: "ready",
    running: false,
    wave: 1,
    waveTimeLeft: WAVE_DURATION,
    combo: 0,
    laneIndex: 1,
    playerX: laneCenters[1],
    obstacles: [],
    flashes: [],
    slowTimeLeft: 0,
    spawnTimer: 0.72,
    speedMultiplier: 1,
    lastTimestamp: 0,
    dragStartX: null,
    nearMissIds: new Set(),
    nextObstacleId: 1,
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

  function addFlash(x, y, color) {
    state.flashes.push({
      x,
      y,
      color,
      life: 0.28,
      maxLife: 0.28,
    });
  }

  function resetRound() {
    state.wave = 1;
    state.waveTimeLeft = WAVE_DURATION;
    state.combo = 0;
    state.laneIndex = 1;
    state.playerX = laneCenters[state.laneIndex];
    state.obstacles = [];
    state.flashes = [];
    state.slowTimeLeft = 0;
    state.spawnTimer = 0.72;
    state.speedMultiplier = 1;
    state.lastTimestamp = 0;
    state.dragStartX = null;
    state.nearMissIds = new Set();
    state.nextObstacleId = 1;
  }

  function updateHud() {
    waveValueEl.textContent = `${state.wave} / ${TOTAL_WAVES}`;
    timeValueEl.textContent = `${state.waveTimeLeft.toFixed(1)}초`;
    comboValueEl.textContent = String(state.combo);
    speedValueEl.textContent = state.slowTimeLeft > 0 ? "감속" : state.wave === 1 ? "보통" : state.wave === 2 ? "빠름" : "매우 빠름";
    const slowPercent = Math.max(0, Math.min(100, (state.slowTimeLeft / BASE_SLOW_TIME) * 100));
    slowValueEl.textContent = `${Math.round(slowPercent)}%`;
    slowFillEl.style.width = `${slowPercent}%`;
  }

  function currentSpawnInterval() {
    return Math.max(0.22, 0.74 - state.wave * 0.08 - state.combo * 0.012);
  }

  function currentSpeed() {
    const waveSpeed = 164 + state.wave * 38;
    return state.slowTimeLeft > 0 ? waveSpeed * 0.58 : waveSpeed;
  }

  function spawnObstacle() {
    const laneIndex = Math.floor(Math.random() * LANE_COUNT);
    state.obstacles.push({
      id: state.nextObstacleId++,
      laneIndex,
      x: laneCenters[laneIndex],
      y: ROAD_TOP - OBSTACLE_HEIGHT,
      speed: currentSpeed() + Math.random() * 24,
      nearMissAwarded: false,
    });
  }

  function moveLane(direction) {
    const nextLane = Math.min(LANE_COUNT - 1, Math.max(0, state.laneIndex + direction));
    if (nextLane === state.laneIndex) {
      return;
    }
    state.laneIndex = nextLane;
    state.playerX = laneCenters[nextLane];
    setMessage(`${nextLane + 1}번 차선으로 이동했습니다.`);
  }

  function triggerSlow() {
    state.slowTimeLeft = BASE_SLOW_TIME;
    addFlash(state.playerX, PLAYER_Y, "rgba(255, 126, 219, ALPHA)");
    setMessage("근접 콤보 3회. 잠깐 감속합니다.");
  }

  function endGame(won) {
    state.phase = "ended";
    state.running = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    if (won) {
      showOverlay(
        "드리프트 성공",
        `세 개 웨이브를 모두 버텼습니다. 최고 콤보는 ${state.combo}였습니다.`,
        "다시 플레이"
      );
      setMessage("모든 웨이브를 통과했습니다.");
    } else {
      showOverlay(
        "충돌 발생",
        "위협 블록과 직접 충돌했습니다. 한 차선 먼저 읽고 움직이면 더 안정적입니다.",
        "다시 시도"
      );
      setMessage("충돌했습니다.");
    }
  }

  function drawRoad() {
    context.clearRect(0, 0, WIDTH, HEIGHT);

    const background = context.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, "rgba(8, 14, 24, 0.96)");
    background.addColorStop(1, "rgba(2, 5, 11, 0.99)");
    context.fillStyle = background;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.fillStyle = "rgba(255,255,255,0.03)";
    context.fillRect(22, ROAD_TOP, WIDTH - 44, ROAD_BOTTOM - ROAD_TOP);

    context.strokeStyle = "rgba(108, 240, 255, 0.08)";
    context.lineWidth = 2;
    for (let lane = 1; lane < LANE_COUNT; lane += 1) {
      const x = (laneCenters[lane - 1] + laneCenters[lane]) / 2;
      context.beginPath();
      context.moveTo(x, ROAD_TOP);
      context.lineTo(x, ROAD_BOTTOM);
      context.stroke();
    }

    context.strokeStyle = "rgba(255,255,255,0.05)";
    context.strokeRect(22, ROAD_TOP, WIDTH - 44, ROAD_BOTTOM - ROAD_TOP);
  }

  function drawPlayer() {
    const x = state.playerX;
    const y = PLAYER_Y;
    const glow = context.createRadialGradient(x, y, 0, x, y, 44);
    glow.addColorStop(0, "rgba(108, 240, 255, 0.95)");
    glow.addColorStop(0.55, "rgba(108, 240, 255, 0.2)");
    glow.addColorStop(1, "rgba(108, 240, 255, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 44, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#d9fbff";
    context.beginPath();
    context.moveTo(x, y - PLAYER_HEIGHT / 2);
    context.lineTo(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT / 2);
    context.lineTo(x, y + PLAYER_HEIGHT / 4);
    context.lineTo(x - PLAYER_WIDTH / 2, y + PLAYER_HEIGHT / 2);
    context.closePath();
    context.fill();
  }

  function drawObstacles() {
    for (const obstacle of state.obstacles) {
      const glow = context.createRadialGradient(obstacle.x, obstacle.y, 0, obstacle.x, obstacle.y, 32);
      glow.addColorStop(0, "rgba(255, 126, 219, 0.95)");
      glow.addColorStop(0.55, "rgba(255, 126, 219, 0.22)");
      glow.addColorStop(1, "rgba(255, 126, 219, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(obstacle.x, obstacle.y, 28, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#ffd5f6";
      context.fillRect(
        obstacle.x - OBSTACLE_WIDTH / 2,
        obstacle.y - OBSTACLE_HEIGHT / 2,
        OBSTACLE_WIDTH,
        OBSTACLE_HEIGHT
      );
    }
  }

  function drawWaveLabels() {
    context.fillStyle = "rgba(255,255,255,0.08)";
    context.font = "700 16px Trebuchet MS";
    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      context.fillText(String(lane + 1), laneCenters[lane] - 4, ROAD_TOP + 20);
    }
  }

  function drawFlashes(delta) {
    state.flashes = state.flashes.filter((flash) => {
      flash.life -= delta;
      if (flash.life <= 0) {
        return false;
      }
      const alpha = flash.life / flash.maxLife;
      context.strokeStyle = flash.color.replace("ALPHA", alpha.toFixed(3));
      context.lineWidth = 3;
      context.beginPath();
      context.arc(flash.x, flash.y, 18 + (1 - alpha) * 22, 0, Math.PI * 2);
      context.stroke();
      return true;
    });
  }

  function drawScene(delta) {
    drawRoad();
    drawWaveLabels();
    drawObstacles();
    drawPlayer();
    drawFlashes(delta);
  }

  function updateObstacles(delta) {
    const speed = currentSpeed();
    for (let index = state.obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = state.obstacles[index];
      obstacle.y += speed * delta;

      const horizontalGap = Math.abs(obstacle.x - state.playerX);
      const verticalGap = Math.abs(obstacle.y - PLAYER_Y);

      if (!obstacle.nearMissAwarded && horizontalGap > 34 && horizontalGap < 86 && verticalGap < 42) {
        obstacle.nearMissAwarded = true;
        state.combo += 1;
        addFlash(obstacle.x, obstacle.y, "rgba(255, 201, 111, ALPHA)");
        if (state.combo % 3 === 0) {
          triggerSlow();
        } else {
          setMessage(`근접 회피 ${state.combo}회.`);
        }
      }

      if (horizontalGap < 34 && verticalGap < 46) {
        endGame(false);
        return;
      }

      if (obstacle.y - OBSTACLE_HEIGHT / 2 > ROAD_BOTTOM + 12) {
        state.obstacles.splice(index, 1);
      }
    }
  }

  function maybeAdvanceWave() {
    if (state.waveTimeLeft > 0) {
      return;
    }

    if (state.wave >= TOTAL_WAVES) {
      endGame(true);
      return;
    }

    state.wave += 1;
    state.waveTimeLeft = WAVE_DURATION;
    state.obstacles = [];
    state.spawnTimer = 0.85;
    state.slowTimeLeft = 0;
    setMessage(`${state.wave} 웨이브 시작. 속도가 올라갑니다.`);
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

    state.waveTimeLeft = Math.max(0, state.waveTimeLeft - delta);
    state.spawnTimer -= delta;
    if (state.slowTimeLeft > 0) {
      state.slowTimeLeft = Math.max(0, state.slowTimeLeft - delta);
    }

    if (state.spawnTimer <= 0) {
      spawnObstacle();
      state.spawnTimer = currentSpawnInterval();
    }

    updateObstacles(delta);
    if (!state.running) {
      return;
    }

    maybeAdvanceWave();
    if (!state.running) {
      return;
    }

    updateHud();
    drawScene(delta);
    state.rafId = requestAnimationFrame(tick);
  }

  function resetGame() {
    state.phase = "ready";
    state.running = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    resetRound();
    updateHud();
    drawScene(0);
    showOverlay(
      "웨이브 시작",
      "좌우 스와이프나 버튼으로 차선을 바꾸세요. 거의 스칠 듯 피하면 콤보가 쌓이고, 3콤보마다 잠깐 슬로우가 발동합니다.",
      "시작"
    );
    setMessage("시작 후 좌우로 움직여 길을 비우세요.");
  }

  function startGame() {
    state.phase = "playing";
    resetRound();
    hideOverlay();
    state.running = true;
    updateHud();
    drawScene(0);
    setMessage("1 웨이브 시작. 차선을 읽고 움직이세요.");
    state.rafId = requestAnimationFrame(tick);
  }

  function handleOverlayPress(event) {
    event.preventDefault();
    event.stopPropagation();
    if (state.phase === "playing" || !overlayEl.classList.contains("is-visible")) {
      return;
    }
    startGame();
  }

  function handleOverlayKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    handleOverlayPress(event);
  }

  function handlePointerDown(event) {
    state.dragStartX = event.clientX;
  }

  function handlePointerUp(event) {
    if (state.dragStartX === null || !state.running) {
      state.dragStartX = null;
      return;
    }
    const deltaX = event.clientX - state.dragStartX;
    if (deltaX <= -SWIPE_THRESHOLD) {
      moveLane(-1);
    } else if (deltaX >= SWIPE_THRESHOLD) {
      moveLane(1);
    }
    state.dragStartX = null;
  }

  function handleCanvasLeave() {
    state.dragStartX = null;
  }

  function handleKeydown(event) {
    if (!state.running) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveLane(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveLane(1);
    }
  }

  overlayEl.addEventListener("pointerdown", handleOverlayPress);
  overlayEl.addEventListener("keydown", handleOverlayKeydown);
  overlayButtonEl.addEventListener("click", handleOverlayPress);
  restartButtonEl.addEventListener("click", resetGame);
  leftButtonEl.addEventListener("click", () => moveLane(-1));
  rightButtonEl.addEventListener("click", () => moveLane(1));
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handleCanvasLeave);
  canvas.addEventListener("pointerleave", handleCanvasLeave);
  window.addEventListener("keydown", handleKeydown);

  resetGame();
})();
