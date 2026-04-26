(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    round: document.getElementById("roundValue"),
    move: document.getElementById("moveValue"),
    limit: document.getElementById("limitValue"),
    stability: document.getElementById("stabilityValue"),
    sync: document.getElementById("syncValue"),
    message: document.getElementById("messageLine"),
    overlay: document.getElementById("overlay"),
    overlayLabel: document.getElementById("overlayLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton")
  };

  const SIZE = 7;
  const MAX_STABILITY = 3;
  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  const BASE_LEVELS = [
    {
      left: [1, 5],
      right: [5, 5],
      leftGate: [3, 2],
      rightGate: [3, 2],
      blocks: [[2, 4], [4, 4], [3, 5]]
    },
    {
      left: [0, 6],
      right: [6, 6],
      leftGate: [2, 1],
      rightGate: [4, 1],
      blocks: [[1, 3], [2, 3], [4, 3], [5, 3], [3, 4]]
    },
    {
      left: [1, 6],
      right: [5, 6],
      leftGate: [1, 1],
      rightGate: [5, 1],
      blocks: [[3, 1], [3, 2], [3, 3], [1, 4], [5, 4]]
    },
    {
      left: [0, 5],
      right: [6, 5],
      leftGate: [3, 0],
      rightGate: [3, 0],
      blocks: [[2, 2], [4, 2], [2, 3], [4, 3], [3, 5]]
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
  let pointerStart = null;

  function createState() {
    return {
      phase: "idle",
      round: 1,
      moves: 0,
      limit: getMoveLimit(1),
      stability: MAX_STABILITY,
      left: { x: 1, y: 5 },
      right: { x: 5, y: 5 },
      leftGate: { x: 3, y: 2 },
      rightGate: { x: 3, y: 2 },
      blocks: new Set(),
      particles: [],
      pulse: 0,
      shake: 0
    };
  }

  function getMoveLimit(round) {
    return Math.max(12, 20 - Math.floor(round * 1.2));
  }

  function startRun() {
    startRound(1);
    hideOverlay();
    ensureLoop();
  }

  function startRound(round) {
    const level = BASE_LEVELS[(round - 1) % BASE_LEVELS.length];
    const extra = Math.floor((round - 1) / BASE_LEVELS.length);
    state.phase = "playing";
    state.round = round;
    state.moves = 0;
    state.limit = getMoveLimit(round);
    state.stability = MAX_STABILITY;
    state.left = point(level.left);
    state.right = point(level.right);
    state.leftGate = point(level.leftGate);
    state.rightGate = point(level.rightGate);
    state.blocks = new Set(level.blocks.map(keyFromArray));
    addRoundBlocks(extra);
    state.particles = [];
    state.pulse = 0;
    state.shake = 0;
    setMessage(`라운드 ${round}: 두 코어를 동시에 게이트에 맞추세요.`);
    updateHud();
  }

  function addRoundBlocks(extra) {
    const additions = [
      [0, 3], [6, 3], [3, 6], [2, 0], [4, 0], [1, 2], [5, 2]
    ];
    for (let i = 0; i < Math.min(extra, additions.length); i += 1) {
      const key = keyFromArray(additions[i]);
      if (!isProtected(additions[i][0], additions[i][1])) {
        state.blocks.add(key);
      }
    }
  }

  function isProtected(x, y) {
    const protectedKeys = [
      key(state.left.x, state.left.y),
      key(state.right.x, state.right.y),
      key(state.leftGate.x, state.leftGate.y),
      key(state.rightGate.x, state.rightGate.y)
    ];
    return protectedKeys.includes(key(x, y));
  }

  function point(pair) {
    return { x: pair[0], y: pair[1] };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    view.width = rect.width;
    view.height = rect.height;
    view.cell = Math.floor(Math.min(rect.width - 34, rect.height - 34) / SIZE);
    view.ox = (rect.width - view.cell * SIZE) / 2;
    view.oy = (rect.height - view.cell * SIZE) / 2;
  }

  function move(dirName) {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
      return;
    }
    if (state.phase !== "playing") {
      return;
    }

    const dir = DIRS[dirName];
    const leftNext = { x: state.left.x + dir.x, y: state.left.y + dir.y };
    const rightNext = { x: state.right.x - dir.x, y: state.right.y + dir.y };
    const leftBlocked = isBlocked(leftNext);
    const rightBlocked = isBlocked(rightNext);

    state.moves += 1;
    if (!leftBlocked) {
      state.left = leftNext;
    }
    if (!rightBlocked) {
      state.right = rightNext;
    }

    if (leftBlocked || rightBlocked) {
      state.stability -= 1;
      state.shake = 1;
      emitCellParticles(leftBlocked ? state.left : state.right, "#b45e69", 12);
      setMessage(`장벽에 닿았습니다. 안정도 ${Math.max(0, state.stability)} 남음.`);
      if (state.stability <= 0) {
        failRun("두 코어의 동기화가 무너졌습니다.");
        return;
      }
    } else {
      setMessage("동기 이동 완료. 두 게이트까지의 거리를 맞춰 보세요.");
    }

    if (isClear()) {
      clearRound();
      return;
    }

    if (state.moves >= state.limit) {
      failRun("이동 제한을 넘겼습니다.");
      return;
    }

    updateHud();
  }

  function isBlocked(pos) {
    return pos.x < 0 || pos.x >= SIZE || pos.y < 0 || pos.y >= SIZE || state.blocks.has(key(pos.x, pos.y));
  }

  function isClear() {
    return state.left.x === state.leftGate.x
      && state.left.y === state.leftGate.y
      && state.right.x === state.rightGate.x
      && state.right.y === state.rightGate.y;
  }

  function clearRound() {
    state.phase = "cleared";
    emitCellParticles(state.left, "#4d8fa0", 22);
    emitCellParticles(state.right, "#c4914b", 22);
    setMessage(`라운드 ${state.round} 동기화 완료. 다음 라운드로 이동합니다.`);
    updateHud();
    window.setTimeout(() => {
      if (state.phase === "cleared") {
        startRound(state.round + 1);
      }
    }, 720);
  }

  function failRun(reason) {
    state.phase = "failed";
    state.round = 1;
    state.moves = 0;
    state.limit = getMoveLimit(1);
    setMessage(`${reason} 다음 시도는 라운드 1부터 시작합니다.`);
    updateHud();
    showOverlay(
      "Run Reset",
      "라운드 1로 복귀",
      "오른쪽 코어는 좌우가 반전됩니다. 위아래는 같이 움직이므로 먼저 높이를 맞추고, 좌우 거리를 마지막에 조정하세요.",
      "라운드 1 다시 시작"
    );
  }

  function update(delta) {
    state.pulse += delta;
    state.shake = Math.max(0, state.shake - delta * 3);
    updateParticles(delta);
  }

  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    drawBackground();
    drawGrid();
    drawGates();
    drawBlocks();
    drawParticles();
    drawCore(state.left, "#4d8fa0", "L");
    drawCore(state.right, "#c4914b", "R");
    drawMirrorLine();
  }

  function drawBackground() {
    const offset = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 7 : 0;
    ctx.save();
    ctx.translate(offset, 0);
    const gradient = ctx.createLinearGradient(0, 0, view.width, view.height);
    gradient.addColorStop(0, "#252823");
    gradient.addColorStop(0.58, "#191b18");
    gradient.addColorStop(1, "#10120f");
    ctx.fillStyle = gradient;
    ctx.fillRect(-12, 0, view.width + 24, view.height);
    ctx.restore();
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

  function drawGates() {
    drawGate(state.leftGate, "#4d8fa0", "L");
    drawGate(state.rightGate, "#c4914b", "R");
  }

  function drawGate(pos, color, label) {
    const center = cellCenter(pos);
    const pulse = Math.sin(state.pulse * 4) * 0.5 + 0.5;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.72 + pulse * 0.2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, view.cell * (0.28 + pulse * 0.04), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(252, 252, 248, 0.72)";
    ctx.font = "800 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, center.x, center.y);
    ctx.restore();
  }

  function drawBlocks() {
    ctx.save();
    ctx.fillStyle = "rgba(252, 252, 248, 0.14)";
    ctx.strokeStyle = "rgba(252, 252, 248, 0.28)";
    for (const blockKey of state.blocks) {
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

  function drawCore(pos, color, label) {
    const center = cellCenter(pos);
    ctx.save();
    const glow = ctx.createRadialGradient(center.x, center.y, 2, center.x, center.y, view.cell * 0.48);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(center.x, center.y, view.cell * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fcfcf8";
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, view.cell * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111311";
    ctx.font = "900 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, center.x, center.y + 1);
    ctx.restore();
  }

  function drawMirrorLine() {
    const x = view.ox + view.cell * 3.5;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -state.pulse * 18;
    ctx.strokeStyle = "rgba(252, 252, 248, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, view.oy);
    ctx.lineTo(x, view.oy + SIZE * view.cell);
    ctx.stroke();
    ctx.restore();
  }

  function emitCellParticles(pos, color, count) {
    const center = cellCenter(pos);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 32 + Math.random() * 90;
      state.particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.35,
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

  function updateHud() {
    ui.round.textContent = String(state.round);
    ui.move.textContent = String(state.moves);
    ui.limit.textContent = String(state.limit);
    ui.stability.textContent = String(Math.max(0, state.stability));
    ui.sync.textContent = `${getSyncPercent()}%`;
  }

  function getSyncPercent() {
    const leftDist = Math.abs(state.left.x - state.leftGate.x) + Math.abs(state.left.y - state.leftGate.y);
    const rightDist = Math.abs(state.right.x - state.rightGate.x) + Math.abs(state.right.y - state.rightGate.y);
    return Math.max(0, Math.round(100 - (leftDist + rightDist) * 12.5));
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

  function key(x, y) {
    return `${x},${y}`;
  }

  function keyFromArray(pair) {
    return key(pair[0], pair[1]);
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

  function handlePointerDirection(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.hypot(dx, dy) < 26) {
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
    }
    const rect = canvas.getBoundingClientRect();
    pointerStart = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!pointerStart) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const end = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    handlePointerDirection(pointerStart, end);
    pointerStart = null;
  });

  document.querySelectorAll("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => move(button.dataset.dir));
  });

  ui.startButton.addEventListener("click", startRun);
  ui.resetButton.addEventListener("click", startRun);

  window.addEventListener("keydown", (event) => {
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right"
    };
    const dir = map[event.key] || map[event.key.toLowerCase()];
    if (dir) {
      event.preventDefault();
      move(dir);
    }
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

  window.addEventListener("resize", () => {
    resizeCanvas();
    draw();
  });

  resizeCanvas();
  updateHud();
  draw();
})();
