(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    round: document.getElementById("roundValue"),
    shot: document.getElementById("shotValue"),
    limit: document.getElementById("limitValue"),
    core: document.getElementById("coreValue"),
    target: document.getElementById("targetValue"),
    speed: document.getElementById("speedValue"),
    message: document.getElementById("messageLine"),
    overlay: document.getElementById("overlay"),
    overlayLabel: document.getElementById("overlayLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton")
  };

  const PUCK_RADIUS = 12;
  const CORE_RADIUS = 12;
  const HAZARD_RADIUS = 15;
  const EXIT_RADIUS = 24;

  const view = {
    width: 0,
    height: 0,
    pad: 28
  };

  let state = createState();
  let lastTime = 0;
  let animationFrame = 0;

  function createState() {
    return {
      phase: "idle",
      round: 1,
      shots: 0,
      shotLimit: getShotLimit(1),
      puck: { x: 0, y: 0, vx: 0, vy: 0 },
      start: { x: 0, y: 0 },
      drag: null,
      cores: [],
      hazards: [],
      exit: { x: 0, y: 0, open: false },
      particles: [],
      pulse: 0,
      collected: 0,
      target: getCoreCount(1),
      messageCooldown: 0
    };
  }

  function getCoreCount(round) {
    return Math.min(6, 2 + Math.ceil(round / 2));
  }

  function getShotLimit(round) {
    return Math.max(4, 6 - Math.floor(round / 3));
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.width = rect.width;
    view.height = rect.height;
    view.pad = Math.max(24, Math.min(rect.width, rect.height) * 0.07);
    if (state.phase === "idle") {
      placeIdlePuck();
    }
    draw();
  }

  function placeIdlePuck() {
    state.start.x = view.width * 0.5;
    state.start.y = view.height - view.pad - 28;
    state.puck.x = state.start.x;
    state.puck.y = state.start.y;
  }

  function startRun() {
    startRound(1);
    hideOverlay();
    ensureLoop();
  }

  function startRound(round) {
    state.phase = "aiming";
    state.round = round;
    state.shots = 0;
    state.shotLimit = getShotLimit(round);
    state.target = getCoreCount(round);
    state.collected = 0;
    state.drag = null;
    state.particles = [];
    state.messageCooldown = 0;
    state.start = { x: view.width * 0.5, y: view.height - view.pad - 30 };
    state.puck = { x: state.start.x, y: state.start.y, vx: 0, vy: 0 };
    state.cores = makeCores(round);
    state.hazards = makeHazards(round);
    state.exit = { x: view.width * 0.5, y: view.pad + 28, open: false };
    setMessage(`라운드 ${round}: 코어 ${state.target}개를 모은 뒤 출구로 들어가세요.`);
    updateHud();
  }

  function makeCores(round) {
    const count = getCoreCount(round);
    const cores = [];
    for (let index = 0; index < count; index += 1) {
      const angle = (-Math.PI / 2) + (index - (count - 1) / 2) * 0.58;
      const radius = Math.min(view.width, view.height) * (0.24 + (index % 2) * 0.1);
      const baseX = view.width / 2 + Math.cos(angle) * radius;
      const baseY = view.height * 0.46 + Math.sin(angle) * radius * 0.5;
      cores.push({
        x: clamp(baseX, view.pad + 28, view.width - view.pad - 28),
        y: clamp(baseY, view.pad + 74, view.height - view.pad - 128),
        collected: false,
        phase: Math.random() * Math.PI * 2
      });
    }
    return cores;
  }

  function makeHazards(round) {
    const count = Math.min(5, Math.floor((round + 1) / 2));
    const hazards = [];
    for (let index = 0; index < count; index += 1) {
      const lane = (index + 1) / (count + 1);
      hazards.push({
        x: lerp(view.pad + 48, view.width - view.pad - 48, lane),
        y: view.height * (0.36 + (index % 3) * 0.14),
        drift: 18 + round * 2,
        phase: index * 1.7 + round,
        speed: 0.8 + index * 0.12
      });
    }
    return hazards;
  }

  function launchFromDrag(point) {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
      return;
    }
    if (state.phase !== "aiming") {
      return;
    }
    const dx = state.puck.x - point.x;
    const dy = state.puck.y - point.y;
    const length = Math.hypot(dx, dy);
    if (length < 18) {
      state.drag = null;
      setMessage("조금 더 당겨야 발사됩니다.");
      return;
    }
    const power = Math.min(520, length * 6.2);
    state.puck.vx = (dx / length) * power;
    state.puck.vy = (dy / length) * power;
    state.shots += 1;
    state.phase = "moving";
    state.drag = null;
    setMessage("반사 경로를 지켜보세요.");
    updateHud();
  }

  function update(delta) {
    state.pulse += delta;
    state.messageCooldown = Math.max(0, state.messageCooldown - delta);
    updateHazards(delta);
    updateParticles(delta);

    if (state.phase !== "moving") {
      return;
    }

    const puck = state.puck;
    puck.x += puck.vx * delta;
    puck.y += puck.vy * delta;
    puck.vx *= Math.pow(0.986, delta * 60);
    puck.vy *= Math.pow(0.986, delta * 60);

    bounceWalls();
    checkCoreCollisions();
    checkHazardCollisions();
    checkExit();

    if (speed() < 18 && state.phase === "moving") {
      puck.vx = 0;
      puck.vy = 0;
      if (state.shots >= state.shotLimit && !state.exit.open) {
        failRun("발사 횟수를 모두 썼습니다.");
      } else {
        state.phase = "aiming";
        setMessage(state.exit.open ? "출구가 열렸습니다. 다음 발사로 출구에 닿으세요." : "다음 반사각을 조준하세요.");
      }
    }
    updateHud();
  }

  function updateHazards(delta) {
    for (const hazard of state.hazards) {
      hazard.phase += delta * hazard.speed;
    }
  }

  function bounceWalls() {
    const puck = state.puck;
    let bounced = false;
    if (puck.x < view.pad + PUCK_RADIUS) {
      puck.x = view.pad + PUCK_RADIUS;
      puck.vx = Math.abs(puck.vx);
      bounced = true;
    }
    if (puck.x > view.width - view.pad - PUCK_RADIUS) {
      puck.x = view.width - view.pad - PUCK_RADIUS;
      puck.vx = -Math.abs(puck.vx);
      bounced = true;
    }
    if (puck.y < view.pad + PUCK_RADIUS) {
      puck.y = view.pad + PUCK_RADIUS;
      puck.vy = Math.abs(puck.vy);
      bounced = true;
    }
    if (puck.y > view.height - view.pad - PUCK_RADIUS) {
      puck.y = view.height - view.pad - PUCK_RADIUS;
      puck.vy = -Math.abs(puck.vy);
      bounced = true;
    }
    if (bounced) {
      emitParticles(puck.x, puck.y, 7, "#4d92a0");
    }
  }

  function checkCoreCollisions() {
    for (const core of state.cores) {
      if (core.collected) {
        continue;
      }
      if (distance(state.puck.x, state.puck.y, core.x, core.y) < PUCK_RADIUS + CORE_RADIUS + 3) {
        core.collected = true;
        state.collected += 1;
        emitParticles(core.x, core.y, 18, "#7b966d");
        if (state.collected >= state.target) {
          state.exit.open = true;
          emitParticles(state.exit.x, state.exit.y, 24, "#c4934d");
          setMessage("모든 코어를 회수했습니다. 출구가 열렸습니다.");
        } else {
          setMessage(`${state.target - state.collected}개 남았습니다.`);
        }
      }
    }
  }

  function checkHazardCollisions() {
    for (const hazard of state.hazards) {
      const point = hazardPoint(hazard);
      if (distance(state.puck.x, state.puck.y, point.x, point.y) < PUCK_RADIUS + HAZARD_RADIUS) {
        failRun("위험 핀에 충돌했습니다.");
        return;
      }
    }
  }

  function checkExit() {
    if (!state.exit.open) {
      return;
    }
    if (distance(state.puck.x, state.puck.y, state.exit.x, state.exit.y) < PUCK_RADIUS + EXIT_RADIUS) {
      clearRound();
    }
  }

  function clearRound() {
    state.phase = "cleared";
    state.puck.vx = 0;
    state.puck.vy = 0;
    emitParticles(state.exit.x, state.exit.y, 34, "#c4934d");
    setMessage(`라운드 ${state.round} 클리어. 다음 라운드는 목표와 위험 핀이 늘어납니다.`);
    updateHud();
    window.setTimeout(() => {
      if (state.phase === "cleared") {
        startRound(state.round + 1);
      }
    }, 760);
  }

  function failRun(reason) {
    state.phase = "failed";
    state.puck.vx = 0;
    state.puck.vy = 0;
    setMessage(`${reason} 다음 시도는 라운드 1부터 시작합니다.`);
    updateHud();
    showOverlay(
      "Run Reset",
      "라운드 1로 복귀",
      "힘을 크게 주기보다 벽을 한 번만 이용하는 각도를 먼저 잡으세요. 코어를 모두 모은 뒤에는 출구만 노리면 됩니다.",
      "라운드 1 다시 시작"
    );
  }

  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    drawBackground();
    drawArena();
    drawExit();
    drawCores();
    drawHazards();
    drawAim();
    drawParticles();
    drawPuck();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, view.width, view.height);
    gradient.addColorStop(0, "#252823");
    gradient.addColorStop(0.58, "#191b18");
    gradient.addColorStop(1, "#10120f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);
  }

  function drawArena() {
    ctx.save();
    ctx.strokeStyle = "rgba(252, 252, 248, 0.2)";
    ctx.lineWidth = 2;
    roundRect(view.pad, view.pad, view.width - view.pad * 2, view.height - view.pad * 2, 18);
    ctx.stroke();

    ctx.strokeStyle = "rgba(252, 252, 248, 0.07)";
    ctx.lineWidth = 1;
    for (let y = view.pad + 34; y < view.height - view.pad; y += 34) {
      ctx.beginPath();
      ctx.moveTo(view.pad, y);
      ctx.lineTo(view.width - view.pad, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawExit() {
    const pulse = Math.sin(state.pulse * 5) * 0.5 + 0.5;
    ctx.save();
    ctx.globalAlpha = state.exit.open ? 1 : 0.36;
    ctx.strokeStyle = state.exit.open ? "#c4934d" : "rgba(252, 252, 248, 0.42)";
    ctx.lineWidth = 3 + pulse * 2;
    ctx.beginPath();
    ctx.arc(state.exit.x, state.exit.y, EXIT_RADIUS + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(252, 252, 248, 0.82)";
    ctx.font = "800 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.exit.open ? "EXIT" : "LOCK", state.exit.x, state.exit.y + 1);
    ctx.restore();
  }

  function drawCores() {
    for (const core of state.cores) {
      if (core.collected) {
        continue;
      }
      const pulse = Math.sin(state.pulse * 4 + core.phase) * 0.5 + 0.5;
      ctx.save();
      ctx.strokeStyle = "rgba(123, 150, 109, 0.58)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(core.x, core.y, CORE_RADIUS + 8 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#7b966d";
      ctx.strokeStyle = "rgba(252, 252, 248, 0.74)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(core.x, core.y, CORE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawHazards() {
    for (const hazard of state.hazards) {
      const point = hazardPoint(hazard);
      ctx.save();
      ctx.strokeStyle = "rgba(180, 94, 105, 0.36)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hazard.x, hazard.y, hazard.drift, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#b45e69";
      ctx.strokeStyle = "rgba(252, 252, 248, 0.66)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, HAZARD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAim() {
    if (!state.drag || state.phase !== "aiming") {
      return;
    }
    const dx = state.puck.x - state.drag.x;
    const dy = state.puck.y - state.drag.y;
    const length = Math.hypot(dx, dy);
    const scale = Math.min(90, length * 0.55);
    const nx = dx / (length || 1);
    const ny = dy / (length || 1);
    ctx.save();
    ctx.strokeStyle = "rgba(252, 252, 248, 0.62)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(state.puck.x, state.puck.y);
    ctx.lineTo(state.puck.x + nx * scale, state.puck.y + ny * scale);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(77, 146, 160, 0.25)";
    ctx.beginPath();
    ctx.arc(state.drag.x, state.drag.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPuck() {
    ctx.save();
    const glow = ctx.createRadialGradient(state.puck.x, state.puck.y, 2, state.puck.x, state.puck.y, 38);
    glow.addColorStop(0, "rgba(252, 252, 248, 0.94)");
    glow.addColorStop(0.4, "rgba(77, 146, 160, 0.58)");
    glow.addColorStop(1, "rgba(77, 146, 160, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(state.puck.x, state.puck.y, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fcfcf8";
    ctx.strokeStyle = "#4d92a0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.puck.x, state.puck.y, PUCK_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function emitParticles(x, y, count, color) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const particleSpeed = 28 + Math.random() * 90;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * particleSpeed,
        vy: Math.sin(angle) * particleSpeed,
        size: 2 + Math.random() * 4,
        life: 0.32 + Math.random() * 0.4,
        color
      });
    }
  }

  function updateParticles(delta) {
    for (const particle of state.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= Math.pow(0.96, delta * 60);
      particle.vy *= Math.pow(0.96, delta * 60);
      particle.life -= delta;
      particle.size *= 0.985;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life * 2);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function hazardPoint(hazard) {
    return {
      x: hazard.x + Math.cos(hazard.phase) * hazard.drift,
      y: hazard.y + Math.sin(hazard.phase * 0.87) * hazard.drift * 0.62
    };
  }

  function speed() {
    return Math.hypot(state.puck.vx, state.puck.vy);
  }

  function updateHud() {
    ui.round.textContent = String(state.round);
    ui.shot.textContent = String(state.shots);
    ui.limit.textContent = String(state.shotLimit);
    ui.core.textContent = String(state.collected);
    ui.target.textContent = String(state.target);
    ui.speed.textContent = String(Math.round(speed()));
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

  function setMessage(text) {
    if (state.messageCooldown > 0 && state.phase === "moving") {
      return;
    }
    ui.message.textContent = text;
    state.messageCooldown = 0.28;
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function pointerPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
    }
    if (state.phase === "aiming") {
      state.drag = pointerPoint(event);
      canvas.setPointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (state.phase === "aiming" && state.drag) {
      event.preventDefault();
      state.drag = pointerPoint(event);
    }
  });

  canvas.addEventListener("pointerup", (event) => {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (state.phase === "aiming" && state.drag) {
      launchFromDrag(pointerPoint(event));
    }
  });

  canvas.addEventListener("pointercancel", (event) => {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    state.drag = null;
  });

  ui.startButton.addEventListener("click", startRun);
  ui.resetButton.addEventListener("click", startRun);

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      startRun();
    }
    if (event.code === "Space" || event.code === "Enter") {
      if (state.phase === "idle" || state.phase === "failed") {
        event.preventDefault();
        startRun();
      }
    }
  });

  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  updateHud();
  draw();
})();
