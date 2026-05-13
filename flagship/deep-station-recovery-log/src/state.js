import { createSector, TILE } from "./sectors.js";

export function createGameState(records) {
  return {
    phase: "idle",
    records,
    sector: createSector(1),
    drone: { x: 1, y: 1 },
    oxygen: 100,
    battery: 100,
    integrity: 100,
    powerOnline: false,
    oxygenOnline: false,
    terminalUsed: false,
    scanner: 100,
    scanPulseUntil: 0,
    explored: new Set(),
    message: "런 시작을 눌러 섹터 1을 시작하세요.",
    lastTick: 0,
  };
}

export function startRun(state) {
  state.records.runs += 1;
  loadSector(state, 1);
  state.phase = "running";
  state.message = "섹터 1 진입. 전력 릴레이와 산소 밸브를 복구하세요.";
}

export function loadSector(state, index) {
  state.sector = createSector(index);
  state.drone = { ...state.sector.start };
  state.oxygen = Math.max(64, 104 - index * 3);
  state.battery = Math.max(58, 100 - index * 4);
  state.integrity = 100;
  state.powerOnline = false;
  state.oxygenOnline = false;
  state.terminalUsed = false;
  state.scanner = 100;
  state.scanPulseUntil = 0;
  state.explored = new Set();
  state.lastTick = performance.now();
  revealAround(state);
}

export function step(state, dx, dy) {
  if (state.phase !== "running") {
    return;
  }
  const nx = state.drone.x + dx;
  const ny = state.drone.y + dy;
  const tile = getTile(state, nx, ny);
  if (tile === TILE.wall) {
    state.message = "두꺼운 격벽입니다. 우회 경로를 찾으세요.";
    return;
  }
  if (tile === TILE.door && !state.powerOnline) {
    state.message = "전력이 없어 문이 열리지 않습니다.";
    return;
  }

  state.drone.x = nx;
  state.drone.y = ny;
  drain(state, tile === TILE.water ? 3.2 : 1.4, tile === TILE.water ? 1.3 : 0.4);
  state.scanner = Math.min(100, state.scanner + 4);
  if (tile === TILE.hazard) {
    damage(state, 18, "전기 균열을 밟았습니다.");
  } else {
    state.message = describeTile(tile);
  }
  revealAround(state);
  checkExit(state);
}

export function interact(state) {
  if (state.phase !== "running") {
    return;
  }
  const tile = getTile(state, state.drone.x, state.drone.y);
  if (tile === TILE.relay) {
    if (state.battery < 12) {
      state.message = "배터리가 부족해 릴레이를 재기동할 수 없습니다.";
      return;
    }
    state.battery -= 12;
    state.powerOnline = true;
    unlockLog(state, "전력 릴레이 점화 기록");
    state.message = "전력 릴레이 복구. 잠긴 문과 출구 제어가 응답합니다.";
    return "repair";
  }
  if (tile === TILE.valve) {
    state.oxygenOnline = true;
    state.oxygen = Math.min(100, state.oxygen + 32);
    unlockLog(state, "산소 밸브 안정화 기록");
    state.message = "산소 밸브 복구. 산소 소모가 완화됩니다.";
    return "repair";
  }
  if (tile === TILE.terminal) {
    state.terminalUsed = true;
    state.battery = Math.min(100, state.battery + 18);
    revealAll(state);
    unlockLog(state, `섹터 ${state.sector.index} 지도 조각`);
    state.message = "터미널 접속. 지도와 예비 전력을 확보했습니다.";
    return "repair";
  }
  if (tile === TILE.exit) {
    checkExit(state);
    return;
  }
  state.message = "상호작용 가능한 장치가 없습니다.";
}

export function scan(state) {
  if (state.phase !== "running") {
    return;
  }
  if (state.scanner < 35 || state.battery < 8) {
    state.message = "스캐너 충전 또는 배터리가 부족합니다.";
    return;
  }
  state.scanner -= 35;
  state.battery = Math.max(0, state.battery - 8);
  revealAround(state, 6);
  state.scanPulseUntil = performance.now() + 460;
  state.message = "스캐너 펄스 발사. 주변 구조와 위험 신호가 드러났습니다.";
  return "scan";
}

export function updateResources(state, now) {
  if (state.phase !== "running") {
    return;
  }
  const dt = Math.min(2, (now - state.lastTick) / 1000 || 0);
  state.lastTick = now;
  const oxygenRate = state.oxygenOnline ? 0.9 : 1.7;
  drain(state, oxygenRate * dt, 0);
  state.scanner = Math.min(100, state.scanner + dt * 5);
}

export function getTile(state, x, y) {
  if (x < 0 || y < 0 || x >= state.sector.size || y >= state.sector.size) {
    return TILE.wall;
  }
  return state.sector.tiles[y][x];
}

export function revealAround(state, overrideRadius) {
  const radius = overrideRadius || (state.terminalUsed ? 5 : 3);
  for (let y = state.drone.y - radius; y <= state.drone.y + radius; y += 1) {
    for (let x = state.drone.x - radius; x <= state.drone.x + radius; x += 1) {
      if (x >= 0 && y >= 0 && x < state.sector.size && y < state.sector.size) {
        state.explored.add(`${x},${y}`);
      }
    }
  }
}

function revealAll(state) {
  for (let y = 0; y < state.sector.size; y += 1) {
    for (let x = 0; x < state.sector.size; x += 1) {
      state.explored.add(`${x},${y}`);
    }
  }
}

function checkExit(state) {
  const atExit = state.drone.x === state.sector.exit.x && state.drone.y === state.sector.exit.y;
  if (!atExit) {
    return;
  }
  if (!state.powerOnline || !state.oxygenOnline) {
    state.message = "출구 해치는 전력과 산소 안정화가 모두 필요합니다.";
    return;
  }
  const next = state.sector.index + 1;
  state.records.bestSector = Math.max(state.records.bestSector, next);
  unlockLog(state, `섹터 ${next} 도달 기록`);
  loadSector(state, next);
  state.phase = "running";
  state.message = `섹터 ${next} 진입. 기지 압력이 더 불안정합니다.`;
  return "clear";
}

function unlockLog(state, label) {
  if (!state.records.logs.includes(label)) {
    state.records.logs.push(label);
  }
}

function drain(state, oxygen, battery) {
  state.oxygen = Math.max(0, state.oxygen - oxygen);
  state.battery = Math.max(0, state.battery - battery);
  if (state.oxygen <= 0) {
    damage(state, 100, "산소가 고갈됐습니다.");
  }
  if (state.battery <= 0) {
    damage(state, 100, "드론 배터리가 고갈됐습니다.");
  }
}

function damage(state, amount, message) {
  state.integrity = Math.max(0, state.integrity - amount);
  state.message = message;
  if (state.integrity <= 0) {
    state.phase = "failed";
    state.message = `${message} Run 실패. 섹터 1로 돌아갑니다.`;
  }
}

function describeTile(tile) {
  if (tile === TILE.water) return "침수 구역입니다. 산소와 배터리 소모가 큽니다.";
  if (tile === TILE.relay) return "전력 릴레이입니다. 상호작용으로 복구하세요.";
  if (tile === TILE.valve) return "산소 밸브입니다. 상호작용으로 안정화하세요.";
  if (tile === TILE.terminal) return "터미널입니다. 상호작용으로 지도와 전력을 확보하세요.";
  if (tile === TILE.exit) return "출구 해치입니다. 목표를 완료했다면 상호작용 또는 이동으로 진입하세요.";
  return "기지 복도를 이동 중입니다.";
}
