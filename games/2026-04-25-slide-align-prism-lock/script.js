(() => {
  const SIZE = 4;
  const EMPTY = 0;
  const COLORS = ["cyan", "green", "amber", "rose", "violet"];
  const boardElement = document.getElementById("board");
  const targetGrid = document.getElementById("targetGrid");

  const ui = {
    round: document.getElementById("roundValue"),
    moves: document.getElementById("movesValue"),
    limit: document.getElementById("limitValue"),
    match: document.getElementById("matchValue"),
    chain: document.getElementById("chainValue"),
    message: document.getElementById("messageLine"),
    overlay: document.getElementById("overlay"),
    overlayLabel: document.getElementById("overlayLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton")
  };

  const solvedBoard = [
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, EMPTY
  ];

  let state = createState();
  let pointerStart = null;

  function createState() {
    return {
      phase: "idle",
      round: 1,
      board: [...solvedBoard],
      moves: 0,
      limit: getMoveLimit(1),
      chain: 0,
      lastMatch: 0
    };
  }

  function getMoveLimit(round) {
    return Math.max(18, 30 - Math.floor(round * 1.7));
  }

  function getShuffleSteps(round) {
    return 9 + round * 4;
  }

  function startRun() {
    startRound(1);
    hideOverlay();
  }

  function startRound(round) {
    state.phase = "playing";
    state.round = round;
    state.moves = 0;
    state.limit = getMoveLimit(round);
    state.chain = 0;
    state.board = makePuzzle(round);
    state.lastMatch = countMatches();
    setMessage(`라운드 ${round}: ${state.limit}번 안에 목표 패턴을 맞추세요.`);
    render();
  }

  function makePuzzle(round) {
    let board = [...solvedBoard];
    let previousEmpty = -1;
    const steps = getShuffleSteps(round);

    for (let step = 0; step < steps; step += 1) {
      const emptyIndex = board.indexOf(EMPTY);
      const candidates = getNeighborIndexes(emptyIndex).filter((index) => index !== previousEmpty);
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      previousEmpty = emptyIndex;
      board = slideSingle(board, choice);
    }

    if (isSolved(board)) {
      return makePuzzle(round + 1);
    }
    return board;
  }

  function getNeighborIndexes(index) {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const indexes = [];
    if (row > 0) indexes.push(index - SIZE);
    if (row < SIZE - 1) indexes.push(index + SIZE);
    if (col > 0) indexes.push(index - 1);
    if (col < SIZE - 1) indexes.push(index + 1);
    return indexes;
  }

  function slideSingle(board, tileIndex) {
    const next = [...board];
    const emptyIndex = next.indexOf(EMPTY);
    next[emptyIndex] = next[tileIndex];
    next[tileIndex] = EMPTY;
    return next;
  }

  function attemptMove(tileIndex) {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
      return;
    }
    if (state.phase !== "playing") {
      return;
    }

    const emptyIndex = state.board.indexOf(EMPTY);
    const tileRow = Math.floor(tileIndex / SIZE);
    const tileCol = tileIndex % SIZE;
    const emptyRow = Math.floor(emptyIndex / SIZE);
    const emptyCol = emptyIndex % SIZE;

    if (tileRow !== emptyRow && tileCol !== emptyCol) {
      setMessage("빈 칸과 같은 행 또는 열에 있는 프리즘만 밀 수 있습니다.");
      return;
    }

    const before = state.lastMatch;
    state.board = slideLine(state.board, tileIndex, emptyIndex);
    state.moves += 1;
    state.lastMatch = countMatches();
    state.chain = state.lastMatch > before ? state.chain + 1 : 0;

    if (isSolved(state.board)) {
      clearRound();
      return;
    }

    if (state.moves >= state.limit) {
      failRun();
      return;
    }

    const gain = state.lastMatch - before;
    if (gain > 0) {
      setMessage(`정렬이 ${gain}칸 개선됐습니다. 연쇄 ${state.chain}.`);
    } else if (gain < 0) {
      setMessage("패턴에서 멀어졌습니다. 빈 칸 위치를 다시 잡으세요.");
    } else {
      setMessage("프리즘을 이동했습니다. 목표 패턴과 빈 칸 위치를 같이 보세요.");
    }
    render();
  }

  function slideLine(board, tileIndex, emptyIndex) {
    const next = [...board];
    const tileRow = Math.floor(tileIndex / SIZE);
    const tileCol = tileIndex % SIZE;
    const emptyRow = Math.floor(emptyIndex / SIZE);
    const emptyCol = emptyIndex % SIZE;

    if (tileRow === emptyRow) {
      const direction = tileCol < emptyCol ? 1 : -1;
      for (let col = emptyCol; col !== tileCol; col -= direction) {
        next[tileRow * SIZE + col] = next[tileRow * SIZE + col - direction];
      }
      next[tileIndex] = EMPTY;
      return next;
    }

    const direction = tileRow < emptyRow ? 1 : -1;
    for (let row = emptyRow; row !== tileRow; row -= direction) {
      next[row * SIZE + tileCol] = next[(row - direction) * SIZE + tileCol];
    }
    next[tileIndex] = EMPTY;
    return next;
  }

  function moveEmptyByDirection(dx, dy) {
    if (state.phase === "idle" || state.phase === "failed") {
      startRun();
      return;
    }
    if (state.phase !== "playing") {
      return;
    }
    const emptyIndex = state.board.indexOf(EMPTY);
    const row = Math.floor(emptyIndex / SIZE);
    const col = emptyIndex % SIZE;
    const tileRow = row - dy;
    const tileCol = col - dx;
    if (tileRow < 0 || tileRow >= SIZE || tileCol < 0 || tileCol >= SIZE) {
      return;
    }
    attemptMove(tileRow * SIZE + tileCol);
  }

  function clearRound() {
    state.phase = "cleared";
    state.chain += 1;
    setMessage(`라운드 ${state.round} 정렬 완료. 다음 라운드는 더 많이 섞이고 이동 제한이 줄어듭니다.`);
    render();
    window.setTimeout(() => {
      if (state.phase === "cleared") {
        startRound(state.round + 1);
      }
    }, 720);
  }

  function failRun() {
    state.phase = "failed";
    state.round = 1;
    state.chain = 0;
    setMessage("이동 제한을 넘겼습니다. 다음 시도는 라운드 1부터 시작합니다.");
    render();
    showOverlay(
      "Run Reset",
      "라운드 1로 복귀",
      "같은 행이나 열 전체가 밀리므로, 빈 칸을 먼저 원하는 축으로 옮겨 두는 것이 핵심입니다.",
      "라운드 1 다시 시작"
    );
  }

  function countMatches() {
    return state.board.reduce((total, value, index) => {
      if (value !== EMPTY && value === solvedBoard[index]) {
        return total + 1;
      }
      return total;
    }, 0);
  }

  function isSolved(board) {
    return board.every((value, index) => value === solvedBoard[index]);
  }

  function render() {
    renderBoard();
    renderTarget();
    updateHud();
  }

  function renderBoard() {
    boardElement.innerHTML = "";
    const emptyIndex = state.board.indexOf(EMPTY);
    const emptyRow = Math.floor(emptyIndex / SIZE);
    const emptyCol = emptyIndex % SIZE;

    state.board.forEach((value, index) => {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      if (value === EMPTY) {
        const empty = document.createElement("div");
        empty.className = "empty-cell";
        empty.setAttribute("aria-label", "빈 칸");
        boardElement.appendChild(empty);
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = `tile tile-${getColor(value)}`;
      if (value === solvedBoard[index]) {
        button.classList.add("matched");
      }
      button.textContent = getSymbol(value);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `${value}번 프리즘`);
      button.disabled = state.phase !== "playing";
      button.addEventListener("click", () => attemptMove(index));
      if (row !== emptyRow && col !== emptyCol) {
        button.style.opacity = "0.58";
      }
      boardElement.appendChild(button);
    });
  }

  function renderTarget() {
    targetGrid.innerHTML = "";
    solvedBoard.forEach((value) => {
      const cell = document.createElement("div");
      if (value === EMPTY) {
        cell.className = "mini-cell empty-cell";
      } else {
        cell.className = `mini-cell tile-${getColor(value)}`;
        cell.textContent = getSymbol(value);
      }
      targetGrid.appendChild(cell);
    });
  }

  function updateHud() {
    ui.round.textContent = String(state.round);
    ui.moves.textContent = String(state.moves);
    ui.limit.textContent = String(state.limit);
    ui.match.textContent = String(countMatches());
    ui.chain.textContent = String(state.chain);
  }

  function getColor(value) {
    return COLORS[(value - 1) % COLORS.length];
  }

  function getSymbol(value) {
    const symbols = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
    return symbols[value - 1];
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

  function pointerPosition(event) {
    const rect = boardElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  boardElement.addEventListener("pointerdown", (event) => {
    pointerStart = pointerPosition(event);
  });

  boardElement.addEventListener("pointerup", (event) => {
    if (!pointerStart) {
      return;
    }
    const end = pointerPosition(event);
    const dx = end.x - pointerStart.x;
    const dy = end.y - pointerStart.y;
    pointerStart = null;
    if (Math.hypot(dx, dy) < 34) {
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      moveEmptyByDirection(dx > 0 ? 1 : -1, 0);
    } else {
      moveEmptyByDirection(0, dy > 0 ? 1 : -1);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      moveEmptyByDirection(-1, 0);
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      moveEmptyByDirection(1, 0);
    }
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      event.preventDefault();
      moveEmptyByDirection(0, -1);
    }
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      event.preventDefault();
      moveEmptyByDirection(0, 1);
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

  ui.startButton.addEventListener("click", startRun);
  ui.resetButton.addEventListener("click", startRun);

  render();
})();
