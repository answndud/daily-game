(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    round: document.getElementById("roundValue"),
    block: document.getElementById("blockValue"),
    target: document.getElementById("targetValue"),
    stability: document.getElementById("stabilityValue"),
    combo: document.getElementById("comboValue"),
    shield: document.getElementById("shieldValue"),
    shieldFill: document.getElementById("shieldFill"),
    message: document.getElementById("messageLine"),
    overlay: document.getElementById("overlay"),
    overlayLabel: document.getElementById("overlayLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton")
  };

  const MAX_STABILITY = 3;
  const GATE_WIDTH = 34;
  const PERFECT_WINDOW = 8;
  const GOOD_WINDOW = 18;
  const SHIELD_DURATION = 3.8;

  const view = {
    width: 0,
    height: 0,
    cx: 0,
    cy: 0,
    outerRadius: 0,
    gateRadius: 0,
    coreRadius: 0
  };

  let state = createState();
  let lastTime = 0;
  let animationFrame = 0;

  function createState() {
    return {
      phase: "idle",
      round: 1,
      target: getRoundTarget(1),
      blocked: 0,
      stability: MAX_STABILITY,
      combo: 0,
      shieldCharge: 0,
      shieldTime: 0,
      spawnTimer: 0.5,
      transitionTimer: 0,
      pulses: [],
      sparks: [],
      lastLane: -1,
      flash: 0
    };
  }

  function getRoundTarget(round) {
    return 8 + round * 2;
  }

  function getSpawnDelay(round) {
    const base = Math.max(0.42, 1.12 - round * 0.07);
    return base * (0.78 + Math.random() * 0.44);
  }

  function getPulseSpeed(round) {
    return 61 + round * 6 + Math.random() * 16;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    view.width = rect.width;
    view.height = rect.height;
    view.cx = rect.width / 2;
    view.cy = rect.height / 2;
    view.outerRadius = Math.min(rect.width, rect.height) * 0.48;
    view.gateRadius = Math.min(rect.width, rect.height) * 0.28;
    view.coreRadius = Math.max(24, Math.min(rect.width, rect.height) * 0.075);
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
    state.target = getRoundTarget(round);
    state.blocked = 0;
    state.stability = MAX_STABILITY;
    state.combo = 0;
    state.shieldCharge = Math.min(state.shieldCharge, 45);
    state.shieldTime = 0;
    state.spawnTimer = 0.36;
    state.transitionTimer = 0;
    state.pulses = [];
    state.sparks = [];
    state.flash = 0;
    setMessage(`라운드 ${round}: 펄스 ${state.target}개를 게이트에서 차단하세요.`);
    updateHud();
  }

  function clearRound() {
    state.phase = "cleared";
    state.transitionTimer = 0.62;
    state.pulses = [];
    burst(view.cx, view.cy, 20, "#f1c27d");
    setMessage(`라운드 ${state.round} 클리어. 난이도가 상승합니다.`);
    updateHud();
  }

  function failRun() {
    state.phase = "failed";
    state.round = 1;
    state.target = getRoundTarget(1);
    state.blocked = 0;
    state.combo = 0;
    state.shieldCharge = 0;
    state.shieldTime = 0;
    state.pulses = [];
    state.flash = 1;
    setMessage("코어가 불안정해졌습니다. 다음 시도는 라운드 1에서 시작합니다.");
    updateHud();
    showOverlay(
      "Run Reset",
      "라운드 1로 복귀",
      "실패하면 진행도가 초기화됩니다. 다시 시작하면 라운드 1부터 안정도를 회복해야 합니다.",
      "라운드 1 다시 시작"
    );
  }

  function spawnPulse() {
    const laneCount = Math.min(12, 7 + Math.floor(state.round / 2));
    let lane = Math.floor(Math.random() * laneCount);
    if (lane === state.lastLane) {
      lane = (lane + 1 + Math.floor(Math.random() * (laneCount - 1))) % laneCount;
    }
    state.lastLane = lane;

    const angle = -Math.PI / 2 + (Math.PI * 2 * lane) / laneCount;
    state.pulses.push({
      angle,
      radius: view.outerRadius + 26,
      speed: getPulseSpeed(state.round),
      size: 8 + Math.random() * 3,
      wobble: Math.random() * Math.PI * 2,
      color: Math.random() > 0.5 ? "#f0a35f" : "#76a7b5"
    });
  }

  function update(delta) {
    state.flash = Math.max(0, state.flash - delta * 2.4);

    if (state.phase === "cleared") {
      state.transitionTimer -= delta;
      updateSparks(delta);
      if (state.transitionTimer <= 0) {
        startRound(state.round + 1);
      }
      return;
    }

    if (state.phase !== "running") {
      updateSparks(delta);
      return;
    }

    if (state.shieldTime > 0) {
      state.shieldTime = Math.max(0, state.shieldTime - delta);
    }

    state.spawnTimer -= delta;
    if (state.spawnTimer <= 0) {
      spawnPulse();
      state.spawnTimer = getSpawnDelay(state.round);
    }

    const speedScale = state.shieldTime > 0 ? 0.82 : 1;
    for (const pulse of state.pulses) {
      pulse.radius -= pulse.speed * speedScale * delta;
      pulse.wobble += delta * 5;
    }

    for (let index = state.pulses.length - 1; index >= 0; index -= 1) {
      if (state.pulses[index].radius <= view.coreRadius + 8) {
        const pulse = state.pulses.splice(index, 1)[0];
        const point = getPulsePoint(pulse);
        burst(point.x, point.y, 10, "#d47c62");
        applyFault("펄스가 코어에 닿았습니다.");
      }
    }

    updateSparks(delta);
    updateHud();
  }

  function updateSparks(delta) {
    for (const spark of state.sparks) {
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;
      spark.life -= delta;
      spark.size *= 0.985;
    }
    state.sparks = state.sparks.filter((spark) => spark.life > 0);
  }

  function attemptBlock() {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
      return;
    }
    if (state.phase !== "running") {
      return;
    }

    let bestPulse = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const pulse of state.pulses) {
      const distance = Math.abs(pulse.radius - view.gateRadius);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPulse = pulse;
      }
    }

    if (!bestPulse || bestDistance > GATE_WIDTH) {
      applyFault("게이트 밖에서 탭했습니다.");
      state.combo = 0;
      state.flash = 0.7;
      updateHud();
      return;
    }

    const point = getPulsePoint(bestPulse);
    state.pulses = state.pulses.filter((pulse) => pulse !== bestPulse);
    state.blocked += 1;
    state.combo += 1;

    let grade = "차단";
    let charge = 12;
    let color = "#d6c7a7";
    if (bestDistance <= PERFECT_WINDOW) {
      grade = "정밀 차단";
      charge = 32;
      color = "#f2c77f";
    } else if (bestDistance <= GOOD_WINDOW) {
      grade = "안정 차단";
      charge = 21;
      color = "#88bac5";
    }

    state.shieldCharge = Math.min(100, state.shieldCharge + charge + Math.min(10, state.combo));
    if (state.shieldCharge >= 100) {
      state.shieldCharge = 0;
      state.shieldTime = SHIELD_DURATION;
      setMessage("소프트 실드가 켜졌습니다. 잠시 동안 속도가 느려지고 실수 한 번을 흡수합니다.");
    } else {
      setMessage(`${grade}. ${state.target - state.blocked}개 남았습니다.`);
    }

    burst(point.x, point.y, bestDistance <= PERFECT_WINDOW ? 18 : 12, color);

    if (state.blocked >= state.target) {
      clearRound();
    }

    updateHud();
  }

  function applyFault(reason) {
    if (state.phase !== "running") {
      return;
    }

    if (state.shieldTime > 0) {
      state.shieldTime = 0;
      state.combo = 0;
      setMessage(`소프트 실드가 흡수했습니다: ${reason}`);
      updateHud();
      return;
    }

    state.stability -= 1;
    state.combo = 0;
    setMessage(`${reason} 안정도 ${state.stability} 남음.`);

    if (state.stability <= 0) {
      failRun();
    }
  }

  function getPulsePoint(pulse) {
    const wobble = Math.sin(pulse.wobble) * 3;
    return {
      x: view.cx + Math.cos(pulse.angle) * (pulse.radius + wobble),
      y: view.cy + Math.sin(pulse.angle) * (pulse.radius + wobble)
    };
  }

  function burst(x, y, count, color) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 48 + Math.random() * 96;
      state.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.35,
        color
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    drawBackdrop();
    drawGate();
    drawPulses();
    drawSparks();
    drawCore();
  }

  function drawBackdrop() {
    const gradient = ctx.createRadialGradient(view.cx, view.cy, 10, view.cx, view.cy, view.outerRadius);
    gradient.addColorStop(0, "#2d2a25");
    gradient.addColorStop(0.54, "#211f1c");
    gradient.addColorStop(1, "#171614");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);

    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.strokeStyle = "rgba(242, 235, 219, 0.08)";
    ctx.lineWidth = 1;
    const laneCount = Math.min(12, 7 + Math.floor(state.round / 2));
    for (let lane = 0; lane < laneCount; lane += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * lane) / laneCount;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (view.coreRadius + 10), Math.sin(angle) * (view.coreRadius + 10));
      ctx.lineTo(Math.cos(angle) * view.outerRadius, Math.sin(angle) * view.outerRadius);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGate() {
    ctx.save();
    ctx.translate(view.cx, view.cy);

    ctx.strokeStyle = "rgba(255, 254, 250, 0.16)";
    ctx.lineWidth = GATE_WIDTH;
    ctx.beginPath();
    ctx.arc(0, 0, view.gateRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = state.shieldTime > 0 ? "rgba(136, 186, 197, 0.92)" : "rgba(242, 199, 127, 0.78)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -performance.now() * 0.04;
    ctx.beginPath();
    ctx.arc(0, 0, view.gateRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255, 254, 250, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, view.gateRadius - GATE_WIDTH / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, view.gateRadius + GATE_WIDTH / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawCore() {
    ctx.save();
    ctx.translate(view.cx, view.cy);

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(155, 74, 58, ${state.flash * 0.22})`;
      ctx.beginPath();
      ctx.arc(0, 0, view.gateRadius + 28, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#f5eee0";
    ctx.beginPath();
    ctx.arc(0, 0, view.coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = state.shieldTime > 0 ? "#88bac5" : "#c7bda8";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, view.coreRadius + 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#24221f";
    ctx.font = "700 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.phase === "failed" ? "R1" : `R${state.round}`, 0, 1);
    ctx.restore();
  }

  function drawPulses() {
    for (const pulse of state.pulses) {
      const point = getPulsePoint(pulse);
      const gateDistance = Math.abs(pulse.radius - view.gateRadius);
      const inGate = gateDistance <= GATE_WIDTH;
      ctx.save();
      ctx.globalAlpha = inGate ? 1 : 0.78;
      ctx.fillStyle = inGate ? "#f5c576" : pulse.color;
      ctx.strokeStyle = inGate ? "rgba(255, 254, 250, 0.82)" : "rgba(255, 254, 250, 0.22)";
      ctx.lineWidth = inGate ? 3 : 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, pulse.size + (inGate ? 4 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSparks() {
    for (const spark of state.sparks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, spark.life * 2);
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updateHud() {
    ui.round.textContent = String(state.round);
    ui.block.textContent = String(state.blocked);
    ui.target.textContent = String(state.target);
    ui.stability.textContent = String(Math.max(0, state.stability));
    ui.combo.textContent = String(state.combo);
    const shieldPercent = state.shieldTime > 0 ? 100 : Math.round(state.shieldCharge);
    ui.shield.textContent = state.shieldTime > 0 ? "활성" : `${shieldPercent}%`;
    ui.shieldFill.style.width = `${shieldPercent}%`;
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
    attemptBlock();
  });

  ui.startButton.addEventListener("click", startRun);
  ui.resetButton.addEventListener("click", startRun);

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      attemptBlock();
    }
    if (event.key.toLowerCase() === "r") {
      startRun();
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
