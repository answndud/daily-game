(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    round: document.getElementById("roundValue"),
    progress: document.getElementById("progressValue"),
    stability: document.getElementById("stabilityValue"),
    pressure: document.getElementById("pressureValue"),
    band: document.getElementById("bandValue"),
    fill: document.getElementById("progressFill"),
    message: document.getElementById("messageLine"),
    overlay: document.getElementById("overlay"),
    overlayLabel: document.getElementById("overlayLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton")
  };

  const MAX_STABILITY = 3;
  const DAMAGE_GRACE = 0.95;

  const view = {
    width: 0,
    height: 0,
    gaugeX: 0,
    gaugeTop: 0,
    gaugeBottom: 0,
    gaugeWidth: 0,
    centerX: 0
  };

  let state = createState();
  let lastTime = 0;
  let animationFrame = 0;

  function createState() {
    return {
      phase: "idle",
      round: 1,
      pressure: 52,
      targetTime: getTargetTime(1),
      stableTime: 0,
      stability: MAX_STABILITY,
      holding: false,
      bandCenter: 50,
      bandWidth: getBandWidth(1),
      outsideTimer: 0,
      transitionTimer: 0,
      clock: 0,
      shake: 0,
      particles: [],
      lastInside: true
    };
  }

  function getTargetTime(round) {
    return 11 + round * 2;
  }

  function getBandWidth(round) {
    return Math.max(17, 38 - round * 2.2);
  }

  function getRiseSpeed(round) {
    return 12.5 + round * 2.1;
  }

  function getVentSpeed(round) {
    return 23 + round * 2.6;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    view.width = rect.width;
    view.height = rect.height;
    view.centerX = rect.width / 2;
    view.gaugeWidth = Math.min(168, rect.width * 0.34);
    view.gaugeX = view.centerX - view.gaugeWidth / 2;
    view.gaugeTop = 56;
    view.gaugeBottom = rect.height - 76;
  }

  function startRun() {
    state = createState();
    startRound(1);
    hideOverlay();
    ensureLoop();
  }

  function startRound(round) {
    state.phase = "running";
    state.round = round;
    state.pressure = 48 + Math.min(8, round);
    state.targetTime = getTargetTime(round);
    state.stableTime = 0;
    state.stability = MAX_STABILITY;
    state.holding = false;
    state.bandCenter = 50;
    state.bandWidth = getBandWidth(round);
    state.outsideTimer = 0;
    state.transitionTimer = 0;
    state.clock = 0;
    state.shake = 0;
    state.particles = [];
    state.lastInside = true;
    setMessage(`라운드 ${round}: 압력을 안전 구간에 ${state.targetTime.toFixed(0)}초 유지하세요.`);
    updateHud();
  }

  function clearRound() {
    state.phase = "cleared";
    state.transitionTimer = 0.62;
    state.holding = false;
    state.outsideTimer = 0;
    emitParticles(view.centerX, pressureToY(state.pressure), 22, "#d9b37a");
    setMessage(`라운드 ${state.round} 안정화 완료. 다음 라운드는 더 좁고 빠릅니다.`);
    updateHud();
  }

  function failRun() {
    state.phase = "failed";
    state.round = 1;
    state.targetTime = getTargetTime(1);
    state.stableTime = 0;
    state.stability = 0;
    state.holding = false;
    state.outsideTimer = 0;
    state.shake = 1;
    setMessage("압력 코어가 손상됐습니다. 다음 시도는 라운드 1에서 시작합니다.");
    updateHud();
    showOverlay(
      "Run Reset",
      "라운드 1로 복귀",
      "안전 구간 밖에 오래 머물면 내구도가 떨어집니다. 다시 시작하면 라운드 1부터 진행합니다.",
      "라운드 1 다시 시작"
    );
  }

  function setHolding(holding) {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
    }
    if (state.phase === "running") {
      state.holding = holding;
      setMessage(holding ? "밸브 개방: 압력이 내려갑니다." : "밸브 닫힘: 압력이 차오릅니다.");
    }
  }

  function update(delta) {
    state.shake = Math.max(0, state.shake - delta * 2.8);

    if (state.phase === "cleared") {
      state.transitionTimer -= delta;
      updateParticles(delta);
      if (state.transitionTimer <= 0) {
        startRound(state.round + 1);
      }
      return;
    }

    if (state.phase !== "running") {
      updateParticles(delta);
      return;
    }

    state.clock += delta;
    state.bandWidth = getBandWidth(state.round);
    const swing = Math.min(21, 7 + state.round * 1.15);
    const bandSpeed = 0.62 + state.round * 0.045;
    state.bandCenter = 50 + Math.sin(state.clock * bandSpeed) * swing;

    const turbulence = Math.sin(state.clock * (1.9 + state.round * 0.08)) * (2.4 + state.round * 0.28);
    const pressureDelta = state.holding ? -getVentSpeed(state.round) : getRiseSpeed(state.round);
    state.pressure += (pressureDelta + turbulence) * delta;
    state.pressure = Math.max(0, Math.min(100, state.pressure));

    const inside = isInsideBand();
    if (inside) {
      state.stableTime += delta;
      state.outsideTimer = Math.max(0, state.outsideTimer - delta * 2.4);
      if (!state.lastInside) {
        emitParticles(view.centerX, pressureToY(state.pressure), 8, "#8fa281");
        setMessage("안전 구간 복귀. 안정화 시간이 다시 쌓입니다.");
      }
    } else {
      state.outsideTimer += delta;
      if (state.outsideTimer >= DAMAGE_GRACE) {
        state.stability -= 1;
        state.outsideTimer = 0;
        state.shake = 1;
        emitParticles(view.centerX, pressureToY(state.pressure), 12, "#b76555");
        setMessage(`안전 구간 이탈. 내구도 ${Math.max(0, state.stability)} 남음.`);
        if (state.stability <= 0) {
          failRun();
          return;
        }
      }
    }
    state.lastInside = inside;

    if (state.stableTime >= state.targetTime) {
      clearRound();
    }

    updateParticles(delta);
    updateHud();
  }

  function isInsideBand() {
    const half = state.bandWidth / 2;
    return state.pressure >= state.bandCenter - half && state.pressure <= state.bandCenter + half;
  }

  function pressureToY(pressure) {
    const range = view.gaugeBottom - view.gaugeTop;
    return view.gaugeBottom - (pressure / 100) * range;
  }

  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    drawBackdrop();
    drawGauge();
    drawParticles();
    drawReadout();
  }

  function drawBackdrop() {
    const offset = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 8 : 0;
    ctx.save();
    ctx.translate(offset, 0);
    const gradient = ctx.createLinearGradient(0, 0, view.width, view.height);
    gradient.addColorStop(0, "#26231f");
    gradient.addColorStop(0.54, "#1b1a17");
    gradient.addColorStop(1, "#12110f");
    ctx.fillStyle = gradient;
    ctx.fillRect(-12, 0, view.width + 24, view.height);

    ctx.strokeStyle = "rgba(255, 253, 248, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 32; x < view.width; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 42, view.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGauge() {
    const halfBand = state.bandWidth / 2;
    const bandTop = pressureToY(state.bandCenter + halfBand);
    const bandBottom = pressureToY(state.bandCenter - halfBand);
    const pressureY = pressureToY(state.pressure);
    const gaugeRight = view.gaugeX + view.gaugeWidth;
    const inside = isInsideBand();

    ctx.save();
    ctx.fillStyle = "rgba(255, 253, 248, 0.08)";
    roundRect(view.gaugeX, view.gaugeTop, view.gaugeWidth, view.gaugeBottom - view.gaugeTop, 22);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 253, 248, 0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = inside ? "rgba(137, 158, 126, 0.48)" : "rgba(199, 123, 62, 0.38)";
    roundRect(view.gaugeX + 8, bandTop, view.gaugeWidth - 16, bandBottom - bandTop, 16);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 253, 248, 0.16)";
    ctx.lineWidth = 1;
    for (let index = 0; index <= 10; index += 1) {
      const y = view.gaugeBottom - ((view.gaugeBottom - view.gaugeTop) * index) / 10;
      ctx.beginPath();
      ctx.moveTo(view.gaugeX - 12, y);
      ctx.lineTo(gaugeRight + 12, y);
      ctx.stroke();
    }

    const fillGradient = ctx.createLinearGradient(0, pressureY, 0, view.gaugeBottom);
    fillGradient.addColorStop(0, inside ? "#b9c29d" : "#dfae76");
    fillGradient.addColorStop(1, state.holding ? "#607f90" : "#c77b3e");
    ctx.fillStyle = fillGradient;
    roundRect(view.gaugeX + 22, pressureY, view.gaugeWidth - 44, view.gaugeBottom - pressureY, 14);
    ctx.fill();

    ctx.strokeStyle = inside ? "#e8ddc7" : "#f0b18c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(view.gaugeX - 24, pressureY);
    ctx.lineTo(gaugeRight + 24, pressureY);
    ctx.stroke();

    ctx.fillStyle = inside ? "#f2ead8" : "#f0b18c";
    ctx.beginPath();
    ctx.arc(view.centerX, pressureY, inside ? 9 : 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 253, 248, 0.7)";
    ctx.font = "700 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SAFE", view.centerX, bandTop + Math.max(16, (bandBottom - bandTop) / 2));

    ctx.restore();
  }

  function drawReadout() {
    const inside = isInsideBand();
    ctx.save();
    ctx.fillStyle = "rgba(255, 253, 248, 0.82)";
    ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.holding ? "VENTING" : "FILLING", view.centerX, 30);

    ctx.fillStyle = inside ? "rgba(185, 194, 157, 0.94)" : "rgba(240, 177, 140, 0.94)";
    ctx.font = "700 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(inside ? "STABLE" : "DRIFT", view.centerX, view.height - 32);
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life * 2.1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function roundRect(x, y, width, height, radius) {
    const safeHeight = Math.max(0, height);
    const r = Math.min(radius, width / 2, safeHeight / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + safeHeight - r);
    ctx.quadraticCurveTo(x + width, y + safeHeight, x + width - r, y + safeHeight);
    ctx.lineTo(x + r, y + safeHeight);
    ctx.quadraticCurveTo(x, y + safeHeight, x, y + safeHeight - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function emitParticles(x, y, count, color) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 34 + Math.random() * 92;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.45,
        color
      });
    }
  }

  function updateParticles(delta) {
    for (const particle of state.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 22 * delta;
      particle.life -= delta;
      particle.size *= 0.985;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function updateHud() {
    ui.round.textContent = String(state.round);
    ui.progress.textContent = state.stableTime.toFixed(1);
    ui.stability.textContent = String(Math.max(0, state.stability));
    ui.pressure.textContent = String(Math.round(state.pressure));
    ui.fill.style.width = `${Math.min(100, (state.stableTime / state.targetTime) * 100)}%`;
    if (state.bandWidth >= 31) {
      ui.band.textContent = "넓음";
    } else if (state.bandWidth >= 23) {
      ui.band.textContent = "보통";
    } else {
      ui.band.textContent = "좁음";
    }
  }

  function setMessage(text) {
    ui.message.textContent = text;
  }

  function showOverlay(label, title, text, buttonText) {
    ui.overlayLabel.textContent = label;
    ui.overlayTitle.textContent = title;
    ui.overlayText.textContent = text;
    ui.startButton.textContent = buttonText;
    ui.overlay.hidden = false;
  }

  function hideOverlay() {
    ui.overlay.hidden = true;
  }

  function ensureLoop() {
    if (!animationFrame) {
      lastTime = performance.now();
      animationFrame = requestAnimationFrame(loop);
    }
  }

  function loop(timestamp) {
    const delta = Math.min(0.04, (timestamp - lastTime) / 1000 || 0);
    lastTime = timestamp;
    update(delta);
    draw();
    animationFrame = requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setHolding(true);
  });

  window.addEventListener("pointerup", () => {
    if (state.phase === "running") {
      state.holding = false;
    }
  });

  window.addEventListener("pointercancel", () => {
    if (state.phase === "running") {
      state.holding = false;
    }
  });

  ui.startButton.addEventListener("click", startRun);
  ui.resetButton.addEventListener("click", startRun);

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      if (!event.repeat) {
        setHolding(true);
      }
    }
    if (event.key.toLowerCase() === "r") {
      startRun();
    }
  });

  window.addEventListener("keyup", (event) => {
    if ((event.code === "Space" || event.code === "Enter") && state.phase === "running") {
      state.holding = false;
    }
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    draw();
  });

  resizeCanvas();
  updateHud();
  draw();
})();
