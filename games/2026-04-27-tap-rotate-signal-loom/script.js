(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    round: document.getElementById("roundValue"),
    turn: document.getElementById("turnValue"),
    limit: document.getElementById("limitValue"),
    link: document.getElementById("linkValue"),
    mirror: document.getElementById("mirrorValue"),
    message: document.getElementById("messageLine"),
    overlay: document.getElementById("overlay"),
    overlayLabel: document.getElementById("overlayLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton")
  };

  const SIZE = 6;
  const DIR = {
    right: { x: 1, y: 0 },
    left: { x: -1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 }
  };

  const LEVELS = [
    {
      source: { x: -1, y: 4, dir: "right" },
      target: { x: 4, y: 0 },
      limit: 9,
      mirrors: [
        { x: 1, y: 4, type: "\\" },
        { x: 1, y: 2, type: "\\" },
        { x: 4, y: 2, type: "\\" },
        { x: 3, y: 5, type: "/" }
      ],
      solution: ["/", "/", "/"],
      blockers: [[0, 1], [3, 3], [5, 4]]
    },
    {
      source: { x: -1, y: 5, dir: "right" },
      target: { x: 5, y: 0 },
      limit: 8,
      mirrors: [
        { x: 2, y: 5, type: "\\" },
        { x: 2, y: 1, type: "\\" },
        { x: 5, y: 1, type: "\\" },
        { x: 4, y: 4, type: "/" },
        { x: 0, y: 2, type: "/" }
      ],
      solution: ["/", "/", "/"],
      blockers: [[1, 3], [3, 3], [4, 0], [5, 5]]
    },
    {
      source: { x: 0, y: -1, dir: "down" },
      target: { x: 3, y: 0 },
      limit: 8,
      mirrors: [
        { x: 0, y: 2, type: "/" },
        { x: 3, y: 2, type: "\\" },
        { x: 3, y: 5, type: "\\" },
        { x: 1, y: 4, type: "/" },
        { x: 5, y: 1, type: "\\" }
      ],
      solution: ["\\", "/", "\\"],
      blockers: [[2, 0], [2, 3], [4, 4], [5, 3]]
    },
    {
      source: { x: 6, y: 3, dir: "left" },
      target: { x: 0, y: 0 },
      limit: 7,
      mirrors: [
        { x: 4, y: 3, type: "/" },
        { x: 4, y: 1, type: "/" },
        { x: 0, y: 1, type: "/" },
        { x: 2, y: 4, type: "\\" },
        { x: 5, y: 5, type: "/" }
      ],
      solution: ["\\", "\\", "\\" ],
      blockers: [[1, 2], [2, 2], [3, 0], [3, 5], [5, 2]]
    }
  ];

  const view = {
    width: 0,
    height: 0,
    cell: 0,
    ox: 0,
    oy: 0
  };

  let state = createState();
  let animationFrame = 0;
  let lastTime = 0;

  function createState() {
    return {
      phase: "idle",
      round: 1,
      turns: 0,
      limit: LEVELS[0].limit,
      source: LEVELS[0].source,
      target: LEVELS[0].target,
      mirrors: [],
      blockers: new Set(),
      beam: [],
      linked: false,
      pulse: 0,
      particles: []
    };
  }

  function startRun() {
    startRound(1);
    hideOverlay();
    ensureLoop();
  }

  function startRound(round) {
    const template = LEVELS[(round - 1) % LEVELS.length];
    const cycle = Math.floor((round - 1) / LEVELS.length);
    state.phase = "playing";
    state.round = round;
    state.turns = 0;
    state.limit = Math.max(5, template.limit - cycle);
    state.source = { ...template.source };
    state.target = { ...template.target };
    state.mirrors = template.mirrors.map((mirror, index) => ({
      x: mirror.x,
      y: mirror.y,
      type: getInitialMirrorType(mirror, template.solution[index])
    }));
    state.blockers = new Set(template.blockers.map(([x, y]) => key(x, y)));
    state.particles = [];
    traceBeam();
    setMessage(`라운드 ${round}: ${state.limit}번 안에 신호를 수신기까지 연결하세요.`);
    updateHud();
  }

  function getInitialMirrorType(mirror, solutionType) {
    if (!solutionType) {
      return mirror.type;
    }
    return mirror.type === solutionType ? flipMirror(mirror.type) : mirror.type;
  }

  function flipMirror(type) {
    return type === "/" ? "\\" : "/";
  }

  function rotateMirror(index) {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
      return;
    }
    if (state.phase !== "playing") {
      return;
    }
    state.mirrors[index].type = flipMirror(state.mirrors[index].type);
    state.turns += 1;
    traceBeam();
    emitCellParticles(state.mirrors[index], "#4d92a0", 10);

    if (state.linked) {
      clearRound();
      return;
    }
    if (state.turns >= state.limit) {
      failRun();
      return;
    }
    setMessage("거울을 회전했습니다. 빔 끝이 수신기 쪽으로 가까워지는지 보세요.");
    updateHud();
  }

  function traceBeam() {
    const beam = [];
    let x = state.source.x + DIR[state.source.dir].x;
    let y = state.source.y + DIR[state.source.dir].y;
    let dir = state.source.dir;
    let linked = false;
    const visited = new Set();

    for (let step = 0; step < 80; step += 1) {
      if (!inside(x, y)) {
        break;
      }
      beam.push({ x, y, dir });
      if (x === state.target.x && y === state.target.y) {
        linked = true;
        break;
      }
      if (state.blockers.has(key(x, y))) {
        break;
      }

      const visitKey = `${x},${y},${dir}`;
      if (visited.has(visitKey)) {
        break;
      }
      visited.add(visitKey);

      const mirror = findMirror(x, y);
      if (mirror) {
        dir = reflect(dir, mirror.type);
      }
      x += DIR[dir].x;
      y += DIR[dir].y;
    }

    state.beam = beam;
    state.linked = linked;
    updateHud();
  }

  function reflect(dir, mirrorType) {
    if (mirrorType === "/") {
      return { right: "up", up: "right", left: "down", down: "left" }[dir];
    }
    return { right: "down", down: "right", left: "up", up: "left" }[dir];
  }

  function clearRound() {
    state.phase = "cleared";
    emitCellParticles(state.target, "#c4934d", 26);
    setMessage(`라운드 ${state.round} 연결 완료. 다음 라운드는 회전 여유가 줄어듭니다.`);
    updateHud();
    window.setTimeout(() => {
      if (state.phase === "cleared") {
        startRound(state.round + 1);
      }
    }, 720);
  }

  function failRun() {
    state.phase = "failed";
    setMessage("회전 제한을 넘겼습니다. 다음 시도는 라운드 1부터 시작합니다.");
    updateHud();
    showOverlay(
      "Run Reset",
      "라운드 1로 복귀",
      "빔은 거울을 만나는 순간 직각으로 꺾입니다. 먼저 빔 끝이 멈추는 지점을 보고 필요한 거울만 바꾸세요.",
      "라운드 1 다시 시작"
    );
  }

  function update(delta) {
    state.pulse += delta;
    updateParticles(delta);
  }

  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    drawBackground();
    drawGrid();
    drawSourceAndTarget();
    drawBlockers();
    drawBeam();
    drawMirrors();
    drawParticles();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, view.width, view.height);
    gradient.addColorStop(0, "#252823");
    gradient.addColorStop(0.58, "#191b18");
    gradient.addColorStop(1, "#10120f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = "rgba(252, 252, 248, 0.12)";
    ctx.lineWidth = 1;
    for (let y = 0; y <= SIZE; y += 1) {
      const py = view.oy + y * view.cell;
      ctx.beginPath();
      ctx.moveTo(view.ox, py);
      ctx.lineTo(view.ox + SIZE * view.cell, py);
      ctx.stroke();
    }
    for (let x = 0; x <= SIZE; x += 1) {
      const px = view.ox + x * view.cell;
      ctx.beginPath();
      ctx.moveTo(px, view.oy);
      ctx.lineTo(px, view.oy + SIZE * view.cell);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSourceAndTarget() {
    const sourcePoint = edgePoint(state.source);
    const targetPoint = cellCenter(state.target);
    const pulse = Math.sin(state.pulse * 5) * 0.5 + 0.5;

    ctx.save();
    ctx.fillStyle = "#4d92a0";
    ctx.strokeStyle = "rgba(252, 252, 248, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sourcePoint.x, sourcePoint.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = state.linked ? "#c4934d" : "rgba(196, 147, 77, 0.78)";
    ctx.lineWidth = 3 + pulse * 2;
    ctx.beginPath();
    ctx.arc(targetPoint.x, targetPoint.y, view.cell * (0.26 + pulse * 0.04), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(252, 252, 248, 0.82)";
    ctx.font = "800 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RX", targetPoint.x, targetPoint.y + 1);
    ctx.restore();
  }

  function drawBlockers() {
    ctx.save();
    ctx.fillStyle = "rgba(180, 94, 105, 0.42)";
    ctx.strokeStyle = "rgba(252, 252, 248, 0.26)";
    for (const blockKey of state.blockers) {
      const [x, y] = blockKey.split(",").map(Number);
      const px = view.ox + x * view.cell + 7;
      const py = view.oy + y * view.cell + 7;
      const size = view.cell - 14;
      roundRect(px, py, size, size, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBeam() {
    if (!state.beam.length) {
      return;
    }
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = state.linked ? "rgba(196, 147, 77, 0.92)" : "rgba(77, 146, 160, 0.82)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    const sourcePoint = edgePoint(state.source);
    ctx.moveTo(sourcePoint.x, sourcePoint.y);
    for (const point of state.beam) {
      const center = cellCenter(point);
      ctx.lineTo(center.x, center.y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(252, 252, 248, 0.62)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawMirrors() {
    state.mirrors.forEach((mirror, index) => {
      const center = cellCenter(mirror);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.strokeStyle = "#fcfcf8";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      const diagonal = view.cell * 0.28;
      if (mirror.type === "/") {
        ctx.moveTo(-diagonal, diagonal);
        ctx.lineTo(diagonal, -diagonal);
      } else {
        ctx.moveTo(-diagonal, -diagonal);
        ctx.lineTo(diagonal, diagonal);
      }
      ctx.stroke();

      ctx.strokeStyle = "rgba(77, 146, 160, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, view.cell * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(252, 252, 248, 0.72)";
      ctx.font = "800 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), 0, view.cell * 0.32);
      ctx.restore();
    });
  }

  function emitCellParticles(pos, color, count) {
    const center = cellCenter(pos);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 28 + Math.random() * 80;
      state.particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.32 + Math.random() * 0.35,
        size: 2 + Math.random() * 4,
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

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.width = rect.width;
    view.height = rect.height;
    view.cell = Math.floor(Math.min(rect.width - 38, rect.height - 38) / SIZE);
    view.ox = (rect.width - view.cell * SIZE) / 2;
    view.oy = (rect.height - view.cell * SIZE) / 2;
    draw();
  }

  function handleCanvasTap(event) {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
      return;
    }
    if (state.phase !== "playing") {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left - view.ox) / view.cell);
    const y = Math.floor((event.clientY - rect.top - view.oy) / view.cell);
    const index = state.mirrors.findIndex((mirror) => mirror.x === x && mirror.y === y);
    if (index >= 0) {
      rotateMirror(index);
    } else {
      setMessage("거울 노드만 회전할 수 있습니다.");
    }
  }

  function updateHud() {
    ui.round.textContent = String(state.round);
    ui.turn.textContent = String(state.turns);
    ui.limit.textContent = String(state.limit);
    ui.link.textContent = `${Math.min(100, Math.round((state.beam.length / 10) * 100))}%`;
    ui.mirror.textContent = String(state.mirrors.length);
  }

  function edgePoint(source) {
    const virtual = { x: source.x, y: source.y };
    if (source.x < 0) {
      return { x: view.ox - 14, y: view.oy + source.y * view.cell + view.cell / 2 };
    }
    if (source.x >= SIZE) {
      return { x: view.ox + SIZE * view.cell + 14, y: view.oy + source.y * view.cell + view.cell / 2 };
    }
    if (source.y < 0) {
      return { x: view.ox + source.x * view.cell + view.cell / 2, y: view.oy - 14 };
    }
    return { x: view.ox + source.x * view.cell + view.cell / 2, y: view.oy + SIZE * view.cell + 14 };
  }

  function cellCenter(pos) {
    return {
      x: view.ox + pos.x * view.cell + view.cell / 2,
      y: view.oy + pos.y * view.cell + view.cell / 2
    };
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

  function findMirror(x, y) {
    return state.mirrors.find((mirror) => mirror.x === x && mirror.y === y);
  }

  function inside(x, y) {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }

  function key(x, y) {
    return `${x},${y}`;
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
    handleCanvasTap(event);
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
  traceBeam();
  updateHud();
})();
