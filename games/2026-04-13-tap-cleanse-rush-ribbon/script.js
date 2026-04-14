"use strict";

(function initRushRibbon() {
  const ROWS = 7;
  const COLS = 5;
  const CELL_COUNT = ROWS * COLS;
  const TOTAL_WAVES = 3;
  const WAVE_DURATION = 18;
  const PERFECT_WINDOW_MS = 850;
  const SHIELD_TARGET = 3;
  const FAIL_THRESHOLD = 16;
  const WAVE_CONFIG = [
    { spreadEvery: 1500, seedEvery: 3200, startingCells: 2 },
    { spreadEvery: 1220, seedEvery: 2600, startingCells: 3 },
    { spreadEvery: 980, seedEvery: 2100, startingCells: 3 },
  ];

  const state = {
    cells: [],
    boardLocked: true,
    gameActive: false,
    wave: 1,
    waveTimeLeft: WAVE_DURATION,
    cleaned: 0,
    shieldCharge: 0,
    shieldReady: false,
    startTimestamp: 0,
    lastSpreadAt: 0,
    lastSeedAt: 0,
    rafId: 0,
    cleanseTimeouts: new Map(),
  };

  const boardEl = document.querySelector("#board");
  const messageLineEl = document.querySelector("#messageLine");
  const waveValueEl = document.querySelector("#waveValue");
  const timeValueEl = document.querySelector("#timeValue");
  const scoreValueEl = document.querySelector("#scoreValue");
  const shieldValueEl = document.querySelector("#shieldValue");
  const pressureValueEl = document.querySelector("#pressureValue");
  const pressureFillEl = document.querySelector("#pressureFill");
  const overlayEl = document.querySelector("#overlay");
  const overlayTitleEl = document.querySelector("#overlayTitle");
  const overlayTextEl = document.querySelector("#overlayText");
  const overlayButtonEl = document.querySelector("#overlayButton");
  const restartButtonEl = document.querySelector("#restartButton");

  function createCell(index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.index = String(index);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `보드 칸 ${index + 1}`);
    button.addEventListener("click", handleCellTap);
    boardEl.appendChild(button);
    return {
      infectedAt: 0,
      infected: false,
      element: button,
      neighbors: [],
    };
  }

  function buildBoard() {
    for (let index = 0; index < CELL_COUNT; index += 1) {
      state.cells.push(createCell(index));
    }

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const index = row * COLS + col;
        const neighbors = [];
        if (row > 0) neighbors.push(index - COLS);
        if (row < ROWS - 1) neighbors.push(index + COLS);
        if (col > 0) neighbors.push(index - 1);
        if (col < COLS - 1) neighbors.push(index + 1);
        state.cells[index].neighbors = neighbors;
      }
    }
  }

  function randomChoice(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function infectedIndices() {
    const indices = [];
    for (let index = 0; index < state.cells.length; index += 1) {
      if (state.cells[index].infected) {
        indices.push(index);
      }
    }
    return indices;
  }

  function cleanIndices() {
    const indices = [];
    for (let index = 0; index < state.cells.length; index += 1) {
      if (!state.cells[index].infected) {
        indices.push(index);
      }
    }
    return indices;
  }

  function setMessage(text) {
    messageLineEl.textContent = text;
  }

  function updateHud() {
    const infectedCount = infectedIndices().length;
    const pressure = Math.min(100, Math.round((infectedCount / FAIL_THRESHOLD) * 100));
    waveValueEl.textContent = `${state.wave} / ${TOTAL_WAVES}`;
    timeValueEl.textContent = `${state.waveTimeLeft.toFixed(1)}초`;
    scoreValueEl.textContent = String(state.cleaned);
    shieldValueEl.textContent = state.shieldReady ? "준비 완료" : `${state.shieldCharge} / ${SHIELD_TARGET}`;
    pressureValueEl.textContent = `${pressure}%`;
    pressureFillEl.style.width = `${pressure}%`;
    pressureFillEl.style.background = pressure > 68
      ? "linear-gradient(90deg, #ffb45e, #ff567e)"
      : "linear-gradient(90deg, #5de2ff, #ff567e)";
  }

  function showOverlay(title, text, buttonText) {
    overlayTitleEl.textContent = title;
    overlayTextEl.textContent = text;
    overlayButtonEl.textContent = buttonText;
    overlayEl.classList.add("is-visible");
  }

  function hideOverlay() {
    overlayEl.classList.remove("is-visible");
  }

  function setCellVisual(cell, variant) {
    cell.element.classList.toggle("is-infected", cell.infected);
    const age = performance.now() - cell.infectedAt;
    cell.element.classList.toggle("is-fresh", cell.infected && age <= PERFECT_WINDOW_MS);
    cell.element.classList.toggle("is-shielded", variant === "shielded");
  }

  function infectCell(index, timestamp) {
    const cell = state.cells[index];
    if (cell.infected) {
      return false;
    }
    cell.infected = true;
    cell.infectedAt = timestamp;
    setCellVisual(cell);
    return true;
  }

  function clearCell(index, reason) {
    const cell = state.cells[index];
    if (!cell.infected) {
      return false;
    }

    cell.infected = false;
    cell.infectedAt = 0;
    cell.element.classList.remove("is-infected", "is-fresh", "is-shielded");
    cell.element.classList.add("is-cleansing");
    const prior = state.cleanseTimeouts.get(index);
    if (prior) {
      window.clearTimeout(prior);
    }
    const timeoutId = window.setTimeout(() => {
      cell.element.classList.remove("is-cleansing");
      state.cleanseTimeouts.delete(index);
    }, 160);
    state.cleanseTimeouts.set(index, timeoutId);

    if (reason === "tap") {
      state.cleaned += 1;
    }

    return true;
  }

  function seedInitialInfections(timestamp) {
    const config = WAVE_CONFIG[state.wave - 1];
    const available = cleanIndices();
    const count = Math.min(config.startingCells, available.length);
    for (let placed = 0; placed < count; placed += 1) {
      const pick = randomChoice(available);
      infectCell(pick, timestamp);
      available.splice(available.indexOf(pick), 1);
    }
  }

  function chargeShield() {
    if (state.shieldReady) {
      return;
    }
    state.shieldCharge += 1;
    if (state.shieldCharge >= SHIELD_TARGET) {
      state.shieldCharge = SHIELD_TARGET;
      state.shieldReady = true;
      setMessage("실드 준비 완료. 다음 확산은 바로 꺼집니다.");
    } else {
      setMessage(`완벽 정화. 실드 충전 ${state.shieldCharge}/${SHIELD_TARGET}.`);
    }
  }

  function dischargeShield() {
    state.shieldReady = false;
    state.shieldCharge = 0;
    const infected = infectedIndices()
      .map((index) => ({ index, infectedAt: state.cells[index].infectedAt }))
      .sort((left, right) => left.infectedAt - right.infectedAt)
      .slice(0, 2);

    for (const item of infected) {
      clearCell(item.index, "shield");
      state.cells[item.index].element.classList.add("is-shielded");
      window.setTimeout(() => {
        state.cells[item.index].element.classList.remove("is-shielded");
      }, 260);
    }

    setMessage("리본 실드 발동. 다음 확산을 막았습니다.");
  }

  function trySpread(timestamp) {
    if (state.shieldReady) {
      dischargeShield();
      state.lastSpreadAt = timestamp;
      return;
    }

    const infected = infectedIndices();
    if (infected.length === 0) {
      const available = cleanIndices();
      if (available.length > 0) {
        infectCell(randomChoice(available), timestamp);
      }
      state.lastSpreadAt = timestamp;
      return;
    }

    const sourceIndex = randomChoice(infected);
    const source = state.cells[sourceIndex];
    const cleanNeighbors = source.neighbors.filter((index) => !state.cells[index].infected);

    if (cleanNeighbors.length > 0) {
      infectCell(randomChoice(cleanNeighbors), timestamp);
    } else {
      const available = cleanIndices();
      if (available.length > 0) {
        infectCell(randomChoice(available), timestamp);
      }
    }

    state.lastSpreadAt = timestamp;
  }

  function trySeed(timestamp) {
    const available = cleanIndices();
    if (available.length > 0) {
      infectCell(randomChoice(available), timestamp);
    }
    state.lastSeedAt = timestamp;
  }

  function resetBoard() {
    for (let index = 0; index < state.cells.length; index += 1) {
      clearCell(index, "reset");
      state.cells[index].element.classList.remove("is-fresh", "is-shielded");
    }
  }

  function endRound(result) {
    state.gameActive = false;
    state.boardLocked = true;
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    if (result === "lose") {
      showOverlay(
        "리본 범람",
        "한 번에 너무 많은 칸이 감염됐습니다. 다시 시작해서 빠른 완벽 정화로 실드를 먼저 준비하세요.",
        "다시 도전"
      );
      setMessage("보드 압력이 한계를 넘었습니다.");
      return;
    }

    if (state.wave >= TOTAL_WAVES) {
      showOverlay(
        "보드 복구 완료",
        `세 개의 웨이브를 모두 넘기고 ${state.cleaned}칸을 정화했습니다. 다시 플레이해서 더 깔끔한 운영에 도전해보세요.`,
        "다시 플레이"
      );
      setMessage("모든 웨이브를 정리했습니다.");
      return;
    }

    state.wave += 1;
    state.waveTimeLeft = WAVE_DURATION;
    state.shieldCharge = 0;
    state.shieldReady = false;
    resetBoard();
    updateHud();
    showOverlay(
      `웨이브 ${state.wave}`,
      "이제 번짐 속도가 더 빨라집니다. 새로 생긴 칸을 빠르게 눌러 다시 실드를 충전하세요.",
      "계속"
    );
    setMessage(`웨이브 ${state.wave} 준비 완료.`);
  }

  function handleCollapseCheck() {
    const infectedCount = infectedIndices().length;
    if (infectedCount >= FAIL_THRESHOLD) {
      endRound("lose");
      return true;
    }
    return false;
  }

  function tick(timestamp) {
    if (!state.gameActive) {
      return;
    }

    const config = WAVE_CONFIG[state.wave - 1];
    if (!state.startTimestamp) {
      state.startTimestamp = timestamp;
      state.lastSpreadAt = timestamp;
      state.lastSeedAt = timestamp;
      seedInitialInfections(timestamp);
    }

    if (timestamp - state.lastSpreadAt >= config.spreadEvery) {
      trySpread(timestamp);
    }

    if (timestamp - state.lastSeedAt >= config.seedEvery) {
      trySeed(timestamp);
    }

    state.waveTimeLeft = Math.max(0, WAVE_DURATION - (timestamp - state.startTimestamp) / 1000);

    for (const cell of state.cells) {
      if (cell.infected) {
        setCellVisual(cell);
      }
    }

    updateHud();

    if (handleCollapseCheck()) {
      return;
    }

    if (state.waveTimeLeft <= 0) {
      endRound("advance");
      return;
    }

    state.rafId = window.requestAnimationFrame(tick);
  }

  function startWave() {
    hideOverlay();
    resetBoard();
    state.boardLocked = false;
    state.gameActive = true;
    state.startTimestamp = 0;
    state.lastSpreadAt = 0;
    state.lastSeedAt = 0;
    state.rafId = window.requestAnimationFrame(tick);
    setMessage(state.wave === 1 ? "웨이브 1 시작. 새 번짐을 빠르게 탭하세요." : `웨이브 ${state.wave} 시작.`);
  }

  function resetGame() {
    state.gameActive = false;
    state.boardLocked = true;
    state.wave = 1;
    state.waveTimeLeft = WAVE_DURATION;
    state.cleaned = 0;
    state.shieldCharge = 0;
    state.shieldReady = false;
    state.startTimestamp = 0;
    state.lastSpreadAt = 0;
    state.lastSeedAt = 0;
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    resetBoard();
    updateHud();
    showOverlay(
      "웨이브 1 시작",
      "감염된 칸이 퍼지기 전에 탭하세요. 빠른 탭일수록 실드가 차고, 짧은 웨이브 세 개를 버티면 승리합니다.",
      "시작"
    );
    setMessage("시작을 누르면 번짐을 바로 정리하세요.");
  }

  function handleCellTap(event) {
    if (state.boardLocked || !state.gameActive) {
      return;
    }

    const index = Number(event.currentTarget.dataset.index);
    const cell = state.cells[index];
    if (!cell.infected) {
      setMessage("조용한 칸 말고 밝게 감염된 칸을 눌러야 합니다.");
      return;
    }

    const age = performance.now() - cell.infectedAt;
    clearCell(index, "tap");
    if (age <= PERFECT_WINDOW_MS) {
      chargeShield();
    } else {
      setMessage("정화는 성공했습니다. 더 빨랐다면 실드가 충전됐습니다.");
    }
    updateHud();
  }

  overlayButtonEl.addEventListener("click", startWave);
  restartButtonEl.addEventListener("click", resetGame);

  buildBoard();
  resetGame();
})();
