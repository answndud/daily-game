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
    button.setAttribute("aria-label", `Board cell ${index + 1}`);
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
    timeValueEl.textContent = `${state.waveTimeLeft.toFixed(1)}s`;
    scoreValueEl.textContent = String(state.cleaned);
    shieldValueEl.textContent = state.shieldReady ? "READY" : `${state.shieldCharge} / ${SHIELD_TARGET}`;
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
      setMessage("Shield ready. The next spread will fizzle out.");
    } else {
      setMessage(`Perfect cleanse. Shield charge ${state.shieldCharge}/${SHIELD_TARGET}.`);
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

    setMessage("Ribbon shield fired. The next spread was canceled.");
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
        "Ribbon Overflow",
        "Too many cells were infected at once. Start again and bank quick perfect cleanses for shield control.",
        "Try Again"
      );
      setMessage("Board pressure broke the wave.");
      return;
    }

    if (state.wave >= TOTAL_WAVES) {
      showOverlay(
        "Board Saved",
        `You cleared all three waves and cleaned ${state.cleaned} cells. Run it again and chase a cleaner finish.`,
        "Play Again"
      );
      setMessage("All waves cleared.");
      return;
    }

    state.wave += 1;
    state.waveTimeLeft = WAVE_DURATION;
    state.shieldCharge = 0;
    state.shieldReady = false;
    resetBoard();
    updateHud();
    showOverlay(
      `Wave ${state.wave}`,
      "The ribbon is moving faster now. Tap fresh outbreaks quickly to earn another shield.",
      "Continue"
    );
    setMessage(`Wave ${state.wave} is ready.`);
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
    setMessage(state.wave === 1 ? "Wave one started. Tap new outbreaks fast." : `Wave ${state.wave} started.`);
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
      "Start Wave One",
      "Tap infected cells before they spread. Fast taps earn shield charge. Clear three short waves to win.",
      "Start"
    );
    setMessage("Tap start, then keep the ribbon under control.");
  }

  function handleCellTap(event) {
    if (state.boardLocked || !state.gameActive) {
      return;
    }

    const index = Number(event.currentTarget.dataset.index);
    const cell = state.cells[index];
    if (!cell.infected) {
      setMessage("Tap the bright infected cells, not the quiet ones.");
      return;
    }

    const age = performance.now() - cell.infectedAt;
    clearCell(index, "tap");
    if (age <= PERFECT_WINDOW_MS) {
      chargeShield();
    } else {
      setMessage("Cleanse landed. A faster tap would have charged the shield.");
    }
    updateHud();
  }

  overlayButtonEl.addEventListener("click", startWave);
  restartButtonEl.addEventListener("click", resetGame);

  buildBoard();
  resetGame();
})();
