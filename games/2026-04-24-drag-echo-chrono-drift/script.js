(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    round: document.getElementById("roundValue"),
    core: document.getElementById("coreValue"),
    target: document.getElementById("targetValue"),
    integrity: document.getElementById("integrityValue"),
    echo: document.getElementById("echoValue"),
    phase: document.getElementById("phaseValue"),
    phaseFill: document.getElementById("phaseFill"),
    message: document.getElementById("messageLine"),
    overlay: document.getElementById("overlay"),
    overlayLabel: document.getElementById("overlayLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton")
  };

  const MAX_INTEGRITY = 3;
  const PLAYER_RADIUS = 11;
  const NODE_RADIUS = 13;
  const GATE_RADIUS = 26;
  const RECORD_STEP = 0.055;

  const view = {
    width: 0,
    height: 0,
    pad: 30,
    centerX: 0,
    centerY: 0
  };

  const keys = new Set();
  let state = createState();
  let lastTime = 0;
  let animationFrame = 0;

  function createState() {
    return {
      phase: "idle",
      round: 1,
      player: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        targetX: 0,
        targetY: 0,
        dragging: false
      },
      nodes: [],
      gate: { x: 0, y: 0, open: false, pulse: 0 },
      sentries: [],
      echoes: [],
      particles: [],
      trace: [],
      traceTime: 0,
      recordTimer: 0,
      echoClock: 0,
      echoSpan: getEchoSpan(1),
      collected: 0,
      target: getNodeCount(1),
      integrity: MAX_INTEGRITY,
      phaseCharge: 0,
      phasePulse: 0,
      damageCooldown: 0,
      transitionTimer: 0,
      shake: 0,
      messageCooldown: 0,
      stars: []
    };
  }

  function getNodeCount(round) {
    return Math.min(7, 3 + Math.ceil(round / 2));
  }

  function getEchoSpan(round) {
    return Math.max(3.4, 6.8 - round * 0.32);
  }

  function getSentryCount(round) {
    return Math.min(5, 1 + Math.floor(round / 2));
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    view.width = rect.width;
    view.height = rect.height;
    view.pad = Math.max(24, Math.min(rect.width, rect.height) * 0.065);
    view.centerX = rect.width / 2;
    view.centerY = rect.height / 2;

    if (state.phase === "idle") {
      placeIdlePlayer();
    }
    state.stars = buildStars();
  }

  function placeIdlePlayer() {
    state.player.x = view.centerX;
    state.player.y = view.centerY + view.height * 0.18;
    state.player.targetX = state.player.x;
    state.player.targetY = state.player.y;
  }

  function buildStars() {
    const stars = [];
    const count = Math.floor((view.width * view.height) / 7600);
    for (let index = 0; index < count; index += 1) {
      stars.push({
        x: Math.random() * view.width,
        y: Math.random() * view.height,
        r: 0.6 + Math.random() * 1.5,
        a: 0.12 + Math.random() * 0.3
      });
    }
    return stars;
  }

  function startRun() {
    state = createState();
    state.stars = buildStars();
    startRound(1);
    hideOverlay();
    ensureLoop();
  }

  function startRound(round) {
    const lastStars = state.stars.length ? state.stars : buildStars();
    state = createState();
    state.stars = lastStars;
    state.phase = "running";
    state.round = round;
    state.target = getNodeCount(round);
    state.echoSpan = getEchoSpan(round);
    state.player.x = view.centerX;
    state.player.y = view.height - view.pad - 26;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.targetX = state.player.x;
    state.player.targetY = state.player.y;
    state.nodes = createNodes(round);
    state.gate = createGate(round);
    state.sentries = createSentries(round);
    state.trace = [];
    state.traceTime = 0;
    state.recordTimer = 0;
    recordPoint(true);
    setMessage(`라운드 ${round}: 데이터 노드 ${state.target}개를 회수한 뒤 게이트로 탈출하세요.`);
    updateHud();
  }

  function createNodes(round) {
    const nodes = [];
    const count = getNodeCount(round);
    for (let index = 0; index < count; index += 1) {
      let point = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const candidate = {
          x: rand(view.pad + 30, view.width - view.pad - 30),
          y: rand(view.pad + 46, view.height - view.pad - 98)
        };
        const farFromStart = dist(candidate.x, candidate.y, view.centerX, view.height - view.pad - 26) > 92;
        const farFromOthers = nodes.every((node) => dist(candidate.x, candidate.y, node.x, node.y) > 76);
        if (farFromStart && farFromOthers) {
          point = candidate;
          break;
        }
      }
      nodes.push({
        x: point ? point.x : rand(view.pad, view.width - view.pad),
        y: point ? point.y : rand(view.pad, view.height - view.pad),
        collected: false,
        phase: Math.random() * Math.PI * 2,
        id: index,
        value: 1 + Math.floor((round + index) / 3)
      });
    }
    return nodes;
  }

  function createGate(round) {
    const side = round % 3;
    if (side === 0) {
      return { x: view.width - view.pad - 28, y: view.pad + 48, open: false, pulse: 0 };
    }
    if (side === 1) {
      return { x: view.centerX, y: view.pad + 32, open: false, pulse: 0 };
    }
    return { x: view.pad + 28, y: view.pad + 48, open: false, pulse: 0 };
  }

  function createSentries(round) {
    const sentries = [];
    const count = getSentryCount(round);
    for (let index = 0; index < count; index += 1) {
      const lane = index / Math.max(1, count - 1);
      const cx = lerp(view.pad + 72, view.width - view.pad - 72, count === 1 ? 0.5 : lane);
      const cy = view.centerY + Math.sin(index * 1.7 + round) * view.height * 0.12;
      sentries.push({
        cx,
        cy,
        orbit: 34 + ((round + index) % 3) * 12,
        angle: Math.random() * Math.PI * 2,
        speed: (0.82 + round * 0.07 + index * 0.04) * (index % 2 ? -1 : 1),
        radius: 15,
        stunned: 0,
        color: index % 2 ? "#c58b48" : "#4f9aa8"
      });
    }
    return sentries;
  }

  function update(delta) {
    state.messageCooldown = Math.max(0, state.messageCooldown - delta);
    state.damageCooldown = Math.max(0, state.damageCooldown - delta);
    state.phasePulse = Math.max(0, state.phasePulse - delta);
    state.shake = Math.max(0, state.shake - delta * 2.5);

    if (state.phase === "cleared") {
      state.transitionTimer -= delta;
      updateParticles(delta);
      updateEchoes(delta);
      if (state.transitionTimer <= 0) {
        startRound(state.round + 1);
      }
      return;
    }

    if (state.phase !== "running") {
      updateParticles(delta);
      updateEchoes(delta);
      return;
    }

    state.echoClock += delta;
    state.traceTime += delta;
    state.recordTimer += delta;
    state.gate.pulse += delta;

    updatePlayer(delta);
    updateSentries(delta);
    updateEchoes(delta);
    updateNodes();
    updateGate();
    updateHazards(delta);
    updateParticles(delta);
    updateRecording(delta);
    updateHud();
  }

  function updatePlayer(delta) {
    const player = state.player;
    const keyboardVector = getKeyboardVector();
    if (keyboardVector.x || keyboardVector.y) {
      player.targetX = clamp(player.x + keyboardVector.x * 96, view.pad, view.width - view.pad);
      player.targetY = clamp(player.y + keyboardVector.y * 96, view.pad, view.height - view.pad);
    }

    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const distance = Math.hypot(dx, dy);
    const pull = player.dragging || keyboardVector.x || keyboardVector.y ? 16 : 6;
    if (distance > 1) {
      player.vx += (dx / distance) * pull * delta * 60;
      player.vy += (dy / distance) * pull * delta * 60;
    }
    player.vx *= Math.pow(0.82, delta * 60);
    player.vy *= Math.pow(0.82, delta * 60);

    const maxSpeed = 250 + Math.min(80, state.round * 9);
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx = (player.vx / speed) * maxSpeed;
      player.vy = (player.vy / speed) * maxSpeed;
    }

    player.x = clamp(player.x + player.vx * delta, view.pad, view.width - view.pad);
    player.y = clamp(player.y + player.vy * delta, view.pad, view.height - view.pad);
  }

  function updateSentries(delta) {
    for (const sentry of state.sentries) {
      sentry.stunned = Math.max(0, sentry.stunned - delta);
      const speedScale = sentry.stunned > 0 ? 0.18 : 1;
      sentry.angle += sentry.speed * speedScale * delta;
    }
  }

  function updateEchoes(delta) {
    for (const echo of state.echoes) {
      echo.age += delta * echo.speed;
      echo.fade = Math.min(1, echo.fade + delta * 2.2);
    }
    state.echoes = state.echoes.filter((echo) => echo.age < echo.duration + 0.9);
  }

  function updateNodes() {
    for (const node of state.nodes) {
      node.phase += 0.05;
      if (!node.collected && dist(state.player.x, state.player.y, node.x, node.y) < PLAYER_RADIUS + NODE_RADIUS + 3) {
        node.collected = true;
        state.collected += 1;
        state.phaseCharge = Math.min(100, state.phaseCharge + 18);
        emitParticles(node.x, node.y, 20, "#79a56f");
        setMessage(`데이터 노드 회수. ${state.target - state.collected}개 남았습니다.`);
      }
    }
  }

  function updateGate() {
    if (!state.gate.open && state.collected >= state.target) {
      state.gate.open = true;
      emitParticles(state.gate.x, state.gate.y, 28, "#d1b26b");
      setMessage("게이트가 열렸습니다. 빛나는 출구로 들어가세요.");
    }

    if (state.gate.open && dist(state.player.x, state.player.y, state.gate.x, state.gate.y) < GATE_RADIUS + PLAYER_RADIUS) {
      clearRound();
    }
  }

  function updateHazards(delta) {
    let nearRisk = 0;
    for (const sentry of state.sentries) {
      const point = getSentryPoint(sentry);
      const d = dist(state.player.x, state.player.y, point.x, point.y);
      if (d < 82 && d > PLAYER_RADIUS + sentry.radius + 4) {
        nearRisk += (82 - d) / 82;
      }
      if (d < PLAYER_RADIUS + sentry.radius) {
        damage("감시자와 충돌했습니다.", point.x, point.y);
      }
    }

    for (const echo of state.echoes) {
      const risk = getEchoRisk(echo);
      nearRisk += risk.near;
      if (risk.hit) {
        damage("시간 잔상과 겹쳤습니다.", risk.x, risk.y);
      }
    }

    if (nearRisk > 0 && state.damageCooldown <= 0) {
      state.phaseCharge = Math.min(100, state.phaseCharge + nearRisk * delta * 18);
    }

    if (state.phaseCharge >= 100) {
      discharge();
    }
  }

  function updateRecording(delta) {
    if (state.recordTimer >= RECORD_STEP) {
      state.recordTimer = 0;
      recordPoint(false);
    }

    if (state.echoClock >= state.echoSpan) {
      releaseEcho();
      state.echoClock = 0;
      state.trace = [];
      state.traceTime = 0;
      recordPoint(true);
    }
  }

  function recordPoint(force) {
    if (!force && state.trace.length) {
      const last = state.trace[state.trace.length - 1];
      if (dist(last.x, last.y, state.player.x, state.player.y) < 3) {
        return;
      }
    }
    state.trace.push({
      x: state.player.x,
      y: state.player.y,
      t: state.traceTime
    });
    if (state.trace.length > 220) {
      state.trace.shift();
    }
  }

  function releaseEcho() {
    if (state.trace.length < 8) {
      return;
    }
    const points = state.trace.map((point) => ({ x: point.x, y: point.y, t: point.t }));
    const duration = points[points.length - 1].t || state.echoSpan;
    state.echoes.push({
      points,
      duration,
      age: 0,
      fade: 0,
      speed: 1 + state.round * 0.035,
      color: state.echoes.length % 2 ? "#b75c67" : "#c58b48"
    });
    if (state.echoes.length > 4) {
      state.echoes.shift();
    }
    emitParticles(points[0].x, points[0].y, 12, "#b75c67");
    setMessage("방금 이동한 경로가 시간 잔상으로 재생됩니다.");
  }

  function getEchoRisk(echo) {
    let hit = false;
    let near = 0;
    let hitX = 0;
    let hitY = 0;
    const head = getEchoPoint(echo, echo.age);
    if (head) {
      const d = dist(state.player.x, state.player.y, head.x, head.y);
      if (d < PLAYER_RADIUS + 15) {
        hit = true;
        hitX = head.x;
        hitY = head.y;
      } else if (d < 78) {
        near += (78 - d) / 78;
      }
    }

    const tailStart = Math.max(0, echo.age - 0.72);
    for (let t = tailStart; t <= echo.age; t += 0.12) {
      const point = getEchoPoint(echo, t);
      if (!point) {
        continue;
      }
      const d = dist(state.player.x, state.player.y, point.x, point.y);
      if (d < PLAYER_RADIUS + 9) {
        hit = true;
        hitX = point.x;
        hitY = point.y;
        break;
      }
      if (d < 58) {
        near += (58 - d) / 160;
      }
    }

    return { hit, near, x: hitX, y: hitY };
  }

  function getEchoPoint(echo, time) {
    if (!echo.points.length || time < 0 || time > echo.duration) {
      return null;
    }
    let right = 1;
    while (right < echo.points.length && echo.points[right].t < time) {
      right += 1;
    }
    if (right >= echo.points.length) {
      return echo.points[echo.points.length - 1];
    }
    const left = echo.points[right - 1];
    const next = echo.points[right];
    const span = Math.max(0.001, next.t - left.t);
    const local = (time - left.t) / span;
    return {
      x: lerp(left.x, next.x, local),
      y: lerp(left.y, next.y, local)
    };
  }

  function damage(reason, x, y) {
    if (state.phase !== "running" || state.damageCooldown > 0 || state.phasePulse > 0) {
      return;
    }
    state.integrity -= 1;
    state.damageCooldown = 1.1;
    state.phaseCharge = Math.min(100, state.phaseCharge + 22);
    state.shake = 1;
    emitParticles(x, y, 22, "#b75c67");
    setMessage(`${reason} 무결성 ${Math.max(0, state.integrity)} 남음.`);
    if (state.integrity <= 0) {
      failRun();
    }
  }

  function discharge() {
    state.phaseCharge = 0;
    state.phasePulse = 1.1;
    state.damageCooldown = Math.max(state.damageCooldown, 0.65);
    for (const sentry of state.sentries) {
      sentry.stunned = 1.35;
    }
    for (const echo of state.echoes) {
      echo.age += 0.65;
    }
    emitParticles(state.player.x, state.player.y, 34, "#79a56f");
    setMessage("위상 방전. 주변 위험이 잠시 느려졌습니다.");
  }

  function clearRound() {
    state.phase = "cleared";
    state.transitionTimer = 0.75;
    state.player.dragging = false;
    state.echoes = [];
    emitParticles(state.gate.x, state.gate.y, 42, "#d1b26b");
    setMessage(`라운드 ${state.round} 탈출 성공. 다음 라운드는 잔상이 더 빨리 돌아옵니다.`);
    updateHud();
  }

  function failRun() {
    state.phase = "failed";
    state.round = 1;
    state.target = getNodeCount(1);
    state.collected = 0;
    state.integrity = 0;
    state.player.dragging = false;
    state.echoes = [];
    setMessage("코어 무결성이 붕괴했습니다. 다음 시도는 라운드 1에서 시작합니다.");
    updateHud();
    showOverlay(
      "Run Reset",
      "라운드 1로 복귀",
      "잔상은 내가 남긴 경로를 그대로 따라옵니다. 직선으로만 움직이면 다음 주기에 도망칠 공간이 줄어듭니다.",
      "라운드 1 다시 시작"
    );
  }

  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    drawBackdrop();
    drawGate();
    drawTrace();
    drawEchoes();
    drawSentries();
    drawNodes();
    drawParticles();
    drawPlayer();
    drawVignette();
  }

  function drawBackdrop() {
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 7 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 7 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    const bg = ctx.createRadialGradient(view.centerX, view.centerY, 20, view.centerX, view.centerY, Math.max(view.width, view.height) * 0.72);
    bg.addColorStop(0, "#26302d");
    bg.addColorStop(0.54, "#1b211f");
    bg.addColorStop(1, "#101210");
    ctx.fillStyle = bg;
    ctx.fillRect(-12, -12, view.width + 24, view.height + 24);

    for (const star of state.stars) {
      ctx.fillStyle = `rgba(251, 251, 248, ${star.a})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(251, 251, 248, 0.06)";
    ctx.lineWidth = 1;
    const shift = (performance.now() * 0.012) % 34;
    for (let y = -34; y < view.height + 34; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y + shift);
      ctx.lineTo(view.width, y + 18 + shift);
      ctx.stroke();
    }
    for (let x = -34; x < view.width + 34; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x + shift, 0);
      ctx.lineTo(x - 18 + shift, view.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGate() {
    const gate = state.gate;
    const open = gate.open || state.phase === "cleared";
    const pulse = Math.sin(gate.pulse * 5) * 0.5 + 0.5;
    ctx.save();
    ctx.translate(gate.x, gate.y);
    ctx.globalAlpha = open ? 1 : 0.38;
    ctx.strokeStyle = open ? "rgba(209, 178, 107, 0.95)" : "rgba(251, 251, 248, 0.22)";
    ctx.lineWidth = 3 + pulse * 2;
    ctx.beginPath();
    ctx.arc(0, 0, GATE_RADIUS + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = open ? "rgba(79, 154, 168, 0.76)" : "rgba(251, 251, 248, 0.16)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -performance.now() * 0.04;
    ctx.beginPath();
    ctx.arc(0, 0, GATE_RADIUS + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = open ? "rgba(251, 251, 248, 0.92)" : "rgba(251, 251, 248, 0.36)";
    ctx.font = "800 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(open ? "EXIT" : "LOCK", 0, 1);
    ctx.restore();
  }

  function drawTrace() {
    if (state.trace.length < 2 || state.phase !== "running") {
      return;
    }
    ctx.save();
    ctx.strokeStyle = "rgba(79, 154, 168, 0.22)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(state.trace[0].x, state.trace[0].y);
    for (const point of state.trace) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawEchoes() {
    for (const echo of state.echoes) {
      drawEcho(echo);
    }
  }

  function drawEcho(echo) {
    const alpha = Math.min(0.72, echo.fade * 0.72);
    const tailStart = Math.max(0, echo.age - 0.9);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colorWithAlpha(echo.color, alpha * 0.56);
    ctx.lineWidth = 8;
    ctx.beginPath();
    let started = false;
    for (let t = tailStart; t <= echo.age; t += 0.07) {
      const point = getEchoPoint(echo, t);
      if (!point) {
        continue;
      }
      if (!started) {
        ctx.moveTo(point.x, point.y);
        started = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    if (started) {
      ctx.stroke();
    }

    const head = getEchoPoint(echo, echo.age);
    if (head) {
      ctx.fillStyle = colorWithAlpha(echo.color, alpha);
      ctx.strokeStyle = "rgba(251, 251, 248, 0.72)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(17, 19, 17, 0.8)";
      ctx.font = "800 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("E", head.x, head.y + 1);
    }
    ctx.restore();
  }

  function drawSentries() {
    for (const sentry of state.sentries) {
      const point = getSentryPoint(sentry);
      ctx.save();
      ctx.strokeStyle = sentry.stunned > 0 ? "rgba(121, 165, 111, 0.72)" : "rgba(251, 251, 248, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sentry.cx, sentry.cy, sentry.orbit, 0, Math.PI * 2);
      ctx.stroke();

      ctx.translate(point.x, point.y);
      ctx.rotate(sentry.angle * 1.7);
      ctx.fillStyle = sentry.stunned > 0 ? "#79a56f" : sentry.color;
      ctx.strokeStyle = "rgba(251, 251, 248, 0.72)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(15, 8);
      ctx.lineTo(0, 16);
      ctx.lineTo(-15, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawNodes() {
    for (const node of state.nodes) {
      if (node.collected) {
        continue;
      }
      const bob = Math.sin(node.phase) * 3;
      ctx.save();
      ctx.translate(node.x, node.y + bob);
      ctx.strokeStyle = "rgba(121, 165, 111, 0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, NODE_RADIUS + 7 + Math.sin(node.phase * 1.4) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#79a56f";
      ctx.strokeStyle = "rgba(251, 251, 248, 0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111311";
      ctx.font = "800 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(node.id + 1), 0, 1);
      ctx.restore();
    }
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

  function drawPlayer() {
    const player = state.player;
    ctx.save();
    if (state.phasePulse > 0) {
      ctx.strokeStyle = `rgba(121, 165, 111, ${state.phasePulse * 0.55})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 38 + (1.1 - state.phasePulse) * 90, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state.damageCooldown > 0) {
      ctx.globalAlpha = 0.55 + Math.sin(performance.now() * 0.03) * 0.24;
    }
    const glow = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 42);
    glow.addColorStop(0, "rgba(251, 251, 248, 0.95)");
    glow.addColorStop(0.36, "rgba(79, 154, 168, 0.55)");
    glow.addColorStop(1, "rgba(79, 154, 168, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fbfbf8";
    ctx.strokeStyle = "#4f9aa8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111311";
    ctx.beginPath();
    ctx.arc(player.x, player.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (state.player.dragging) {
      ctx.strokeStyle = "rgba(251, 251, 248, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.targetX, player.targetY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(view.centerX, view.centerY, Math.min(view.width, view.height) * 0.2, view.centerX, view.centerY, Math.max(view.width, view.height) * 0.72);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.34)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);
  }

  function getSentryPoint(sentry) {
    return {
      x: sentry.cx + Math.cos(sentry.angle) * sentry.orbit,
      y: sentry.cy + Math.sin(sentry.angle) * sentry.orbit
    };
  }

  function emitParticles(x, y, count, color) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 34 + Math.random() * 118;
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
      particle.vx *= Math.pow(0.96, delta * 60);
      particle.vy *= Math.pow(0.96, delta * 60);
      particle.life -= delta;
      particle.size *= 0.986;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function updateHud() {
    ui.round.textContent = String(state.round);
    ui.core.textContent = String(state.collected);
    ui.target.textContent = String(state.target);
    ui.integrity.textContent = String(Math.max(0, state.integrity));
    ui.echo.textContent = `${Math.max(0, state.echoSpan - state.echoClock).toFixed(1)}s`;
    ui.phase.textContent = `${Math.round(state.phaseCharge)}%`;
    ui.phaseFill.style.width = `${Math.round(state.phaseCharge)}%`;
  }

  function setMessage(text) {
    if (state.messageCooldown > 0 && state.phase === "running") {
      return;
    }
    ui.message.textContent = text;
    state.messageCooldown = 0.35;
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

  function setTargetFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    state.player.targetX = clamp(event.clientX - rect.left, view.pad, view.width - view.pad);
    state.player.targetY = clamp(event.clientY - rect.top, view.pad, view.height - view.pad);
  }

  function getKeyboardVector() {
    let x = 0;
    let y = 0;
    if (keys.has("arrowleft") || keys.has("a")) x -= 1;
    if (keys.has("arrowright") || keys.has("d")) x += 1;
    if (keys.has("arrowup") || keys.has("w")) y -= 1;
    if (keys.has("arrowdown") || keys.has("s")) y += 1;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function colorWithAlpha(hex, alpha) {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
    }
    if (state.phase === "running") {
      state.player.dragging = true;
      canvas.setPointerCapture(event.pointerId);
      setTargetFromEvent(event);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (state.phase === "running" && state.player.dragging) {
      event.preventDefault();
      setTargetFromEvent(event);
    }
  });

  canvas.addEventListener("pointerup", (event) => {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    state.player.dragging = false;
  });

  canvas.addEventListener("pointercancel", (event) => {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    state.player.dragging = false;
  });

  ui.startButton.addEventListener("click", startRun);
  ui.resetButton.addEventListener("click", startRun);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      keys.add(key);
      if (state.phase === "idle" || state.phase === "failed") {
        startRun();
      }
    }
    if (key === "r") {
      startRun();
    }
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      if (state.phase === "idle" || state.phase === "failed") {
        startRun();
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", () => {
    keys.clear();
    state.player.dragging = false;
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    draw();
  });

  resizeCanvas();
  updateHud();
  draw();
})();
