"use strict";

(function initPocketPanic() {
  const canvas = document.querySelector("#arenaCanvas");
  const context = canvas.getContext("2d");

  const healthValueEl = document.querySelector("#healthValue");
  const timeValueEl = document.querySelector("#timeValue");
  const blockValueEl = document.querySelector("#blockValue");
  const threatValueEl = document.querySelector("#threatValue");
  const pressureValueEl = document.querySelector("#pressureValue");
  const pressureFillEl = document.querySelector("#pressureFill");
  const messageLineEl = document.querySelector("#messageLine");
  const overlayEl = document.querySelector("#overlay");
  const overlayTitleEl = document.querySelector("#overlayTitle");
  const overlayTextEl = document.querySelector("#overlayText");
  const overlayButtonEl = document.querySelector("#overlayButton");
  const restartButtonEl = document.querySelector("#restartButton");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const CORE = { x: WIDTH / 2, y: HEIGHT * 0.56, radius: 26 };
  const TOTAL_TIME = 45;
  const START_HEALTH = 3;
  const SHIELD_RADIUS = 28;
  const SHIELD_HIT_RADIUS = 34;
  const THREAT_RADIUS = 9;
  const MAX_THREATS_FOR_PRESSURE = 12;

  const state = {
    running: false,
    health: START_HEALTH,
    timeLeft: TOTAL_TIME,
    blocked: 0,
    shield: { x: WIDTH / 2, y: HEIGHT * 0.8 },
    pointerActive: false,
    pointerId: null,
    spawnCooldown: 0.4,
    spawnTimer: 0.4,
    difficulty: 0,
    threats: [],
    flashes: [],
    lastTimestamp: 0,
    rafId: 0,
  };

  function setMessage(text) {
    messageLineEl.textContent = text;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
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

  function threatLabel() {
    if (state.difficulty < 1.2) return "낮음";
    if (state.difficulty < 2.3) return "보통";
    return "높음";
  }

  function updateHud() {
    healthValueEl.textContent = String(state.health);
    timeValueEl.textContent = `${state.timeLeft.toFixed(1)}초`;
    blockValueEl.textContent = String(state.blocked);
    threatValueEl.textContent = threatLabel();

    const pressure = Math.min(100, Math.round((state.threats.length / MAX_THREATS_FOR_PRESSURE) * 100));
    pressureValueEl.textContent = `${pressure}%`;
    pressureFillEl.style.width = `${pressure}%`;
  }

  function addFlash(x, y, color, size) {
    state.flashes.push({
      x,
      y,
      color,
      size,
      life: 0.35,
      maxLife: 0.35,
    });
  }

  function resetShieldPosition() {
    state.shield.x = WIDTH / 2;
    state.shield.y = HEIGHT * 0.8;
  }

  function drawBackground() {
    context.clearRect(0, 0, WIDTH, HEIGHT);

    const background = context.createRadialGradient(CORE.x, CORE.y, 10, CORE.x, CORE.y, HEIGHT * 0.72);
    background.addColorStop(0, "rgba(124, 244, 199, 0.08)");
    background.addColorStop(0.5, "rgba(13, 23, 36, 0.24)");
    background.addColorStop(1, "rgba(3, 8, 14, 0.98)");
    context.fillStyle = background;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.strokeStyle = "rgba(124, 244, 199, 0.08)";
    context.lineWidth = 1;
    for (let index = 0; index < 6; index += 1) {
      const y = 42 + index * 56;
      context.beginPath();
      context.moveTo(24, y);
      context.lineTo(WIDTH - 24, y);
      context.stroke();
    }
  }

  function drawCore() {
    const coreGlow = context.createRadialGradient(CORE.x, CORE.y, 0, CORE.x, CORE.y, 58);
    coreGlow.addColorStop(0, "rgba(124, 244, 199, 0.9)");
    coreGlow.addColorStop(0.55, "rgba(124, 244, 199, 0.22)");
    coreGlow.addColorStop(1, "rgba(124, 244, 199, 0)");
    context.fillStyle = coreGlow;
    context.beginPath();
    context.arc(CORE.x, CORE.y, 58, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#caffed";
    context.beginPath();
    context.arc(CORE.x, CORE.y, CORE.radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(255, 211, 108, 0.72)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(CORE.x, CORE.y, CORE.radius + 11, 0, Math.PI * 2);
    context.stroke();
  }

  function drawShield() {
    const shieldGlow = context.createRadialGradient(state.shield.x, state.shield.y, 0, state.shield.x, state.shield.y, 48);
    shieldGlow.addColorStop(0, "rgba(255, 211, 108, 0.9)");
    shieldGlow.addColorStop(0.5, "rgba(255, 211, 108, 0.2)");
    shieldGlow.addColorStop(1, "rgba(255, 211, 108, 0)");
    context.fillStyle = shieldGlow;
    context.beginPath();
    context.arc(state.shield.x, state.shield.y, 48, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(255, 211, 108, 0.22)";
    context.beginPath();
    context.arc(state.shield.x, state.shield.y, SHIELD_RADIUS, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(255, 211, 108, 0.92)";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(state.shield.x, state.shield.y, SHIELD_RADIUS, 0, Math.PI * 2);
    context.stroke();
  }

  function drawThreats() {
    for (const threat of state.threats) {
      const glow = context.createRadialGradient(threat.x, threat.y, 0, threat.x, threat.y, 22);
      glow.addColorStop(0, "rgba(255, 123, 123, 1)");
      glow.addColorStop(0.6, "rgba(255, 123, 123, 0.28)");
      glow.addColorStop(1, "rgba(255, 123, 123, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(threat.x, threat.y, 22, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#ffdede";
      context.beginPath();
      context.arc(threat.x, threat.y, THREAT_RADIUS, 0, Math.PI * 2);
      context.fill();
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
      context.arc(flash.x, flash.y, flash.size + (1 - alpha) * 18, 0, Math.PI * 2);
      context.stroke();
      return true;
    });
  }

  function drawArena(delta) {
    drawBackground();
    drawCore();
    drawThreats();
    drawShield();
    drawFlashes(delta);
  }

  function spawnThreat() {
    const side = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;

    if (side === 0) {
      x = Math.random() * WIDTH;
      y = -18;
    } else if (side === 1) {
      x = WIDTH + 18;
      y = Math.random() * HEIGHT;
    } else if (side === 2) {
      x = Math.random() * WIDTH;
      y = HEIGHT + 18;
    } else {
      x = -18;
      y = Math.random() * HEIGHT;
    }

    const angle = Math.atan2(CORE.y - y, CORE.x - x);
    const speed = 70 + state.difficulty * 18 + Math.random() * 32;
    state.threats.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }

  function updateDifficulty() {
    state.difficulty = (TOTAL_TIME - state.timeLeft) / 10;
    state.spawnCooldown = Math.max(0.16, 0.52 - state.difficulty * 0.045);
  }

  function hitCore(threatIndex) {
    const threat = state.threats[threatIndex];
    addFlash(CORE.x, CORE.y, "rgba(255, 123, 123, ALPHA)", 18);
    state.threats.splice(threatIndex, 1);
    state.health -= 1;
    if (state.health > 0) {
      setMessage(`코어가 손상됐습니다. 남은 체력 ${state.health}.`);
    }
  }

  function blockThreat(threatIndex) {
    const threat = state.threats[threatIndex];
    addFlash(threat.x, threat.y, "rgba(124, 244, 199, ALPHA)", 16);
    state.threats.splice(threatIndex, 1);
    state.blocked += 1;
    if (state.blocked % 8 === 0) {
      setMessage("좋습니다. 위협 밀도가 올라갑니다.");
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
        "방어 성공",
        `45초를 버텼습니다. 총 ${state.blocked}개의 파편을 막아냈습니다.`,
        "다시 플레이"
      );
      setMessage("코어를 끝까지 지켜냈습니다.");
    } else {
      showOverlay(
        "코어 붕괴",
        `총 ${state.blocked}개를 막았지만 코어 체력이 모두 소진됐습니다. 더 일찍 경로를 막아보세요.`,
        "다시 시도"
      );
      setMessage("방패 위치가 늦었습니다.");
    }
  }

  function updateThreats(delta) {
    for (let index = state.threats.length - 1; index >= 0; index -= 1) {
      const threat = state.threats[index];
      threat.x += threat.vx * delta;
      threat.y += threat.vy * delta;

      if (distance(threat.x, threat.y, state.shield.x, state.shield.y) <= SHIELD_HIT_RADIUS + THREAT_RADIUS) {
        blockThreat(index);
        continue;
      }

      if (distance(threat.x, threat.y, CORE.x, CORE.y) <= CORE.radius + THREAT_RADIUS) {
        hitCore(index);
      }
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
    updateDifficulty();

    state.spawnTimer -= delta;
    if (state.spawnTimer <= 0) {
      spawnThreat();
      state.spawnTimer = state.spawnCooldown;
    }

    updateThreats(delta);
    updateHud();
    drawArena(delta);

    if (state.health <= 0) {
      endGame(false);
      return;
    }

    if (state.timeLeft <= 0) {
      endGame(true);
      return;
    }

    state.rafId = requestAnimationFrame(tick);
  }

  function updateShieldFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    state.shield.x = clamp((event.clientX - rect.left) * scaleX, SHIELD_RADIUS, WIDTH - SHIELD_RADIUS);
    state.shield.y = clamp((event.clientY - rect.top) * scaleY, SHIELD_RADIUS, HEIGHT - SHIELD_RADIUS);
  }

  function handlePointerDown(event) {
    if (!state.running) {
      return;
    }
    state.pointerActive = true;
    state.pointerId = event.pointerId;
    updateShieldFromEvent(event);
    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!state.running || !state.pointerActive || event.pointerId !== state.pointerId) {
      return;
    }
    updateShieldFromEvent(event);
  }

  function handlePointerUp(event) {
    if (event.pointerId !== state.pointerId) {
      return;
    }
    state.pointerActive = false;
    state.pointerId = null;
  }

  function resetGame() {
    state.running = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    state.health = START_HEALTH;
    state.timeLeft = TOTAL_TIME;
    state.blocked = 0;
    state.pointerActive = false;
    state.pointerId = null;
    state.spawnCooldown = 0.4;
    state.spawnTimer = 0.4;
    state.difficulty = 0;
    state.threats = [];
    state.flashes = [];
    state.lastTimestamp = 0;
    resetShieldPosition();
    updateHud();
    drawArena(0);
    showOverlay(
      "방어 시작",
      "화면 안에서 방패를 드래그해 움직이세요. 파편이 코어에 닿기 전에 막고, 45초 동안 코어 체력을 지키면 됩니다.",
      "시작"
    );
    setMessage("시작 후 손가락으로 방패를 끌어 위협을 막으세요.");
  }

  function startGame() {
    hideOverlay();
    state.running = true;
    state.lastTimestamp = 0;
    setMessage("파편이 들어옵니다. 방패를 움직여 막으세요.");
    state.rafId = requestAnimationFrame(tick);
  }

  overlayButtonEl.addEventListener("click", startGame);
  restartButtonEl.addEventListener("click", resetGame);
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);

  resetGame();
})();
