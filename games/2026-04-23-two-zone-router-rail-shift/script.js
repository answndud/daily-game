(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    round: document.getElementById("roundValue"),
    delivered: document.getElementById("deliveredValue"),
    target: document.getElementById("targetValue"),
    stability: document.getElementById("stabilityValue"),
    switch: document.getElementById("switchValue"),
    message: document.getElementById("messageLine"),
    overlay: document.getElementById("overlay"),
    overlayLabel: document.getElementById("overlayLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton"),
    leftButton: document.getElementById("leftButton"),
    rightButton: document.getElementById("rightButton")
  };

  const MAX_STABILITY = 3;
  const SIDES = {
    left: { label: "좌", short: "L", color: "#78a4b2" },
    right: { label: "우", short: "R", color: "#d09a5f" }
  };

  const view = {
    width: 0,
    height: 0,
    centerX: 0,
    startY: 0,
    switchY: 0,
    endY: 0,
    leftX: 0,
    rightX: 0
  };

  let state = createState();
  let lastTime = 0;
  let animationFrame = 0;
  let cargoId = 0;

  function createState() {
    return {
      phase: "idle",
      round: 1,
      target: getRoundTarget(1),
      delivered: 0,
      stability: MAX_STABILITY,
      activeSide: "left",
      cargoes: [],
      particles: [],
      spawnTimer: 0.5,
      transitionTimer: 0,
      switchFlash: 0,
      shake: 0,
      combo: 0
    };
  }

  function getRoundTarget(round) {
    return 10 + round * 2;
  }

  function getCargoSpeed(round) {
    return 122 + round * 12 + Math.random() * 16;
  }

  function getSpawnDelay(round) {
    return Math.max(0.42, 1.08 - round * 0.055) * (0.84 + Math.random() * 0.34);
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
    view.startY = 52;
    view.switchY = rect.height * 0.52;
    view.endY = rect.height - 70;
    view.leftX = Math.max(64, rect.width * 0.24);
    view.rightX = Math.min(rect.width - 64, rect.width * 0.76);
  }

  function startRun() {
    state = createState();
    cargoId = 0;
    startRound(1);
    hideOverlay();
    ensureLoop();
  }

  function startRound(round) {
    state.phase = "running";
    state.round = round;
    state.target = getRoundTarget(round);
    state.delivered = 0;
    state.stability = MAX_STABILITY;
    state.activeSide = round % 2 === 0 ? "right" : "left";
    state.cargoes = [];
    state.particles = [];
    state.spawnTimer = 0.28;
    state.transitionTimer = 0;
    state.switchFlash = 0;
    state.shake = 0;
    state.combo = 0;
    setMessage(`라운드 ${round}: 화물 ${state.target}개를 맞는 목적지로 보내세요.`);
    updateHud();
  }

  function clearRound() {
    state.phase = "cleared";
    state.transitionTimer = 0.64;
    state.cargoes = [];
    emitParticles(view.centerX, view.switchY, 24, "#d7b17a");
    setMessage(`라운드 ${state.round} 배송 완료. 다음 라운드는 더 빠릅니다.`);
    updateHud();
  }

  function failRun() {
    state.phase = "failed";
    state.round = 1;
    state.target = getRoundTarget(1);
    state.delivered = 0;
    state.stability = 0;
    state.combo = 0;
    state.cargoes = [];
    state.shake = 1;
    setMessage("레일 허브가 정지했습니다. 다음 시도는 라운드 1에서 시작합니다.");
    updateHud();
    showOverlay(
      "Run Reset",
      "라운드 1로 복귀",
      "오배송이 세 번 누적되면 진행도가 초기화됩니다. 분기점 전에 좌우 레일을 미리 맞추세요.",
      "라운드 1 다시 시작"
    );
  }

  function setActiveSide(side) {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
    }
    if (side !== "left" && side !== "right") {
      return;
    }
    if (state.phase === "running") {
      state.activeSide = side;
      state.switchFlash = 1;
      setMessage(`${SIDES[side].label}측 레일로 스위치했습니다.`);
      updateHud();
    }
  }

  function spawnCargo() {
    const side = Math.random() < 0.5 ? "left" : "right";
    state.cargoes.push({
      id: cargoId,
      target: side,
      stage: "incoming",
      y: view.startY - 22,
      t: 0,
      route: null,
      speed: getCargoSpeed(state.round),
      wobble: Math.random() * Math.PI * 2,
      size: 15
    });
    cargoId += 1;
  }

  function update(delta) {
    state.switchFlash = Math.max(0, state.switchFlash - delta * 3.5);
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

    state.spawnTimer -= delta;
    const maxActive = Math.min(7, 3 + Math.ceil(state.round / 2));
    if (state.spawnTimer <= 0 && state.cargoes.length < maxActive) {
      spawnCargo();
      state.spawnTimer = getSpawnDelay(state.round);
    }

    for (const cargo of state.cargoes) {
      cargo.wobble += delta * 4.5;
      if (cargo.stage === "incoming") {
        cargo.y += cargo.speed * delta;
        if (cargo.y >= view.switchY) {
          cargo.stage = "branch";
          cargo.route = state.activeSide;
          cargo.t = 0;
        }
      } else {
        const branchDistance = Math.hypot(getRouteX(cargo.route) - view.centerX, view.endY - view.switchY);
        cargo.t += (cargo.speed * delta) / Math.max(1, branchDistance);
      }
    }

    for (let index = state.cargoes.length - 1; index >= 0; index -= 1) {
      const cargo = state.cargoes[index];
      if (cargo.stage === "branch" && cargo.t >= 1) {
        state.cargoes.splice(index, 1);
        deliverCargo(cargo);
      }
    }

    updateParticles(delta);
    updateHud();
  }

  function deliverCargo(cargo) {
    const point = getCargoPoint(cargo);
    const correct = cargo.route === cargo.target;
    if (correct) {
      state.delivered += 1;
      state.combo += 1;
      emitParticles(point.x, point.y, 14 + Math.min(10, state.combo), SIDES[cargo.target].color);
      setMessage(`정확한 배송. ${state.target - state.delivered}개 남았습니다.`);
      if (state.delivered >= state.target) {
        clearRound();
      }
      return;
    }

    state.combo = 0;
    state.stability -= 1;
    state.shake = 1;
    emitParticles(point.x, point.y, 16, "#b76555");
    setMessage(`오배송. 내구도 ${Math.max(0, state.stability)} 남음.`);
    if (state.stability <= 0) {
      failRun();
    }
  }

  function getRouteX(side) {
    return side === "left" ? view.leftX : view.rightX;
  }

  function getCargoPoint(cargo) {
    if (cargo.stage === "incoming") {
      return {
        x: view.centerX + Math.sin(cargo.wobble) * 2,
        y: cargo.y
      };
    }
    const t = easeInOut(Math.min(1, cargo.t));
    return {
      x: lerp(view.centerX, getRouteX(cargo.route), t),
      y: lerp(view.switchY, view.endY, t)
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    return t * t * (3 - 2 * t);
  }

  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    drawBackdrop();
    drawRails();
    drawBins();
    drawCargoes();
    drawParticles();
    drawSwitch();
  }

  function drawBackdrop() {
    const offset = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 7 : 0;
    ctx.save();
    ctx.translate(offset, 0);
    const gradient = ctx.createLinearGradient(0, 0, view.width, view.height);
    gradient.addColorStop(0, "#26241f");
    gradient.addColorStop(0.56, "#1b1a17");
    gradient.addColorStop(1, "#12110f");
    ctx.fillStyle = gradient;
    ctx.fillRect(-12, 0, view.width + 24, view.height);

    ctx.strokeStyle = "rgba(255, 254, 250, 0.06)";
    ctx.lineWidth = 1;
    for (let y = 48; y < view.height; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(view.width, y + 20);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRails() {
    const activeX = getRouteX(state.activeSide);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(255, 254, 250, 0.18)";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(view.centerX, view.startY);
    ctx.lineTo(view.centerX, view.switchY);
    ctx.lineTo(view.leftX, view.endY);
    ctx.moveTo(view.centerX, view.switchY);
    ctx.lineTo(view.rightX, view.endY);
    ctx.stroke();

    ctx.strokeStyle = state.activeSide === "left" ? "rgba(120, 164, 178, 0.9)" : "rgba(208, 154, 95, 0.9)";
    ctx.lineWidth = 5 + state.switchFlash * 4;
    ctx.beginPath();
    ctx.moveTo(view.centerX, view.startY);
    ctx.lineTo(view.centerX, view.switchY);
    ctx.lineTo(activeX, view.endY);
    ctx.stroke();

    ctx.setLineDash([8, 10]);
    ctx.lineDashOffset = -performance.now() * 0.04;
    ctx.strokeStyle = "rgba(255, 254, 250, 0.26)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(view.centerX, view.startY);
    ctx.lineTo(view.centerX, view.switchY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawSwitch() {
    ctx.save();
    ctx.translate(view.centerX, view.switchY);
    ctx.fillStyle = "#f6efe1";
    ctx.beginPath();
    ctx.arc(0, 0, 18 + state.switchFlash * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24221f";
    ctx.font = "800 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(SIDES[state.activeSide].short, 0, 1);
    ctx.restore();
  }

  function drawBins() {
    drawBin(view.leftX, view.endY, "left");
    drawBin(view.rightX, view.endY, "right");
  }

  function drawBin(x, y, side) {
    const color = side === "left" ? "#78a4b2" : "#d09a5f";
    ctx.save();
    ctx.fillStyle = "rgba(255, 254, 250, 0.08)";
    roundRect(x - 52, y - 8, 104, 42, 12);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 254, 250, 0.8)";
    ctx.font = "800 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(SIDES[side].short, x, y + 13);
    ctx.restore();
  }

  function drawCargoes() {
    for (const cargo of state.cargoes) {
      const point = getCargoPoint(cargo);
      const target = SIDES[cargo.target];
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.fillStyle = target.color;
      ctx.strokeStyle = "rgba(255, 254, 250, 0.72)";
      ctx.lineWidth = 2;
      roundRect(-18, -16, 36, 32, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#171614";
      ctx.font = "900 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(target.short, 0, 1);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life * 2.2);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function emitParticles(x, y, count, color) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 36 + Math.random() * 92;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.42,
        color
      });
    }
  }

  function updateParticles(delta) {
    for (const particle of state.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 20 * delta;
      particle.life -= delta;
      particle.size *= 0.985;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function updateHud() {
    ui.round.textContent = String(state.round);
    ui.delivered.textContent = String(state.delivered);
    ui.target.textContent = String(state.target);
    ui.stability.textContent = String(Math.max(0, state.stability));
    ui.switch.textContent = SIDES[state.activeSide].label;
    ui.leftButton.classList.toggle("active", state.activeSide === "left");
    ui.rightButton.classList.toggle("active", state.activeSide === "right");
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

  function chooseByPoint(clientX) {
    const rect = canvas.getBoundingClientRect();
    const side = clientX - rect.left < rect.width / 2 ? "left" : "right";
    setActiveSide(side);
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    chooseByPoint(event.clientX);
  });

  ui.leftButton.addEventListener("click", () => setActiveSide("left"));
  ui.rightButton.addEventListener("click", () => setActiveSide("right"));
  ui.startButton.addEventListener("click", startRun);
  ui.resetButton.addEventListener("click", startRun);

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      setActiveSide("left");
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      setActiveSide("right");
    }
    if (event.key.toLowerCase() === "r") {
      startRun();
    }
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      if (state.phase === "idle" || state.phase === "failed") {
        startRun();
      }
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
