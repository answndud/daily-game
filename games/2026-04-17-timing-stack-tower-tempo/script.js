"use strict";

(function initTowerTempo() {
  const canvas = document.querySelector("#towerCanvas");
  const context = canvas.getContext("2d");

  const floorValueEl = document.querySelector("#floorValue");
  const timeValueEl = document.querySelector("#timeValue");
  const comboValueEl = document.querySelector("#comboValue");
  const tempoValueEl = document.querySelector("#tempoValue");
  const roundValueEl = document.querySelector("#roundValue");
  const slowValueEl = document.querySelector("#slowValue");
  const slowFillEl = document.querySelector("#slowFill");
  const messageLineEl = document.querySelector("#messageLine");
  const overlayEl = document.querySelector("#overlay");
  const overlayTitleEl = document.querySelector("#overlayTitle");
  const overlayTextEl = document.querySelector("#overlayText");
  const overlayButtonEl = document.querySelector("#overlayButton");
  const restartButtonEl = document.querySelector("#restartButton");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const TARGET_FLOORS = 12;
  const FLOOR_HEIGHT = 28;
  const STACK_BASE_Y = HEIGHT - 46;
  const START_WIDTH = 150;
  const MIN_WIDTH = 38;
  const PERFECT_THRESHOLD = 6;
  const TOTAL_TIME = 40;
  const SLOW_DURATION = 1.7;

  const palette = ["#ffc06b", "#ff9d76", "#7ee6ff", "#d8c1ff", "#ff8ec7"];

  const state = {
    phase: "ready",
    running: false,
    round: 1,
    timeLeft: TOTAL_TIME,
    combo: 0,
    floorsPlaced: 0,
    slowTimeLeft: 0,
    stack: [],
    currentBlock: null,
    lastTimestamp: 0,
    rafId: 0,
    flashes: [],
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
      life: 0.35,
      maxLife: 0.35,
    });
  }

  function blockColor(index) {
    return palette[index % palette.length];
  }

  function topBlock() {
    return state.stack[state.stack.length - 1];
  }

  function stackTopY() {
    return STACK_BASE_Y - state.stack.length * FLOOR_HEIGHT;
  }

  function updateHud() {
    floorValueEl.textContent = `${state.floorsPlaced} / ${TARGET_FLOORS}`;
    timeValueEl.textContent = `${state.timeLeft.toFixed(1)}초`;
    comboValueEl.textContent = String(state.combo);
    roundValueEl.textContent = String(state.round);
    tempoValueEl.textContent = state.slowTimeLeft > 0
      ? "느림"
      : state.round >= 4
        ? "광속"
        : state.round >= 3
          ? "매우 빠름"
          : state.round >= 2 || state.combo >= 2
            ? "빠름"
            : "보통";
    const slowPercent = Math.max(0, Math.min(100, (state.slowTimeLeft / SLOW_DURATION) * 100));
    slowValueEl.textContent = `${Math.round(slowPercent)}%`;
    slowFillEl.style.width = `${slowPercent}%`;
  }

  function resetRound() {
    state.timeLeft = TOTAL_TIME;
    state.combo = 0;
    state.floorsPlaced = 0;
    state.slowTimeLeft = 0;
    state.stack = [
      {
        x: WIDTH / 2 - START_WIDTH / 2,
        y: STACK_BASE_Y - FLOOR_HEIGHT,
        width: START_WIDTH,
        color: blockColor(0),
      },
    ];
    state.currentBlock = {
      x: 18,
      y: stackTopY() - FLOOR_HEIGHT - 18,
      width: START_WIDTH,
      vx: 164 + (state.round - 1) * 18,
      color: blockColor(1),
    };
    state.lastTimestamp = 0;
    state.flashes = [];
  }

  function createNextBlock() {
    const base = topBlock();
    const width = Math.max(MIN_WIDTH, base.width);
    state.currentBlock = {
      x: 18,
      y: stackTopY() - FLOOR_HEIGHT - 18,
      width,
      vx: 170 + (state.round - 1) * 22 + state.floorsPlaced * 6,
      color: blockColor(state.floorsPlaced + 1),
    };
  }

  function drawBackground() {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    const bg = context.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, "rgba(14, 18, 28, 0.96)");
    bg.addColorStop(1, "rgba(5, 7, 11, 0.99)");
    context.fillStyle = bg;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.strokeStyle = "rgba(255,255,255,0.04)";
    context.lineWidth = 1;
    for (let line = 0; line < 8; line += 1) {
      const y = 48 + line * 54;
      context.beginPath();
      context.moveTo(28, y);
      context.lineTo(WIDTH - 28, y);
      context.stroke();
    }
  }

  function drawStack() {
    for (const block of state.stack) {
      const glow = context.createLinearGradient(block.x, block.y, block.x + block.width, block.y + FLOOR_HEIGHT);
      glow.addColorStop(0, block.color);
      glow.addColorStop(1, "rgba(255,255,255,0.12)");
      context.fillStyle = glow;
      context.fillRect(block.x, block.y, block.width, FLOOR_HEIGHT);
      context.strokeStyle = "rgba(255,255,255,0.12)";
      context.strokeRect(block.x, block.y, block.width, FLOOR_HEIGHT);
    }
  }

  function drawCurrentBlock() {
    if (!state.currentBlock) {
      return;
    }
    const block = state.currentBlock;
    const glow = context.createLinearGradient(block.x, block.y, block.x + block.width, block.y + FLOOR_HEIGHT);
    glow.addColorStop(0, block.color);
    glow.addColorStop(1, "rgba(255,255,255,0.16)");
    context.fillStyle = glow;
    context.fillRect(block.x, block.y, block.width, FLOOR_HEIGHT);
    context.strokeStyle = "rgba(255,255,255,0.18)";
    context.strokeRect(block.x, block.y, block.width, FLOOR_HEIGHT);
  }

  function drawGoalMarkers() {
    context.fillStyle = "rgba(255,255,255,0.08)";
    context.font = "700 14px Trebuchet MS";
    context.fillText("12층 완성", 24, 30);
    context.fillText("기준선", 24, STACK_BASE_Y + 18);
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
      context.arc(flash.x, flash.y, 16 + (1 - alpha) * 20, 0, Math.PI * 2);
      context.stroke();
      return true;
    });
  }

  function drawScene(delta) {
    drawBackground();
    drawGoalMarkers();
    drawStack();
    drawCurrentBlock();
    drawFlashes(delta);
  }

  function advanceRound() {
    state.phase = "between-rounds";
    state.running = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    state.round += 1;
    showOverlay(
      `라운드 ${state.round} 시작`,
      `12층을 완성했습니다. 다음 라운드에서는 블록 속도가 더 빨라집니다.`,
      "다음 라운드"
    );
    setMessage(`라운드 ${state.round - 1} 클리어. 다음 라운드 준비.`);
    updateHud();
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
        "리듬 완주",
        `라운드 ${state.round}에서 12층을 완성했습니다. 최종 정밀 콤보는 ${state.combo}입니다.`,
        "다시 플레이"
      );
      setMessage("타워를 완성했습니다.");
    } else {
      showOverlay(
        "리듬 붕괴",
        `블록이 완전히 빗나갔습니다. 남은 층수는 ${TARGET_FLOORS - state.floorsPlaced}층입니다.`,
        "다시 시도"
      );
      setMessage("정렬에 실패했습니다.");
    }
  }

  function dropBlock() {
    if (!state.running || !state.currentBlock) {
      return;
    }

    const current = state.currentBlock;
    const below = topBlock();
    const overlapLeft = Math.max(current.x, below.x);
    const overlapRight = Math.min(current.x + current.width, below.x + below.width);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      addFlash(current.x + current.width / 2, current.y + FLOOR_HEIGHT / 2, "rgba(255, 138, 91, ALPHA)");
      state.currentBlock = null;
      endGame(false);
      return;
    }

    const offset = Math.abs(current.x - below.x);
    const perfect = offset <= PERFECT_THRESHOLD;
    const placed = {
      x: overlapLeft,
      y: stackTopY() - FLOOR_HEIGHT,
      width: overlapWidth,
      color: current.color,
    };

    state.stack.push(placed);
    state.floorsPlaced += 1;
    addFlash(placed.x + placed.width / 2, placed.y + FLOOR_HEIGHT / 2, perfect ? "rgba(126, 230, 255, ALPHA)" : "rgba(255, 192, 107, ALPHA)");

    if (perfect) {
      state.combo += 1;
      if (state.combo % 2 === 0) {
        state.slowTimeLeft = SLOW_DURATION;
        setMessage("완벽 정렬. 템포 브레이크가 발동했습니다.");
      } else {
        setMessage(`완벽 정렬 ${state.combo}회.`);
      }
    } else {
      state.combo = 0;
      setMessage("블록을 쌓았습니다.");
    }

    if (state.floorsPlaced >= TARGET_FLOORS) {
      state.currentBlock = null;
      advanceRound();
      return;
    }

    createNextBlock();
    updateHud();
    drawScene(0);
  }

  function updateCurrentBlock(delta) {
    if (!state.currentBlock) {
      return;
    }
    const speedScale = state.slowTimeLeft > 0 ? 0.56 : 1;
    state.currentBlock.x += state.currentBlock.vx * speedScale * delta;

    if (state.currentBlock.x <= 18) {
      state.currentBlock.x = 18;
      state.currentBlock.vx *= -1;
    } else if (state.currentBlock.x + state.currentBlock.width >= WIDTH - 18) {
      state.currentBlock.x = WIDTH - 18 - state.currentBlock.width;
      state.currentBlock.vx *= -1;
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

    state.timeLeft = Math.max(0, state.timeLeft - delta);
    if (state.slowTimeLeft > 0) {
      state.slowTimeLeft = Math.max(0, state.slowTimeLeft - delta);
    }

    updateCurrentBlock(delta);
    updateHud();
    drawScene(delta);

    if (state.timeLeft <= 0) {
      endGame(false);
      return;
    }

    state.rafId = requestAnimationFrame(tick);
  }

  function resetGame() {
    state.phase = "ready";
    state.running = false;
    state.round = 1;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    resetRound();
    updateHud();
    drawScene(0);
    showOverlay(
      "쌓기 시작",
      "화면을 탭하면 현재 블록이 바로 떨어집니다. 아래 블록과 겹친 부분만 살아남고, 완벽 정렬 2회마다 잠깐 속도가 느려집니다.",
      "시작"
    );
    setMessage("시작 후 화면을 탭해 블록을 떨어뜨리세요.");
  }

  function startGame() {
    state.phase = "playing";
    resetRound();
    hideOverlay();
    state.running = true;
    updateHud();
    drawScene(0);
    setMessage(`라운드 ${state.round} 시작. 블록을 맞춰 쌓으세요.`);
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

  function handleCanvasPress(event) {
    if (!state.running) {
      return;
    }
    event.preventDefault();
    dropBlock();
  }

  overlayEl.addEventListener("pointerdown", handleOverlayPress);
  overlayEl.addEventListener("keydown", handleOverlayKeydown);
  overlayButtonEl.addEventListener("click", handleOverlayPress);
  restartButtonEl.addEventListener("click", resetGame);
  canvas.addEventListener("pointerdown", handleCanvasPress);
  window.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      if (state.running) {
        event.preventDefault();
        dropBlock();
      }
    }
  });

  resetGame();
})();
