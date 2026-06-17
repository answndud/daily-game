const CONDITIONS = [
  { label: '짝수', test: n => n % 2 === 0 },
  { label: '홀수', test: n => n % 2 === 1 },
  { label: '3의 배수', test: n => n % 3 === 0 },
  { label: '4의 배수', test: n => n % 4 === 0 },
  { label: '5의 배수', test: n => n % 5 === 0 },
  { label: '소수', test: n => n === 2 || n === 3 || n === 5 || n === 7 },
  { label: '3 이상', test: n => n >= 3 },
  { label: '6 이하', test: n => n <= 6 },
  { label: '4 초과', test: n => n > 4 },
  { label: '6 미만', test: n => n < 6 },
];

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function generatePairs(count) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const conds = shuffle(CONDITIONS).slice(0, count);
    const pairs = [];
    const usedNums = new Set();
    let ok = true;

    for (const cond of conds) {
      const valid = nums.filter(n => !usedNums.has(n) && cond.test(n));
      if (valid.length === 0) { ok = false; break; }
      const picked = valid[Math.floor(Math.random() * valid.length)];
      usedNums.add(picked);
      pairs.push({ number: picked, condition: cond });
    }

    if (ok) return shuffle(pairs);
  }

  const fallback = [];
  for (let i = 0; i < count; i++) {
    fallback.push({ number: i + 1, condition: CONDITIONS[i % CONDITIONS.length] });
  }
  return fallback;
}

const requestsEl = document.getElementById('requests');
const tilesEl = document.getElementById('tiles');
const roundNumEl = document.getElementById('round-num');
const scoreNumEl = document.getElementById('score-num');
const targetNumEl = document.getElementById('target-num');
const feedbackEl = document.getElementById('feedback');
const overlayEl = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const overlayBtn = document.getElementById('overlay-btn');
const restartBtn = document.getElementById('restart-btn');

let state = {
  round: 1,
  pairs: [],
  selectedTileIdx: null,
  matchedCount: 0,
  tilesUsed: false,
  locked: false,
};

function getCount() {
  if (state.round <= 1) return 3;
  if (state.round === 2) return 4;
  if (state.round === 3) return 5;
  return 6;
}

function startRound() {
  const count = getCount();
  state.pairs = generatePairs(count);
  state.selectedTileIdx = null;
  state.matchedCount = 0;
  state.tilesUsed = false;
  state.locked = false;
  roundNumEl.textContent = state.round;
  targetNumEl.textContent = count;
  scoreNumEl.textContent = 0;
  render();
}

function render() {
  requestsEl.innerHTML = '';
  tilesEl.innerHTML = '';

  const condOrder = shuffle(state.pairs.map((p, i) => i));

  requestsEl.style.gridTemplateColumns = `repeat(${Math.min(condOrder.length, 3)}, 1fr)`;

  for (const idx of condOrder) {
    const p = state.pairs[idx];
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.idx = idx;
    card.textContent = p.condition.label;
    if (p.matched) card.classList.add('matched');
    card.addEventListener('click', () => onRequestClick(idx));
    requestsEl.appendChild(card);
  }

  for (let i = 0; i < state.pairs.length; i++) {
    const p = state.pairs[i];
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.idx = i;
    tile.textContent = p.number;
    if (p.used) tile.classList.add('used');
    if (state.selectedTileIdx === i) tile.classList.add('selected');
    tile.addEventListener('click', () => onTileClick(i));
    tilesEl.appendChild(tile);
  }
}

function onTileClick(idx) {
  if (state.locked) return;
  const p = state.pairs[idx];
  if (p.matched || p.used) return;

  if (state.selectedTileIdx === idx) {
    state.selectedTileIdx = null;
    render();
    return;
  }

  state.selectedTileIdx = idx;
  render();
}

function onRequestClick(idx) {
  if (state.locked) return;
  if (state.selectedTileIdx === null) return;

  const pair = state.pairs[idx];
  if (pair.matched) return;

  const tile = state.pairs[state.selectedTileIdx];
  if (tile.matched || tile.used) return;

  state.locked = true;

  if (pair.condition.test(tile.number)) {
    tile.matched = true;
    pair.matched = true;
    state.matchedCount++;
    state.selectedTileIdx = null;
    scoreNumEl.textContent = state.matchedCount;
    showFeedback(true);
    render();
    state.locked = false;

    if (state.matchedCount === state.pairs.length) {
      setTimeout(() => showOverlay(true), 400);
    }
  } else {
    tile.used = true;
    pair.wrong = true;
    showFeedback(false);
    render();
    setTimeout(() => {
      pair.wrong = false;
      state.selectedTileIdx = null;
      state.locked = false;

      const allUsed = state.pairs.every(p => p.used || p.matched);
      if (allUsed && state.matchedCount < state.pairs.length) {
        setTimeout(() => showOverlay(false), 300);
      } else {
        render();
      }
    }, 600);
  }
}

function showFeedback(correct) {
  feedbackEl.textContent = correct ? '정답!' : '오답!';
  feedbackEl.className = correct ? 'correct' : 'wrong';
  setTimeout(() => { feedbackEl.className = 'hidden'; }, 500);
}

function showOverlay(win) {
  if (win) {
    overlayMsg.innerHTML = `라운드 ${state.round} 클리어!<br>다음 라운드로 이동합니다.`;
    overlayBtn.textContent = '다음 라운드';
    overlayBtn.onclick = () => {
      overlayEl.classList.add('hidden');
      state.round++;
      startRound();
    };
  } else {
    overlayMsg.innerHTML = `실패!<br>라운드 1로 돌아갑니다.`;
    overlayBtn.textContent = '다시 시작';
    overlayBtn.onclick = () => {
      overlayEl.classList.add('hidden');
      state.round = 1;
      startRound();
    };
  }
  overlayEl.classList.remove('hidden');
}

function resetGame() {
  overlayEl.classList.add('hidden');
  state.round = 1;
  startRound();
}

restartBtn.addEventListener('click', resetGame);

startRound();