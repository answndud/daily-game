"use strict";

const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const mistakeValue = document.getElementById("mistakeValue");
const lengthValue = document.getElementById("lengthValue");
const clueText = document.getElementById("clueText");
const progressText = document.getElementById("progressText");
const answerSlots = document.getElementById("answerSlots");
const tileBank = document.getElementById("tileBank");
const messageLine = document.getElementById("messageLine");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const submitButton = document.getElementById("submitButton");
const undoButton = document.getElementById("undoButton");
const restartButton = document.getElementById("restartButton");

const puzzles = [
  { answer: "새벽항로", clue: "어두운 바다에서 첫 배가 따라가는 길" },
  { answer: "모래시계", clue: "시간이 아래로 흐르는 작은 유리 장치" },
  { answer: "푸른등대", clue: "밤바다에서 길을 알려 주는 차가운 빛" },
  { answer: "별빛지도", clue: "하늘의 점들을 이어 만든 여행 안내서" },
  { answer: "유리온실", clue: "투명한 벽 안에서 식물이 자라는 방" },
  { answer: "검은우산", clue: "비 오는 골목에서 그림자처럼 펼치는 물건" },
  { answer: "느린전차", clue: "도시의 선로를 천천히 지나가는 차량" },
  { answer: "깊은서랍", clue: "오래된 편지가 숨겨져 있을 법한 칸" },
  { answer: "고요한방", clue: "소리가 거의 없는 작은 실내 공간" },
  { answer: "작은극장", clue: "적은 관객이 가까이 앉는 공연 장소" },
  { answer: "하얀소금", clue: "바다에서 온 흰 결정" },
  { answer: "비밀열쇠", clue: "숨겨 둔 문을 여는 작은 금속 조각" },
  { answer: "달빛항아리", clue: "밤의 빛을 담아 둔 둥근 그릇" },
  { answer: "오래된도서관", clue: "먼지와 종이 냄새가 쌓인 책의 방" },
  { answer: "겨울우체국", clue: "찬 바람 속 편지를 분류하는 곳" },
  { answer: "조용한기록실", clue: "말보다 문서가 더 많이 남는 방" },
];

const decoyPool = Array.from("바람구름연못종이문턱은빛초침기차연필나무바위등불파도사막");

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  goal: 3,
  mistakes: 0,
  mistakeLimit: 3,
  seed: 20260525,
  currentPuzzle: puzzles[0],
  tiles: [],
  picked: [],
  nextTimer: 0,
};

function nextRandom() {
  state.seed = (state.seed * 1103515245 + 12345) >>> 0;
  return state.seed / 4294967296;
}

function goalForRound(round) {
  return Math.min(7, 2 + round);
}

function minLengthForRound(round) {
  return Math.min(7, 3 + round);
}

function decoyCountForRound(round) {
  return Math.min(7, 1 + round);
}

function startRun(round = 1) {
  clearTimeout(state.nextTimer);
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.goal = goalForRound(round);
  state.mistakes = 0;
  state.seed = (20260525 + round * 131) >>> 0;
  overlay.classList.add("hidden");
  startPuzzle();
}

function startPuzzle() {
  state.picked = [];
  state.currentPuzzle = choosePuzzle();
  state.tiles = buildTiles(state.currentPuzzle.answer);
  setMessage(`복원 ${state.score + 1}/${state.goal}: 단서를 읽고 문장을 조립하세요.`, "");
  render();
}

function choosePuzzle() {
  const minimum = minLengthForRound(state.round);
  const candidates = puzzles.filter((puzzle) => Array.from(puzzle.answer).length >= minimum);
  const source = candidates.length > 0 ? candidates : puzzles;
  const offset = (state.round * 5 + state.score * 3 + Math.floor(nextRandom() * source.length)) % source.length;
  return source[offset];
}

function buildTiles(answer) {
  const chars = Array.from(answer).map((value, index) => ({ id: `a-${index}-${value}`, value, used: false }));
  const decoys = [];
  const usedText = new Set(chars.map((item) => item.value));
  const count = decoyCountForRound(state.round);

  while (decoys.length < count) {
    const value = decoyPool[Math.floor(nextRandom() * decoyPool.length)];
    const key = `${value}-${decoys.length}`;
    if (usedText.has(value) && nextRandom() < 0.55) continue;
    decoys.push({ id: `d-${key}`, value, used: false });
  }

  return shuffle([...chars, ...decoys]);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(nextRandom() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function pickTile(tileId) {
  if (state.phase !== "running") return;

  const answerLength = Array.from(state.currentPuzzle.answer).length;
  if (state.picked.length >= answerLength) {
    setMessage("빈칸이 모두 찼습니다. 확인하거나 되돌리세요.", "bad");
    return;
  }

  const tile = state.tiles.find((item) => item.id === tileId);
  if (!tile || tile.used) return;

  tile.used = true;
  state.picked.push(tile.id);
  render();

  if (state.picked.length === answerLength) {
    setMessage("문장이 완성됐습니다. 복원 확인을 누르세요.", "good");
  }
}

function undoAt(slotIndex = state.picked.length - 1) {
  if (state.phase !== "running") return;
  if (slotIndex < 0 || slotIndex >= state.picked.length) return;

  const [tileId] = state.picked.splice(slotIndex, 1);
  const tile = state.tiles.find((item) => item.id === tileId);
  if (tile) tile.used = false;
  setMessage("한 글자를 되돌렸습니다.", "");
  render();
}

function currentAnswer() {
  return state.picked
    .map((tileId) => state.tiles.find((item) => item.id === tileId))
    .filter(Boolean)
    .map((tile) => tile.value)
    .join("");
}

function submitAnswer() {
  if (state.phase === "idle" || state.phase === "failed" || state.phase === "cleared") {
    startRun(1);
    return;
  }

  const expected = state.currentPuzzle.answer;
  if (state.picked.length < Array.from(expected).length) {
    setMessage("아직 빈칸이 남아 있습니다.", "bad");
    return;
  }

  if (currentAnswer() === expected) {
    completePuzzle();
    return;
  }

  state.mistakes += 1;
  if (state.mistakes >= state.mistakeLimit) {
    failRun(`정답은 “${expected}”였습니다.`);
    return;
  }

  state.picked.forEach((tileId) => {
    const tile = state.tiles.find((item) => item.id === tileId);
    if (tile) tile.used = false;
  });
  state.picked = [];
  setMessage(`문장이 맞지 않습니다. 실수 ${state.mistakes}/${state.mistakeLimit}.`, "bad");
  render();
}

function completePuzzle() {
  state.score += 1;
  setMessage(`복원 성공: ${state.currentPuzzle.answer}`, "good");
  render();

  if (state.score >= state.goal) {
    clearRound();
    return;
  }

  state.nextTimer = setTimeout(startPuzzle, 680);
}

function clearRound() {
  state.phase = "cleared";
  overlayTitle.textContent = `라운드 ${state.round} 완료`;
  overlayText.textContent = "다음 라운드는 더 긴 문장과 더 많은 가짜 파편을 사용합니다.";
  startButton.textContent = `라운드 ${state.round + 1} 시작`;
  overlay.classList.remove("hidden");
  state.nextTimer = setTimeout(() => startRun(state.round + 1), 1000);
}

function failRun(reason) {
  state.phase = "failed";
  overlayTitle.textContent = "복원 실패";
  overlayText.textContent = `${reason} 실수 한도를 넘어서 라운드 1부터 다시 시작합니다.`;
  startButton.textContent = "라운드 1 다시 시작";
  overlay.classList.remove("hidden");
  setMessage("실패했습니다. 라운드가 1로 초기화됩니다.", "bad");
  render();
}

function render() {
  const answerChars = Array.from(state.currentPuzzle.answer);
  roundValue.textContent = String(state.round);
  scoreValue.textContent = `${state.score}/${state.goal}`;
  mistakeValue.textContent = `${state.mistakes}/${state.mistakeLimit}`;
  lengthValue.textContent = String(answerChars.length);
  clueText.textContent = state.currentPuzzle.clue;
  progressText.textContent = `${state.picked.length}/${answerChars.length}칸 복원됨 · 가짜 파편 ${state.tiles.length - answerChars.length}개 포함`;

  answerSlots.style.setProperty("--answer-length", String(answerChars.length));
  answerSlots.replaceChildren(...answerChars.map((_, index) => renderSlot(index)));
  tileBank.replaceChildren(...state.tiles.map((tile, index) => renderTile(tile, index)));
}

function renderSlot(index) {
  const tileId = state.picked[index];
  const tile = state.tiles.find((item) => item.id === tileId);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `slot${tile ? " filled" : ""}`;
  button.setAttribute("aria-label", tile ? `${index + 1}번째 칸 ${tile.value}, 누르면 되돌림` : `${index + 1}번째 빈칸`);
  button.innerHTML = `<span>${tile ? tile.value : ""}</span>`;
  button.addEventListener("click", () => undoAt(index));
  return button;
}

function renderTile(tile, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `tile${tile.used ? " used" : ""}`;
  button.textContent = tile.value;
  button.setAttribute("aria-label", `${index + 1}번 파편 ${tile.value}`);
  button.addEventListener("click", () => pickTile(tile.id));
  return button;
}

function setMessage(text, tone) {
  messageLine.textContent = text;
  messageLine.className = `message${tone ? ` ${tone}` : ""}`;
}

startButton.addEventListener("click", () => {
  if (state.phase === "cleared") {
    startRun(state.round + 1);
    return;
  }
  startRun(1);
});

submitButton.addEventListener("click", submitAnswer);
undoButton.addEventListener("click", () => undoAt());
restartButton.addEventListener("click", () => startRun(1));

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitAnswer();
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    undoAt();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    startRun(1);
    return;
  }

  const digit = Number.parseInt(event.key, 10);
  if (Number.isFinite(digit) && digit >= 1 && digit <= 9) {
    const available = state.tiles.filter((tile) => !tile.used);
    const tile = available[digit - 1];
    if (tile) {
      event.preventDefault();
      pickTile(tile.id);
    }
  }
});

render();
