const TILE = {
  floor: 0,
  wall: 1,
  water: 2,
  relay: 3,
  valve: 4,
  terminal: 5,
  exit: 6,
  hazard: 7,
  door: 8,
};

export { TILE };

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSector(index) {
  const size = Math.min(17, 11 + Math.floor((index - 1) / 2) * 2);
  const random = mulberry32(9137 + index * 7919);
  const tiles = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => (x === 0 || y === 0 || x === size - 1 || y === size - 1 ? TILE.wall : TILE.floor))
  );

  const protectedPath = [];
  let x = 1;
  let y = 1;
  protectedPath.push([x, y]);
  while (x < size - 2 || y < size - 2) {
    if (x < size - 2 && (y === size - 2 || random() < 0.58)) {
      x += 1;
    } else if (y < size - 2) {
      y += 1;
    }
    protectedPath.push([x, y]);
  }

  const protectedKeys = new Set(protectedPath.map(([px, py]) => key(px, py)));
  const wallBudget = Math.min(size * 2 + index * 2, Math.floor(size * size * 0.22));
  for (let i = 0; i < wallBudget; i += 1) {
    const wx = 1 + Math.floor(random() * (size - 2));
    const wy = 1 + Math.floor(random() * (size - 2));
    if (!protectedKeys.has(key(wx, wy))) {
      tiles[wy][wx] = random() < 0.18 ? TILE.water : TILE.wall;
    }
  }

  placeOnPath(tiles, protectedPath, 0.25, TILE.relay);
  placeOnPath(tiles, protectedPath, 0.52, TILE.valve);
  placeOnPath(tiles, protectedPath, 0.72, TILE.terminal);
  tiles[size - 2][size - 2] = TILE.exit;

  const hazards = Math.min(7, 2 + Math.floor(index * 0.8));
  for (let i = 0; i < hazards; i += 1) {
    const point = protectedPath[Math.max(2, Math.floor(random() * (protectedPath.length - 3)))];
    if (tiles[point[1]][point[0]] === TILE.floor) {
      tiles[point[1]][point[0]] = random() < 0.45 ? TILE.water : TILE.hazard;
    }
  }

  if (index >= 2) {
    placeOnPath(tiles, protectedPath, 0.84, TILE.door);
  }

  return {
    index,
    size,
    tiles,
    start: { x: 1, y: 1 },
    exit: { x: size - 2, y: size - 2 },
  };
}

function placeOnPath(tiles, path, ratio, tile) {
  const index = Math.max(1, Math.min(path.length - 2, Math.floor(path.length * ratio)));
  const [x, y] = path[index];
  tiles[y][x] = tile;
}

function key(x, y) {
  return `${x},${y}`;
}
