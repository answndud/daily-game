const canvas = document.getElementById("scopeCanvas");
const ctx = canvas.getContext("2d");
const oscillatorList = document.getElementById("oscillatorList");
const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const moveValue = document.getElementById("moveValue");
const errorValue = document.getElementById("errorValue");
const messageLine = document.getElementById("messageLine");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const testButton = document.getElementById("testButton");
const resetButton = document.getElementById("resetButton");

const phaseLabels = ["0도", "90도", "180도", "270도"];
const keyMap = ["1", "2", "3", "4", "5", "6"];

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  moves: 0,
  limit: 10,
  oscillatorCount: 3,
  sampleCount: 8,
  current: [],
  targetPhases: [],
  currentWave: [],
  targetWave: [],
  seed: 20260526,
  nextTimer: 0
};

function random() {
  state.seed = (state.seed * 1103515245 + 12345) >>> 0;
  return state.seed / 4294967296;
}

function oscillatorCountFor(round) {
  return Math.min(6, 3 + Math.floor((round - 1) / 2));
}

function sampleCountFor(round) {
  return Math.min(12, 8 + Math.floor((round - 1) / 2));
}

function goalFor(round) {
  return Math.min(6, 2 + round);
}

function limitFor(round, count) {
  return Math.max(7, count * 3 + 3 - Math.floor(round / 3));
}

function buildWave(phases) {
  const values = [];

  for (let sample = 0; sample < state.sampleCount; sample += 1) {
    let sum = 0;

    phases.forEach((phase, index) => {
      const frequency = index + 1;
      const angle = ((sample / state.sampleCount) * Math.PI * 2 * frequency) + (phase * Math.PI / 2);
      sum += Math.round(Math.sin(angle) * 2);
    });

    values.push(sum);
  }

  return values;
}

function totalError() {
  return state.currentWave.reduce((sum, value, index) => {
    return sum + Math.abs(value - state.targetWave[index]);
  }, 0);
}

function isSolved() {
  return totalError() === 0;
}

function makeTargetPhases() {
  const phases = [];

  for (let index = 0; index < state.oscillatorCount; index += 1) {
    phases.push(Math.floor(random() * 4));
  }

  if (phases.every((value) => value === 0)) {
    phases[phases.length - 1] = 1;
  }

  return phases;
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  state.round = round;
  state.score = 0;
  state.goal = goalFor(round);
  state.oscillatorCount = oscillatorCountFor(round);
  state.sampleCount = sampleCountFor(round);
  state.limit = limitFor(round, state.oscillatorCount);
  state.seed = (20260526 + round * 131) >>> 0;
  state.phase = "running";
  overlay.classList.add("hidden");
  startPuzzle();
}

function startPuzzle() {
  state.moves = 0;
  state.current = Array(state.oscillatorCount).fill(0);
  state.targetPhases = makeTargetPhases();
  state.currentWave = buildWave(state.current);
  state.targetWave = buildWave(state.targetPhases);
  messageLine.textContent = `보정 ${state.score + 1}/${state.goal}: 위상 버튼을 눌러 목표 파형과 겹치게 만드세요.`;
  render();
}

function completePuzzle() {
  state.score += 1;

  if (state.score >= state.goal) {
    state.phase = "cleared";
    render();
    overlayTitle.textContent = `라운드 ${state.round} 완성`;
    overlayText.textContent = "다음 라운드는 발진기나 표본 수가 늘어나 파형 추론이 더 까다로워집니다.";
    startButton.textContent = `라운드 ${state.round + 1} 시작`;
    messageLine.textContent = `라운드 ${state.round} 완료. 곧 다음 라운드로 이동합니다.`;
    overlay.classList.remove("hidden");
    state.nextTimer = setTimeout(() => startRun(state.round + 1), 1000);
    return;
  }

  messageLine.textContent = "파형 보정 성공. 다음 목표 파형을 불러옵니다.";
  state.nextTimer = setTimeout(startPuzzle, 520);
}

function failRun(reason) {
  state.phase = "failed";
  clearTimeout(state.nextTimer);
  render();
  overlayTitle.textContent = "위상 보정 실패";
  overlayText.textContent = `${reason} 라운드 1부터 다시 시작합니다.`;
  startButton.textContent = "라운드 1 다시 시작";
  messageLine.textContent = "실패했습니다. 라운드가 1로 초기화됩니다.";
  overlay.classList.remove("hidden");
}

function turnOscillator(index) {
  if (state.phase !== "running") return;

  state.current[index] = (state.current[index] + 1) % 4;
  state.currentWave = buildWave(state.current);
  state.moves += 1;

  if (isSolved()) {
    completePuzzle();
    return;
  }

  if (state.moves >= state.limit) {
    failRun("조정 횟수를 모두 사용했습니다.");
    return;
  }

  messageLine.textContent = `현재 오차 ${totalError()}. 남은 조정 ${state.limit - state.moves}회.`;
  render();
}

function testWave() {
  if (state.phase !== "running") return;

  if (isSolved()) {
    completePuzzle();
    return;
  }

  state.moves += 1;

  if (state.moves >= state.limit) {
    failRun("검사까지 포함해 조정 제한을 넘었습니다.");
    return;
  }

  messageLine.textContent = `아직 목표와 다릅니다. 파형 검사도 조정 1회로 계산됩니다.`;
  render();
}

function resetPuzzle() {
  if (state.phase === "idle") {
    startRun(1);
    return;
  }

  if (state.phase !== "running") return;

  state.current = Array(state.oscillatorCount).fill(0);
  state.currentWave = buildWave(state.current);
  state.moves = 0;
  messageLine.textContent = "현재 보정을 처음 상태로 되돌렸습니다.";
  render();
}

function drawGrid(width, height) {
  ctx.strokeStyle = "#e2e5e1";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += width / state.sampleCount) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = height * 0.2; y <= height * 0.8; y += height * 0.2) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawWave(values, color, width, height, dash = []) {
  const maxAmplitude = Math.max(4, state.oscillatorCount * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash(dash);
  ctx.beginPath();

  values.forEach((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height / 2 - (value / maxAmplitude) * (height * 0.38);

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
  ctx.setLineDash([]);
}

function drawScope() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(300, Math.floor(rect.height));
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawGrid(width, height);

  if (state.targetWave.length) {
    drawWave(state.targetWave, "#6c746e", width, height, [8, 8]);
  }

  if (state.currentWave.length) {
    drawWave(state.currentWave, "#2f6652", width, height);
  }
}

function renderOscillators() {
  oscillatorList.innerHTML = "";

  state.current.forEach((phase, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "oscillator";
    button.setAttribute("aria-label", `${index + 1}번 발진기 현재 ${phaseLabels[phase]}`);
    button.innerHTML = `<strong>${index + 1}번 발진기</strong><span class="phase">${phaseLabels[phase]}</span>`;
    button.addEventListener("click", () => turnOscillator(index));
    oscillatorList.appendChild(button);
  });
}

function render() {
  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  moveValue.textContent = `${state.moves}/${state.limit}`;
  errorValue.textContent = String(totalError());
  renderOscillators();
  drawScope();
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }

  startRun(1);
});

testButton.addEventListener("click", testWave);
resetButton.addEventListener("click", resetPuzzle);

document.addEventListener("keydown", (event) => {
  const index = keyMap.indexOf(event.key);

  if (index >= 0 && index < state.current.length) {
    event.preventDefault();
    turnOscillator(index);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    testWave();
  }
});

window.addEventListener("resize", drawScope);
render();
