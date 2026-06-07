(function () {
  "use strict";

  const DIRS = ["N", "E", "S", "W"];
  const DIR_VECTORS = {
    N: { x: 0, y: -1 },
    E: { x: 1, y: 0 },
    S: { x: 0, y: 1 },
    W: { x: -1, y: 0 }
  };
  const DIR_INDEX = { N: 0, E: 1, S: 2, W: 3 };
  const OPPOSITE = { N: "S", E: "W", S: "N", W: "E" };
  const SHAPE_PORTS = {
    end: ["E"],
    straight: ["E", "W"],
    corner: ["E", "S"],
    tee: ["N", "E", "S"]
  };

  const LEVELS = [
    {
      width: 3,
      height: 2,
      source: { x: 0, y: 1 },
      goals: [{ x: 2, y: 0 }, { x: 2, y: 1 }],
      edges: [
        [0, 1, 1, 1],
        [1, 1, 2, 1],
        [1, 1, 1, 0],
        [1, 0, 2, 0]
      ],
      scrambleBudget: 5,
      turnLimit: 8
    },
    {
      width: 4,
      height: 3,
      source: { x: 0, y: 1 },
      goals: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }],
      edges: [
        [0, 1, 1, 1],
        [1, 1, 2, 1],
        [2, 1, 3, 1],
        [1, 1, 1, 0],
        [1, 0, 2, 0],
        [2, 0, 3, 0],
        [2, 1, 2, 2],
        [2, 2, 3, 2]
      ],
      scrambleBudget: 7,
      turnLimit: 11
    },
    {
      width: 4,
      height: 3,
      source: { x: 0, y: 1 },
      goals: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }],
      edges: [
        [0, 1, 1, 1],
        [1, 1, 1, 2],
        [1, 2, 2, 2],
        [2, 2, 3, 2],
        [1, 1, 2, 1],
        [2, 1, 2, 0],
        [2, 0, 3, 0],
        [2, 1, 3, 1]
      ],
      scrambleBudget: 8,
      turnLimit: 12
    },
    {
      width: 5,
      height: 4,
      source: { x: 0, y: 1 },
      goals: [{ x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }],
      edges: [
        [0, 1, 1, 1],
        [1, 1, 2, 1],
        [2, 1, 3, 1],
        [3, 1, 4, 1],
        [1, 1, 1, 0],
        [1, 0, 2, 0],
        [2, 0, 3, 0],
        [3, 0, 4, 0],
        [2, 1, 2, 2],
        [2, 2, 3, 2],
        [3, 2, 4, 2],
        [3, 2, 3, 3],
        [3, 3, 4, 3]
      ],
      scrambleBudget: 10,
      turnLimit: 15
    }
  ];

  const roundText = document.querySelector("#roundText");
  const turnText = document.querySelector("#turnText");
  const goalText = document.querySelector("#goalText");
  const boardText = document.querySelector("#boardText");
  const boardCode = document.querySelector("#boardCode");
  const board = document.querySelector("#board");
  const statusText = document.querySelector("#statusText");
  const restartButton = document.querySelector("#restartButton");

  const state = {
    round: 1,
    turnsLeft: 0,
    solved: false,
    tiles: [],
    goalsConnected: 0,
    activeCount: 0,
    timer: 0
  };

  function createRng(seed) {
    let value = seed % 2147483647;
    if (value <= 0) {
      value += 2147483646;
    }
    return function next() {
      value = value * 16807 % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function toKey(x, y) {
    return `${x},${y}`;
  }

  function getLevel() {
    return LEVELS[Math.min(state.round - 1, LEVELS.length - 1)];
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function portsFor(shape, rotation) {
    return SHAPE_PORTS[shape].map((dir) => DIRS[(DIR_INDEX[dir] + rotation) % 4]);
  }

  function shapeForPorts(ports) {
    const sorted = [...ports].sort().join("");
    if (sorted === "E") {
      return { shape: "end", rotation: 0 };
    }
    if (sorted === "EW") {
      return { shape: "straight", rotation: 0 };
    }
    if (sorted === "ES") {
      return { shape: "corner", rotation: 0 };
    }
    if (sorted === "ENS") {
      return { shape: "tee", rotation: 0 };
    }
    for (const shape of Object.keys(SHAPE_PORTS)) {
      for (let rotation = 0; rotation < 4; rotation += 1) {
        const rotated = portsFor(shape, rotation).slice().sort().join("");
        if (rotated === sorted) {
          return { shape, rotation };
        }
      }
    }
    return null;
  }

  function buildCellMap(level) {
    const map = new Map();
    level.edges.forEach(([ax, ay, bx, by]) => {
      const aKey = toKey(ax, ay);
      const bKey = toKey(bx, by);
      if (!map.has(aKey)) {
        map.set(aKey, new Set());
      }
      if (!map.has(bKey)) {
        map.set(bKey, new Set());
      }
      const aSet = map.get(aKey);
      const bSet = map.get(bKey);
      if (ax === bx && Math.abs(ay - by) === 1) {
        aSet.add(ay < by ? "S" : "N");
        bSet.add(ay < by ? "N" : "S");
      }
      if (ay === by && Math.abs(ax - bx) === 1) {
        aSet.add(ax < bx ? "E" : "W");
        bSet.add(ax < bx ? "W" : "E");
      }
    });
    return map;
  }

  function buildTiles(level) {
    const rng = createRng(20260607 + state.round * 97);
    const cells = buildCellMap(level);
    const tiles = [];
    const activeTiles = [];

    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const key = toKey(x, y);
        const ports = cells.get(key);
        if (!ports) {
          tiles.push(null);
          continue;
        }

        const solvedPorts = [...ports];
        const solvedState = shapeForPorts(solvedPorts);
        if (!solvedState) {
          throw new Error(`Unsupported tile at ${key}`);
        }
        tiles.push({
          x,
          y,
          shape: solvedState.shape,
          solvedRotation: solvedState.rotation,
          turn: solvedState.rotation,
          ports: solvedPorts,
          active: true,
          index: activeTiles.length
        });
        activeTiles.push(tiles.length - 1);
      }
    }

    const budget = Math.min(level.scrambleBudget, activeTiles.length);
    let remaining = budget;
    const shuffled = activeTiles.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const swapIndex = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[i]];
    }
    for (let i = 0; i < budget; i += 1) {
      const tile = tiles[shuffled[i]];
      const tilesRemaining = budget - i - 1;
      const maxAllowed = remaining - tilesRemaining;
      if (maxAllowed < 1) {
        throw new Error("Invalid scramble budget");
      }
      const amount = 1 + Math.floor(rng() * Math.min(3, maxAllowed));
      tile.turn = (tile.turn - amount + 4) % 4;
      remaining -= amount;
    }

    state.activeCount = activeTiles.length;
    return tiles;
  }

  function nodeIdSource(level) {
    return `source:${level.source.x},${level.source.y}`;
  }

  function nodeIdGoal(goal) {
    return `goal:${goal.x},${goal.y}`;
  }

  function getCurrentPorts(tile) {
    return portsFor(tile.shape, tile.turn);
  }

  function getNodeAt(level, x, y, dir) {
    if (dir === "W" && x === level.source.x && y === level.source.y) {
      return nodeIdSource(level);
    }
    const goal = level.goals.find((candidate) => candidate.x === x && candidate.y === y);
    if (goal && dir === "E") {
      return nodeIdGoal(goal);
    }
    return null;
  }

  function buildGraph(level) {
    const graph = new Map();
    const tileMap = new Map();
    state.tiles.forEach((tile) => {
      if (!tile) {
        return;
      }
      tileMap.set(toKey(tile.x, tile.y), tile);
    });

    function addEdge(a, b) {
      if (!graph.has(a)) {
        graph.set(a, new Set());
      }
      if (!graph.has(b)) {
        graph.set(b, new Set());
      }
      graph.get(a).add(b);
      graph.get(b).add(a);
    }

    state.tiles.forEach((tile) => {
      if (!tile) {
        return;
      }
      const currentPorts = getCurrentPorts(tile);
      const fromId = toKey(tile.x, tile.y);
      currentPorts.forEach((dir) => {
        const vector = DIR_VECTORS[dir];
        const nx = tile.x + vector.x;
        const ny = tile.y + vector.y;
        const neighbor = tileMap.get(toKey(nx, ny));
        if (neighbor) {
          const neighborPorts = getCurrentPorts(neighbor);
          if (neighborPorts.includes(OPPOSITE[dir])) {
            addEdge(fromId, toKey(nx, ny));
          }
          return;
        }
        const node = getNodeAt(level, tile.x, tile.y, dir);
        if (node) {
          addEdge(fromId, node);
        }
      });
    });

    return graph;
  }

  function reachableNodes(level) {
    const graph = buildGraph(level);
    const start = nodeIdSource(level);
    const seen = new Set([start]);
    const queue = [start];

    while (queue.length > 0) {
      const current = queue.shift();
      const nextNodes = graph.get(current);
      if (!nextNodes) {
        continue;
      }
      nextNodes.forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }

    return seen;
  }

  function updateHud() {
    const level = getLevel();
    roundText.textContent = String(state.round);
    turnText.textContent = `${Math.max(0, state.turnsLeft)} / ${level.turnLimit}`;
    goalText.textContent = `${state.goalsConnected} / ${level.goals.length}`;
    boardText.textContent = `${level.width}×${level.height}`;
    boardCode.textContent = `R${String(state.round).padStart(2, "0")}`;
  }

  function drawPortsSvg(tile, connected) {
    const currentPorts = getCurrentPorts(tile);
    const paths = currentPorts.map((dir) => {
      switch (dir) {
        case "N":
          return `<line x1="50" y1="50" x2="50" y2="12" class="pipe"/>`;
        case "E":
          return `<line x1="50" y1="50" x2="88" y2="50" class="pipe"/>`;
        case "S":
          return `<line x1="50" y1="50" x2="50" y2="88" class="pipe"/>`;
        case "W":
          return `<line x1="50" y1="50" x2="12" y2="50" class="pipe"/>`;
        default:
          return "";
      }
    }).join("");
    return `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="10" class="hub"/>
        ${paths}
      </svg>
    `;
  }

  function isSourceCell(level, x, y) {
    return level.source.x === x && level.source.y === y;
  }

  function isGoalCell(level, x, y) {
    return level.goals.some((goal) => goal.x === x && goal.y === y);
  }

  function renderBoard() {
    const level = getLevel();
    const connected = reachableNodes(level);
    state.goalsConnected = level.goals.filter((goal) => connected.has(nodeIdGoal(goal))).length;
    board.style.gridTemplateColumns = `repeat(${level.width}, minmax(0, 1fr))`;
    board.innerHTML = "";

    state.tiles.forEach((tile, index) => {
      if (!tile) {
        const filler = document.createElement("div");
        filler.className = "tile inactive";
        filler.setAttribute("aria-hidden", "true");
        board.appendChild(filler);
        return;
      }

      const key = toKey(tile.x, tile.y);
      const isConnected = connected.has(key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tile ${isConnected ? "connected" : ""}`;
      button.disabled = state.solved;
      button.dataset.index = String(index);
      button.setAttribute("aria-label", `${tile.x + 1},${tile.y + 1} 위치 회로 타일`);
      button.innerHTML = `
        <span class="index">${tile.index + 1}</span>
        ${isSourceCell(level, tile.x, tile.y) ? '<span class="badge source">출발</span>' : ""}
        ${isGoalCell(level, tile.x, tile.y) ? '<span class="badge goal">단자</span>' : ""}
        ${drawPortsSvg(tile, isConnected)}
      `;
      button.addEventListener("click", () => rotateTile(index));
      board.appendChild(button);
    });
  }

  function render() {
    const level = getLevel();
    updateHud();
    board.innerHTML = "";
    renderBoard();
    setStatus(state.solved ? `회로가 완성되었습니다. 다음 회로도로 이동합니다.` : `회전 ${Math.max(0, state.turnsLeft)}회를 남겼습니다.`);
    if (state.goalsConnected === level.goals.length && !state.solved) {
      state.solved = true;
      setStatus("모든 단자가 연결되었습니다. 다음 회로도로 이동합니다.");
      clearTimeout(state.timer);
      state.timer = setTimeout(() => advanceRound(), 420);
    }
    if (!state.solved && state.turnsLeft === 0 && state.goalsConnected < level.goals.length) {
      state.solved = true;
      setStatus("회전 횟수를 모두 사용했습니다. 라운드 1로 돌아갑니다.");
      clearTimeout(state.timer);
      state.timer = setTimeout(() => resetRun("실패했습니다. 라운드 1로 돌아갑니다."), 420);
    }
  }

  function createLevelState() {
    const level = getLevel();
    state.turnsLeft = level.turnLimit;
    state.solved = false;
    state.tiles = buildTiles(level);
    state.goalsConnected = 0;
    clearTimeout(state.timer);
    setStatus("회로를 복원하세요.");
    render();
  }

  function resetRun(message) {
    state.round = 1;
    clearTimeout(state.timer);
    createLevelState();
    setStatus(message || "라운드 1부터 다시 시작합니다.");
    render();
  }

  function advanceRound() {
    if (state.round < LEVELS.length) {
      state.round += 1;
    }
    createLevelState();
    setStatus(`회로 완성. 더 큰 회로도인 라운드 ${state.round}로 이동합니다.`);
    render();
  }

  function rotateTile(index) {
    if (state.solved) {
      return;
    }
    const tile = state.tiles[index];
    if (!tile) {
      return;
    }
    tile.turn = (tile.turn + 1) % 4;
    state.turnsLeft = Math.max(0, state.turnsLeft - 1);
    render();
  }

  restartButton.addEventListener("click", () => {
    resetRun("라운드 1부터 다시 시작합니다.");
  });

  document.addEventListener("keydown", (event) => {
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < state.tiles.length) {
        event.preventDefault();
        rotateTile(index);
      }
    }
  });

  createLevelState();
}());
