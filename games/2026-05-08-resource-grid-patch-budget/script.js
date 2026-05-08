"use strict";

const CELLS = 16;
const KEY_MAP = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  q: 4,
  w: 5,
  e: 6,
  r: 7,
  a: 8,
  s: 9,
  d: 10,
  f: 11,
  z: 12,
  x: 13,
  c: 14,
  v: 15,
};

const dom = {
  board: document.getElementById("gridBoard"),
  round: document.getElementById("roundValue"),
  score: document.getElementById("scoreValue"),
  target: document.getElementById("targetValue"),
  fault: document.getElementById("faultValue"),
  credit: document.getElementById("creditValue"),
  creditMax: document.getElementById("creditMaxValue"),
  message: document.getElementById("messageLine"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  startButton: document.getElementById("startButton"),
  resetButton: document.getElementById("resetButton"),
};

const state = {
  phase: "idle",
  round: 1,
  score: 0,
  target: 10,
  faults: 0,
  credits: 5,
  creditMax: 5,
  issues: [],
  tickTimer: 0,
  spawnClock: 0,
  creditClock: 0,
  nextRoundTimer: 0,
  cells: [],
};

function targetFor(round) {
  return Math.min(26, 8 + round * 2);
}

function creditMaxFor(round) {
  return Math.max(3, 6 - Math.floor(round / 3));
}

function spawnIntervalFor(round) {
  return Math.max(720, 1750 - round * 115);
}

function creditIntervalFor(round) {
  return Math.min(1250, 880 + round * 35);
}

function deadlineFor(round) {
  return Math.max(2800, 6200 - round * 360);
}

function severityFor(round) {
  return 1 + Math.floor(Math.random() * Math.min(5, 2 + Math.floor(round / 2)));
}

function issueLimitFor(round) {
  return Math.min(8, 3 + Math.floor(round / 2));
}

function buildBoard() {
  dom.board.innerHTML = "";
  state.cells = [];

  for (let index = 0; index < CELLS; index += 1) {
    const button = document.createElement("button");
    button.className = "cell";
    button.type = "button";
    button.dataset.index = String(index);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${index + 1}번 셀`);
    button.addEventListener("click", () => selectCell(index));
    dom.board.appendChild(button);
    state.cells.push(button);
  }
}

function startRound(round = 1) {
  stopTimers();
  state.phase = "running";
  state.round = round;
  state.score = 0;
  state.target = targetFor(round);
  state.faults = 0;
  state.creditMax = creditMaxFor(round);
  state.credits = state.creditMax;
  state.issues = [];
  state.spawnClock = 0;
  state.creditClock = 0;
  dom.overlay.classList.add("hidden");
  setMessage(`라운드 ${round}: 결함 마감과 심각도를 같이 보세요.`);
  spawnIssue(true);
  spawnIssue(true);
  state.tickTimer = window.setInterval(tick, 180);
  render();
}

function stopTimers() {
  if (state.tickTimer) {
    window.clearInterval(state.tickTimer);
    state.tickTimer = 0;
  }
  if (state.nextRoundTimer) {
    window.clearTimeout(state.nextRoundTimer);
    state.nextRoundTimer = 0;
  }
}

function tick() {
  if (state.phase !== "running") {
    return;
  }

  state.spawnClock += 180;
  state.creditClock += 180;

  for (const issue of state.issues) {
    issue.remaining -= 180;
  }

  const expired = state.issues.filter((issue) => issue.remaining <= 0);
  if (expired.length > 0) {
    for (const issue of expired) {
      missIssue(issue);
      if (state.phase !== "running") {
        return;
      }
    }
  }

  if (state.creditClock >= creditIntervalFor(state.round)) {
    state.creditClock = 0;
    if (state.credits < state.creditMax) {
      state.credits += 1;
    }
  }

  if (state.spawnClock >= spawnIntervalFor(state.round)) {
    state.spawnClock = 0;
    spawnIssue(false);
  }

  render();
}

function spawnIssue(force) {
  if (!force && state.issues.length >= issueLimitFor(state.round)) {
    return;
  }

  const occupied = new Set(state.issues.map((issue) => issue.cell));
  const available = [];
  for (let index = 0; index < CELLS; index += 1) {
    if (!occupied.has(index)) {
      available.push(index);
    }
  }

  if (available.length === 0) {
    return;
  }

  const cell = available[Math.floor(Math.random() * available.length)];
  state.issues.push({
    cell,
    severity: severityFor(state.round),
    remaining: deadlineFor(state.round) + Math.random() * 900,
    total: deadlineFor(state.round) + 900,
  });
}

function selectCell(index) {
  if (state.phase === "idle" || state.phase === "failed") {
    startRound(1);
    return;
  }

  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }

  const issue = state.issues.find((item) => item.cell === index);
  if (!issue) {
    setMessage("빈 셀입니다. 결함이 있는 셀에만 크레딧을 쓰세요.");
    return;
  }

  if (state.credits <= 0) {
    setMessage("크레딧이 없습니다. 짧게 기다리거나 더 급한 결함만 고르세요.");
    return;
  }

  state.credits -= 1;
  issue.severity -= 1;

  if (issue.severity <= 0) {
    state.issues = state.issues.filter((item) => item !== issue);
    state.score += 1;
    setMessage(`안정화 성공. ${state.target - state.score}개 남았습니다.`);

    if (state.score >= state.target) {
      clearRound();
      return;
    }

    if (state.issues.length < 2) {
      spawnIssue(false);
    }
  } else {
    setMessage(`패치 적용. 이 셀은 S${issue.severity}까지 낮아졌습니다.`);
  }

  render();
}

function missIssue(issue) {
  state.issues = state.issues.filter((item) => item !== issue);
  state.faults += 1;

  if (state.faults >= 3) {
    failRun();
    return;
  }

  setMessage(`마감 초과 ${state.faults}/3. 실패하면 라운드 1로 돌아갑니다.`);
  spawnIssue(true);
  render();
}

function clearRound() {
  state.phase = "cleared";
  state.issues = [];
  stopTimers();
  render();
  showOverlay(
    "클리어",
    `라운드 ${state.round} 안정화 완료`,
    "다음 라운드는 결함이 더 빠르게 생기고 마감이 짧아집니다. 곧 자동으로 시작합니다.",
    "다음 라운드"
  );
  setMessage(`라운드 ${state.round + 1}로 이동합니다.`);
  state.nextRoundTimer = window.setTimeout(() => startRound(state.round + 1), 900);
}

function failRun() {
  state.phase = "failed";
  stopTimers();
  render();
  showOverlay(
    "실패",
    "마감 초과가 누적됐습니다",
    "실패한 run은 종료됩니다. 다시 시작하면 라운드 1부터 패치 예산을 관리합니다.",
    "라운드 1 재시작"
  );
  setMessage("실패: 라운드 1로 돌아갑니다.");
}

function showOverlay(label, title, text, buttonText) {
  dom.overlayLabel.textContent = label;
  dom.overlayTitle.textContent = title;
  dom.overlayText.textContent = text;
  dom.startButton.textContent = buttonText;
  dom.overlay.classList.remove("hidden");
}

function setMessage(text) {
  dom.message.textContent = text;
}

function render() {
  dom.round.textContent = String(state.round);
  dom.score.textContent = String(state.score);
  dom.target.textContent = String(state.target);
  dom.fault.textContent = String(state.faults);
  dom.credit.textContent = String(state.credits);
  dom.creditMax.textContent = String(state.creditMax);

  const issueByCell = new Map();
  for (const issue of state.issues) {
    issueByCell.set(issue.cell, issue);
  }

  for (let index = 0; index < state.cells.length; index += 1) {
    const cell = state.cells[index];
    const issue = issueByCell.get(index);
    cell.className = "cell";

    if (!issue) {
      cell.innerHTML = `<span class="cell-code">${cellLabel(index)}</span><span aria-hidden="true">.</span>`;
      cell.setAttribute("aria-label", `${index + 1}번 빈 셀`);
      continue;
    }

    const ratio = Math.max(0, Math.min(1, issue.remaining / issue.total));
    const seconds = Math.max(0, issue.remaining / 1000).toFixed(1);
    cell.classList.add("has-issue");
    if (issue.remaining < 1700 || issue.severity >= 4) {
      cell.classList.add("urgent");
    }
    cell.innerHTML = `
      <span class="cell-code">${cellLabel(index)}</span>
      <span class="issue-stack">
        <strong class="issue-severity">S${issue.severity}</strong>
        <span class="issue-deadline">D ${seconds}s</span>
      </span>
      <span class="meter" aria-hidden="true"><span class="meter-fill" style="transform: scaleX(${ratio})"></span></span>
    `;
    cell.setAttribute("aria-label", `${index + 1}번 셀, 심각도 ${issue.severity}, 마감 ${seconds}초`);
  }
}

function cellLabel(index) {
  const labels = ["1", "2", "3", "4", "Q", "W", "E", "R", "A", "S", "D", "F", "Z", "X", "C", "V"];
  return labels[index];
}

function handleStart() {
  if (state.phase === "cleared") {
    startRound(state.round + 1);
    return;
  }
  startRound(1);
}

dom.startButton.addEventListener("click", handleStart);
dom.resetButton.addEventListener("click", () => startRound(1));

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "enter" || key === " ") {
    event.preventDefault();
    handleStart();
    return;
  }

  if (key === "escape") {
    startRound(1);
    return;
  }

  if (Object.prototype.hasOwnProperty.call(KEY_MAP, key)) {
    event.preventDefault();
    selectCell(KEY_MAP[key]);
  }
});

buildBoard();
render();
