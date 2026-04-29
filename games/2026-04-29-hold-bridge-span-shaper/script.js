(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    round: document.getElementById("roundValue"),
    span: document.getElementById("spanValue"),
    target: document.getElementById("targetValue"),
    length: document.getElementById("lengthValue"),
    perfect: document.getElementById("perfectValue"),
    message: document.getElementById("messageLine"),
    overlay: document.getElementById("overlay"),
    overlayLabel: document.getElementById("overlayLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton")
  };

  const BRIDGE_WIDTH = 9;
  const WALK_SPEED = 210;

  const view = {
    width: 0,
    height: 0,
    groundY: 0
  };

  let state = createState();
  let lastTime = 0;
  let animationFrame = 0;

  function createState() {
    return {
      phase: "idle",
      round: 1,
      connected: 0,
      target: getTarget(1),
      perfect: 0,
      holding: false,
      bridgeLength: 0,
      bridgeAngle: -Math.PI / 2,
      fallProgress: 0,
      walker: 0,
      current: { x: 0, width: 86 },
      next: { x: 0, width: 78 },
      particles: [],
      pulse: 0
    };
  }

  function getTarget(round) {
    return Math.min(9, 4 + round);
  }

  function getGrowthSpeed(round) {
    return 140 + round * 9;
  }

  function getGapRange(round) {
    return {
      min: 58 + round * 4,
      max: 138 + round * 9
    };
  }

  function getNextWidth(round) {
    return Math.max(34, 86 - round * 5 - Math.random() * 14);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.width = rect.width;
    view.height = rect.height;
    view.groundY = rect.height - 74;
    if (state.phase === "idle") {
      setupPlatforms(1, true);
    }
    draw();
  }

  function startRun() {
    state = createState();
    startRound(1);
    hideOverlay();
    ensureLoop();
  }

  function startRound(round) {
    state.phase = "ready";
    state.round = round;
    state.connected = 0;
    state.target = getTarget(round);
    state.perfect = 0;
    state.bridgeLength = 0;
    state.bridgeAngle = -Math.PI / 2;
    state.fallProgress = 0;
    state.walker = 0;
    state.particles = [];
    setupPlatforms(round, true);
    setMessage(`라운드 ${round}: 브릿지 ${state.target}개를 정확히 놓으세요.`);
    updateHud();
  }

  function setupPlatforms(round, keepCurrent) {
    const currentWidth = keepCurrent ? 88 : state.next.width;
    const currentX = keepCurrent ? Math.max(34, view.width * 0.18) : Math.max(30, view.width * 0.18);
    const range = getGapRange(round);
    const gap = range.min + Math.random() * Math.max(1, range.max - range.min);
    const nextWidth = getNextWidth(round);
    const nextX = Math.min(view.width - nextWidth - 28, currentX + currentWidth + gap);

    state.current = { x: currentX, width: currentWidth };
    state.next = { x: nextX, width: nextWidth };
    state.bridgeLength = 0;
    state.bridgeAngle = -Math.PI / 2;
    state.fallProgress = 0;
    state.walker = 0;
    state.holding = false;
  }

  function beginHold() {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
      return;
    }
    if (state.phase !== "ready") {
      return;
    }
    state.holding = true;
    state.phase = "growing";
    setMessage("브릿지가 자랍니다. 목표 플랫폼에 닿을 때 손을 떼세요.");
  }

  function releaseHold() {
    if (state.phase !== "growing") {
      state.holding = false;
      return;
    }
    state.holding = false;
    state.phase = "falling";
    state.fallProgress = 0;
    setMessage("브릿지를 놓았습니다.");
  }

  function update(delta) {
    state.pulse += delta;
    updateParticles(delta);

    if (state.phase === "growing") {
      state.bridgeLength += getGrowthSpeed(state.round) * delta;
      const maxLength = view.width - state.current.x;
      if (state.bridgeLength > maxLength) {
        state.bridgeLength = maxLength;
        releaseHold();
      }
    }

    if (state.phase === "falling") {
      state.fallProgress = Math.min(1, state.fallProgress + delta * 2.8);
      state.bridgeAngle = -Math.PI / 2 + (Math.PI / 2) * easeOut(state.fallProgress);
      if (state.fallProgress >= 1) {
        evaluateBridge();
      }
    }

    if (state.phase === "walking") {
      state.walker += WALK_SPEED * delta;
      if (state.walker >= state.bridgeLength + 22) {
        completeSpan();
      }
    }
  }

  function evaluateBridge() {
    const startX = state.current.x + state.current.width;
    const endX = startX + state.bridgeLength;
    const hitMin = state.next.x;
    const hitMax = state.next.x + state.next.width;
    if (endX >= hitMin && endX <= hitMax) {
      state.phase = "walking";
      state.walker = 0;
      const center = state.next.x + state.next.width / 2;
      if (Math.abs(endX - center) <= Math.max(7, state.next.width * 0.16)) {
        state.perfect += 1;
        emitParticles(endX, view.groundY - 34, 20, "#c4934d");
        setMessage("정밀 연결. 다음 섬으로 이동합니다.");
      } else {
        setMessage("연결 성공. 다음 섬으로 이동합니다.");
      }
      return;
    }
    failRun(endX < hitMin ? "브릿지가 짧았습니다." : "브릿지가 너무 길었습니다.");
  }

  function completeSpan() {
    state.connected += 1;
    emitParticles(state.next.x + state.next.width / 2, view.groundY - 26, 14, "#7b966d");
    if (state.connected >= state.target) {
      clearRound();
      return;
    }
    setupPlatforms(state.round, false);
    state.phase = "ready";
    setMessage(`${state.target - state.connected}개 더 연결하면 다음 라운드입니다.`);
    updateHud();
  }

  function clearRound() {
    state.phase = "cleared";
    emitParticles(state.next.x + state.next.width / 2, view.groundY - 48, 34, "#c4934d");
    setMessage(`라운드 ${state.round} 완료. 다음 라운드는 간격이 더 넓고 플랫폼이 좁습니다.`);
    updateHud();
    window.setTimeout(() => {
      if (state.phase === "cleared") {
        startRound(state.round + 1);
      }
    }, 760);
  }

  function failRun(reason) {
    state.phase = "failed";
    state.holding = false;
    setMessage(`${reason} 다음 시도는 라운드 1부터 시작합니다.`);
    updateHud();
    showOverlay(
      "Run Reset",
      "라운드 1로 복귀",
      "브릿지는 손을 떼는 순간 바로 쓰러집니다. 목표 플랫폼의 시작점보다 약간 안쪽을 노리는 것이 안정적입니다.",
      "라운드 1 다시 시작"
    );
  }

  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    drawBackground();
    drawPlatforms();
    drawBridge();
    drawTargetGuide();
    drawParticles();
    drawWalker();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, view.width, view.height);
    gradient.addColorStop(0, "#252823");
    gradient.addColorStop(0.58, "#191b18");
    gradient.addColorStop(1, "#10120f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);

    ctx.strokeStyle = "rgba(252, 252, 248, 0.06)";
    ctx.lineWidth = 1;
    for (let y = 44; y < view.height; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(view.width, y + 18);
      ctx.stroke();
    }
  }

  function drawPlatforms() {
    drawPlatform(state.current, "#4d92a0");
    drawPlatform(state.next, "#c4934d");
  }

  function drawPlatform(platform, color) {
    ctx.save();
    ctx.fillStyle = "rgba(252, 252, 248, 0.12)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    roundRect(platform.x, view.groundY - 28, platform.width, 90, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawTargetGuide() {
    if (state.phase !== "ready" && state.phase !== "growing") {
      return;
    }
    const pulse = Math.sin(state.pulse * 5) * 0.5 + 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(196, 147, 77, ${0.35 + pulse * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(state.next.x, view.groundY - 38);
    ctx.lineTo(state.next.x + state.next.width, view.groundY - 38);
    ctx.stroke();
    ctx.restore();
  }

  function drawBridge() {
    if (state.bridgeLength <= 0) {
      return;
    }
    const startX = state.current.x + state.current.width;
    const startY = view.groundY - 30;
    ctx.save();
    ctx.translate(startX, startY);
    ctx.rotate(state.bridgeAngle);
    ctx.fillStyle = "#fcfcf8";
    ctx.strokeStyle = "rgba(77, 146, 160, 0.76)";
    ctx.lineWidth = 2;
    roundRect(0, -BRIDGE_WIDTH / 2, state.bridgeLength, BRIDGE_WIDTH, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawWalker() {
    const startX = state.current.x + state.current.width;
    const startY = view.groundY - 42;
    let x = startX - 18;
    let y = startY;
    if (state.phase === "walking") {
      x = startX + Math.min(state.walker, state.bridgeLength);
      y = startY - 2;
    } else if (state.phase === "cleared") {
      x = state.next.x + state.next.width / 2;
      y = startY - 2;
    }

    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 30);
    glow.addColorStop(0, "rgba(252, 252, 248, 0.9)");
    glow.addColorStop(1, "rgba(77, 146, 160, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fcfcf8";
    ctx.strokeStyle = "#4d92a0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function emitParticles(x, y, count, color) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 28 + Math.random() * 82;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
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
      particle.vy += 26 * delta;
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

  function updateHud() {
    ui.round.textContent = String(state.round);
    ui.span.textContent = String(state.connected);
    ui.target.textContent = String(state.target);
    ui.length.textContent = String(Math.round(state.bridgeLength));
    ui.perfect.textContent = String(state.perfect);
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

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
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

  function handleDown(event) {
    event.preventDefault();
    beginHold();
  }

  function handleUp() {
    releaseHold();
  }

  canvas.addEventListener("pointerdown", handleDown);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleUp);

  ui.startButton.addEventListener("click", startRun);
  ui.resetButton.addEventListener("click", startRun);

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      if (!event.repeat) {
        beginHold();
      }
    }
    if (event.key.toLowerCase() === "r") {
      startRun();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      releaseHold();
    }
  });

  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  updateHud();
  draw();
})();
