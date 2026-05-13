import { TILE } from "./sectors.js";

const TILE_COLORS = {
  [TILE.floor]: "#24302d",
  [TILE.wall]: "#0d1110",
  [TILE.water]: "#345b65",
  [TILE.relay]: "#6a5330",
  [TILE.valve]: "#3f5f48",
  [TILE.terminal]: "#4b5d64",
  [TILE.exit]: "#a98a54",
  [TILE.hazard]: "#6e2f2c",
  [TILE.door]: "#3a3430",
};

export function render(ctx, state, time) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#101715";
  ctx.fillRect(0, 0, width, height);

  const size = state.sector.size;
  const margin = 42;
  const tileSize = (width - margin * 2) / size;

  drawTiles(ctx, state, margin, tileSize);
  drawScanPulse(ctx, state, margin, tileSize, time);
  drawDrone(ctx, state, margin, tileSize, time);
  drawFog(ctx, state, margin, tileSize);
  drawNoise(ctx, width, height, time);
}

function drawScanPulse(ctx, state, margin, tileSize, time) {
  if (!state.scanPulseUntil || time > state.scanPulseUntil) {
    return;
  }
  const progress = 1 - ((state.scanPulseUntil - time) / 460);
  const cx = margin + (state.drone.x + 0.5) * tileSize;
  const cy = margin + (state.drone.y + 0.5) * tileSize;
  ctx.save();
  ctx.globalAlpha = 0.32 * (1 - progress);
  ctx.strokeStyle = "#9db7c0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * (1.4 + progress * 5.4), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTiles(ctx, state, margin, tileSize) {
  for (let y = 0; y < state.sector.size; y += 1) {
    for (let x = 0; x < state.sector.size; x += 1) {
      const visible = state.explored.has(`${x},${y}`);
      const tile = state.sector.tiles[y][x];
      const px = margin + x * tileSize;
      const py = margin + y * tileSize;
      ctx.fillStyle = visible ? TILE_COLORS[tile] : "#141a18";
      ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
      if (visible) {
        drawGlyph(ctx, tile, px, py, tileSize, state);
      }
    }
  }
}

function drawGlyph(ctx, tile, px, py, tileSize, state) {
  const cx = px + tileSize / 2;
  const cy = py + tileSize / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "rgba(245,242,234,0.72)";
  ctx.fillStyle = "rgba(245,242,234,0.78)";
  ctx.lineWidth = Math.max(2, tileSize * 0.04);

  if (tile === TILE.relay) {
    ctx.strokeStyle = state.powerOnline ? "#f1cc7d" : "#b99052";
    ctx.beginPath();
    ctx.moveTo(-tileSize * 0.18, tileSize * 0.16);
    ctx.lineTo(0, -tileSize * 0.2);
    ctx.lineTo(tileSize * 0.18, tileSize * 0.16);
    ctx.stroke();
  }
  if (tile === TILE.valve) {
    ctx.strokeStyle = state.oxygenOnline ? "#a8d3a9" : "#85a88a";
    ctx.beginPath();
    ctx.arc(0, 0, tileSize * 0.16, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (tile === TILE.terminal) {
    ctx.strokeRect(-tileSize * 0.18, -tileSize * 0.12, tileSize * 0.36, tileSize * 0.24);
  }
  if (tile === TILE.exit) {
    ctx.fillStyle = state.powerOnline && state.oxygenOnline ? "#e1c07d" : "rgba(225,192,125,0.38)";
    ctx.fillRect(-tileSize * 0.18, -tileSize * 0.18, tileSize * 0.36, tileSize * 0.36);
  }
  if (tile === TILE.hazard) {
    ctx.strokeStyle = "#dd766d";
    ctx.beginPath();
    ctx.moveTo(-tileSize * 0.22, -tileSize * 0.08);
    ctx.lineTo(-tileSize * 0.04, tileSize * 0.02);
    ctx.lineTo(0, -tileSize * 0.2);
    ctx.lineTo(tileSize * 0.22, tileSize * 0.08);
    ctx.stroke();
  }
  if (tile === TILE.door) {
    ctx.strokeStyle = state.powerOnline ? "#bfb8a8" : "#766c5d";
    ctx.beginPath();
    ctx.moveTo(-tileSize * 0.2, 0);
    ctx.lineTo(tileSize * 0.2, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDrone(ctx, state, margin, tileSize, time) {
  const cx = margin + (state.drone.x + 0.5) * tileSize;
  const cy = margin + (state.drone.y + 0.5) * tileSize;
  const pulse = Math.sin(time / 180) * 0.08 + 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#f5f2ea";
  ctx.strokeStyle = "#0e1110";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, tileSize * 0.24 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#536a76";
  ctx.beginPath();
  ctx.arc(0, 0, tileSize * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFog(ctx, state, margin, tileSize) {
  const cx = margin + (state.drone.x + 0.5) * tileSize;
  const cy = margin + (state.drone.y + 0.5) * tileSize;
  const gradient = ctx.createRadialGradient(cx, cy, tileSize * 1.5, cx, cy, tileSize * 5);
  gradient.addColorStop(0, "rgba(16, 20, 18, 0)");
  gradient.addColorStop(1, "rgba(16, 20, 18, 0.72)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawNoise(ctx, width, height, time) {
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = "#f5f2ea";
  const offset = Math.floor(time / 60) % 18;
  for (let y = offset; y < height; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}
