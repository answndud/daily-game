const svg = document.getElementById("circuitMap");
const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const blockValue = document.getElementById("blockValue");
const riskValue = document.getElementById("riskValue");
const messageLine = document.getElementById("messageLine");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const testButton = document.getElementById("testButton");
const resetButton = document.getElementById("resetButton");

const SVG_NS = "http" + "://www.w3.org/2000/svg";

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  blockLimit: 3,
  nodes: [],
  edges: [],
  blocked: new Set(),
  source: 0,
  labs: [],
  seed: 20260527,
  nextTimer: 0
};

function random() {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function goalFor(round) {
  return Math.min(6, 2 + round);
}

function nodeCountFor(round) {
  return Math.min(13, 7 + Math.floor((round - 1) / 2));
}

function labCountFor(round) {
  return Math.min(3, 1 + Math.floor((round - 1) / 3));
}

function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function addEdge(edges, a, b) {
  if (a === b) return;
  const key = edgeKey(a, b);

  if (!edges.some((edge) => edge.key === key)) {
    edges.push({ a, b, key });
  }
}

function buildNodes(count) {
  const nodes = [{ id: 0, x: 82, y: 230 }];
  const columns = Math.ceil((count - 1) / 2);

  for (let index = 1; index < count; index += 1) {
    const column = Math.ceil(index / 2);
    const isTop = index % 2 === 1;
    const jitter = (random() - 0.5) * 26;
    nodes.push({
      id: index,
      x: 110 + column * (520 / Math.max(1, columns)),
      y: (isTop ? 135 : 325) + jitter
    });
  }

  return nodes;
}

function buildGraph() {
  const count = nodeCountFor(state.round);
  const nodes = buildNodes(count);
  const edges = [];

  addEdge(edges, 0, 1);
  addEdge(edges, 0, 2);

  for (let index = 1; index < count - 2; index += 1) {
    addEdge(edges, index, index + 2);
  }

  for (let index = 1; index < count - 1; index += 2) {
    addEdge(edges, index, index + 1);
  }

  const extraCount = Math.min(4 + Math.floor(state.round / 2), count - 3);
  for (let extra = 0; extra < extraCount; extra += 1) {
    const a = 1 + Math.floor(random() * (count - 2));
    const b = Math.min(count - 1, a + 1 + Math.floor(random() * 4));
    addEdge(edges, a, b);
  }

  state.nodes = nodes;
  state.edges = edges;
  state.source = 0;
  state.labs = Array.from({ length: labCountFor(state.round) }, (_, index) => count - 1 - index);
  state.blockLimit = 2 + Math.min(2, Math.floor(state.round / 4));
}

function reachableNodes() {
  const seen = new Set([state.source]);
  const queue = [state.source];

  while (queue.length) {
    const current = queue.shift();

    state.edges.forEach((edge) => {
      if (state.blocked.has(edge.key)) return;

      let next = -1;
      if (edge.a === current) next = edge.b;
      if (edge.b === current) next = edge.a;

      if (next >= 0 && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    });
  }

  return seen;
}

function riskCount() {
  const reached = reachableNodes();
  return state.labs.filter((lab) => reached.has(lab)).length;
}

function isSolved() {
  return riskCount() === 0;
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.seed = (20260527 + round * 193) >>> 0;
  state.phase = "running";
  overlay.classList.add("hidden");
  startPuzzle();
}

function startPuzzle() {
  state.blocked = new Set();
  buildGraph();
  messageLine.textContent = `격리망 ${state.score + 1}/${state.goal}: 연구소까지 이어지는 위험 경로를 끊으세요.`;
  render();
}

function completePuzzle() {
  state.score += 1;

  if (state.score >= state.goal) {
    state.phase = "cleared";
    render();
    overlayTitle.textContent = `라운드 ${state.round} 완성`;
    overlayText.textContent = "다음 라운드는 노드와 우회 연결이 늘어나 최소 절단 지점이 더 까다로워집니다.";
    startButton.textContent = `라운드 ${state.round + 1} 시작`;
    messageLine.textContent = `라운드 ${state.round} 완료. 곧 다음 라운드로 이동합니다.`;
    overlay.classList.remove("hidden");
    state.nextTimer = setTimeout(() => startRun(state.round + 1), 1000);
    return;
  }

  messageLine.textContent = "격리 성공. 다음 회로를 불러옵니다.";
  state.nextTimer = setTimeout(startPuzzle, 560);
}

function failRun(reason) {
  state.phase = "failed";
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = "격리 실패";
  overlayText.textContent = `${reason} 라운드 1부터 다시 시작합니다.`;
  startButton.textContent = "라운드 1 다시 시작";
  messageLine.textContent = "실패했습니다. 라운드가 1로 초기화됩니다.";
  overlay.classList.remove("hidden");
}

function toggleEdge(key) {
  if (state.phase !== "running") return;

  if (state.blocked.has(key)) {
    state.blocked.delete(key);
    messageLine.textContent = "차단선을 회수했습니다. 다른 절단 지점을 시험하세요.";
    render();
    return;
  }

  if (state.blocked.size >= state.blockLimit) {
    failRun("차단선 제한을 넘었습니다.");
    return;
  }

  state.blocked.add(key);

  if (isSolved()) {
    completePuzzle();
    return;
  }

  messageLine.textContent = `아직 위험 경로 ${riskCount()}개가 남았습니다. 남은 차단선 ${state.blockLimit - state.blocked.size}개.`;
  render();
}

function testSpread() {
  if (state.phase !== "running") return;

  if (isSolved()) {
    completePuzzle();
    return;
  }

  failRun(`연구소 ${riskCount()}곳까지 감염 경로가 열려 있습니다.`);
}

function resetPuzzle() {
  if (state.phase === "idle") {
    startRun(1);
    return;
  }

  if (state.phase !== "running") return;

  state.blocked = new Set();
  messageLine.textContent = "현재 격리망의 차단선을 모두 회수했습니다.";
  render();
}

function makeSvg(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function drawEdge(edge, reached) {
  const a = state.nodes[edge.a];
  const b = state.nodes[edge.b];
  const risky = reached.has(edge.a) && reached.has(edge.b);
  const blocked = state.blocked.has(edge.key);
  const group = makeSvg("g");
  const line = makeSvg("line", {
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    class: `edge${blocked ? " blocked" : risky ? " risky" : ""}`
  });
  const hit = makeSvg("line", {
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    tabindex: "0",
    role: "button",
    "aria-label": `${edge.a}번과 ${edge.b}번 연결선 ${blocked ? "차단됨" : "열림"}`,
    class: "edge-hit"
  });

  hit.addEventListener("click", () => toggleEdge(edge.key));
  hit.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleEdge(edge.key);
    }
  });

  group.appendChild(line);
  group.appendChild(hit);
  return group;
}

function drawNode(node, reached) {
  const group = makeSvg("g");
  const isSource = node.id === state.source;
  const isLab = state.labs.includes(node.id);
  const circle = makeSvg("circle", {
    cx: node.x,
    cy: node.y,
    r: isSource || isLab ? 25 : 20,
    class: `node ${isSource ? "source" : isLab ? "lab" : "normal"}${reached.has(node.id) ? " reached" : ""}`
  });
  const label = makeSvg("text", {
    x: node.x,
    y: node.y + 1,
    class: `node-label${isSource || isLab ? "" : " normal"}`
  });
  label.textContent = isSource ? "감" : isLab ? "연" : String(node.id);
  group.appendChild(circle);
  group.appendChild(label);
  return group;
}

function render() {
  const reached = reachableNodes();
  svg.innerHTML = "";

  const background = makeSvg("rect", {
    x: 0,
    y: 0,
    width: 720,
    height: 460,
    fill: "#ffffff"
  });
  svg.appendChild(background);

  state.edges.forEach((edge) => {
    svg.appendChild(drawEdge(edge, reached));
  });

  state.nodes.forEach((node) => {
    svg.appendChild(drawNode(node, reached));
  });

  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  blockValue.textContent = `${state.blocked.size}/${state.blockLimit}`;
  riskValue.textContent = String(riskCount());
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }

  startRun(1);
});

testButton.addEventListener("click", testSpread);
resetButton.addEventListener("click", resetPuzzle);

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    testSpread();
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    resetPuzzle();
  }
});

render();
