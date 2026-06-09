const roundEl = document.querySelector("#round");
const stageEl = document.querySelector("#stage");
const checksEl = document.querySelector("#checks");
const fieldEl = document.querySelector("#field");
const overlayEl = document.querySelector("#overlay");
const statusEl = document.querySelector("#status");
const checkBtn = document.querySelector("#check");
const clearBtn = document.querySelector("#clear");
const restartBtn = document.querySelector("#restart");

const state = {
  round: 1,
  stage: 1,
  stagesNeeded: 2,
  checks: 4,
  size: 4,
  nodes: [],
  targets: [],
  selected: [],
  covered: []
};

function config() {
  return {
    size: Math.min(6, 4 + Math.floor((state.round - 1) / 2)),
    targetCount: Math.min(7, 3 + Math.floor(state.round / 2)),
    stagesNeeded: Math.min(4, 2 + Math.floor(state.round / 2)),
    checks: Math.max(2, 5 - Math.floor(state.round / 2))
  };
}

function seeded(index, salt) {
  const value = Math.sin(index * 41.37 + salt * 29.71) * 10000;
  return value - Math.floor(value);
}

function pointFromGrid(row, col, size) {
  const gap = 78 / (size - 1);
  return { x: 11 + col * gap, y: 11 + row * gap };
}

function startStage(message = "노드 세 곳을 선택한 뒤 커버 검사를 누르세요.") {
  const next = config();
  state.size = next.size;
  state.stagesNeeded = next.stagesNeeded;
  state.checks = next.checks;
  state.selected = [];
  state.covered = [];
  state.nodes = [];
  for (let row = 0; row < state.size; row += 1) {
    for (let col = 0; col < state.size; col += 1) {
      state.nodes.push({ ...pointFromGrid(row, col, state.size), row, col });
    }
  }
  state.targets = makeTargets(next.targetCount);
  setStatus(message);
  render();
}

function makeTargets(count) {
  const salt = state.round * 17 + state.stage * 23;
  const anchors = [
    pointFromGrid(0, 0, state.size),
    pointFromGrid(0, state.size - 1, state.size),
    pointFromGrid(state.size - 1, Math.floor(state.size / 2), state.size)
  ];
  return Array.from({ length: count }, (_, index) => {
    const a = seeded(index + 1, salt);
    const b = seeded(index + 8, salt) * (1 - a);
    const c = 1 - a - b;
    return {
      x: anchors[0].x * a + anchors[1].x * b + anchors[2].x * c,
      y: anchors[0].y * a + anchors[1].y * b + anchors[2].y * c
    };
  });
}

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`.trim();
}

function toggleNode(index) {
  if (state.selected.includes(index)) {
    state.selected = state.selected.filter((item) => item !== index);
  } else {
    if (state.selected.length >= 3) {
      state.selected.shift();
    }
    state.selected.push(index);
  }
  state.covered = [];
  render();
}

function triangleArea(a, b, c) {
  return Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2);
}

function pointInside(point, triangle) {
  const [a, b, c] = triangle;
  const total = triangleArea(a, b, c);
  const area = triangleArea(point, b, c) + triangleArea(a, point, c) + triangleArea(a, b, point);
  return Math.abs(total - area) < 0.2;
}

function checkCoverage() {
  if (state.selected.length !== 3) {
    setStatus("송신기 노드 세 곳을 먼저 선택하세요.", "bad");
    return;
  }

  const triangle = state.selected.map((index) => state.nodes[index]);
  if (triangleArea(triangle[0], triangle[1], triangle[2]) < 50) {
    setStatus("세 송신기가 거의 한 줄입니다. 넓은 삼각형을 만드세요.", "bad");
    return;
  }

  state.covered = state.targets.map((target) => pointInside(target, triangle));
  if (state.covered.every(Boolean)) {
    advance();
    return;
  }

  state.checks -= 1;
  if (state.checks <= 0) {
    state.round = 1;
    state.stage = 1;
    startStage("검사 기회를 모두 썼습니다. 실패 처리되어 라운드 1로 돌아갑니다.");
    return;
  }

  const count = state.covered.filter(Boolean).length;
  setStatus(`${count}/${state.targets.length}개 신호만 커버됐습니다. 삼각형을 더 넓히세요.`, "bad");
  render();
}

function advance() {
  if (state.stage >= state.stagesNeeded) {
    state.round += 1;
    state.stage = 1;
    startStage(`배치 묶음을 완료했습니다. 목표 신호가 늘어난 라운드 ${state.round}로 바로 이동합니다.`);
    return;
  }
  state.stage += 1;
  startStage("송신 커버 승인. 다음 배치로 넘어갑니다.");
}

function clearSelection() {
  state.selected = [];
  state.covered = [];
  setStatus("선택을 지웠습니다. 새 삼각형을 만드세요.");
  render();
}

function resetRun() {
  state.round = 1;
  state.stage = 1;
  startStage("라운드 1부터 다시 시작합니다.");
}

function render() {
  roundEl.textContent = state.round;
  stageEl.textContent = `${state.stage}/${state.stagesNeeded}`;
  checksEl.textContent = state.checks;
  fieldEl.innerHTML = "";
  overlayEl.innerHTML = "";
  overlayEl.style.opacity = "0";
  overlayEl.style.clipPath = "";

  if (state.selected.length === 3) {
    const points = state.selected.map((index) => `${state.nodes[index].x}% ${state.nodes[index].y}%`).join(", ");
    overlayEl.style.clipPath = `polygon(${points})`;
    overlayEl.style.opacity = "1";
  }

  state.targets.forEach((target, index) => {
    const dot = document.createElement("span");
    dot.className = `target-dot${state.covered[index] ? " covered" : ""}`;
    dot.style.left = `${target.x}%`;
    dot.style.top = `${target.y}%`;
    dot.setAttribute("aria-label", `${index + 1}번 목표 신호`);
    fieldEl.appendChild(dot);
  });

  state.nodes.forEach((node, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `node${state.selected.includes(index) ? " selected" : ""}`;
    button.style.left = `${node.x}%`;
    button.style.top = `${node.y}%`;
    button.textContent = state.selected.includes(index) ? String(state.selected.indexOf(index) + 1) : "";
    button.setAttribute("aria-label", `${node.row + 1}행 ${node.col + 1}열 노드`);
    button.addEventListener("click", () => toggleNode(index));
    fieldEl.appendChild(button);
  });
}

checkBtn.addEventListener("click", checkCoverage);
clearBtn.addEventListener("click", clearSelection);
restartBtn.addEventListener("click", resetRun);
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter") checkCoverage();
  if (event.key === "Backspace") clearSelection();
});

startStage();
