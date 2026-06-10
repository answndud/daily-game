(function () {
  "use strict";

  const SIGNALS = ["왼쪽", "중앙", "오른쪽"];
  const beacons = [
    document.querySelector("#beacon-left"),
    document.querySelector("#beacon-center"),
    document.querySelector("#beacon-right")
  ];
  const inputButtons = [
    document.querySelector("#input-left"),
    document.querySelector("#input-center"),
    document.querySelector("#input-right")
  ];

  const roundText = document.querySelector("#roundText");
  const stageText = document.querySelector("#stageText");
  const lengthText = document.querySelector("#lengthText");
  const mistakeText = document.querySelector("#mistakeText");
  const statusText = document.querySelector("#statusText");
  const progressBar = document.querySelector("#progressBar");
  const replayButton = document.querySelector("#replayButton");
  const restartButton = document.querySelector("#restartButton");

  const state = {
    round: 1,
    stage: 1,
    mistakes: 0,
    inputIndex: 0,
    phase: "watch",
    sequence: [],
    timers: []
  };

  function getConfig() {
    return {
      length: Math.min(8, 3 + Math.floor((state.round - 1) / 2)),
      stagesNeeded: Math.min(5, 3 + Math.floor((state.round - 1) / 3)),
      maxMistakes: Math.max(1, 2 - Math.floor((state.round - 1) / 4)),
      tempo: Math.max(260, 620 - state.round * 36)
    };
  }

  function nextSeed(index) {
    const raw = (state.round * 73 + state.stage * 41 + index * 29) % 11;
    return raw % 3;
  }

  function makeSequence() {
    const config = getConfig();
    const sequence = [];
    for (let index = 0; index < config.length; index += 1) {
      let signal = nextSeed(index);
      if (index > 0 && signal === sequence[index - 1]) {
        signal = (signal + state.stage + index) % 3;
      }
      sequence.push(signal);
    }
    return sequence;
  }

  function clearTimers() {
    state.timers.forEach((timer) => clearTimeout(timer));
    state.timers = [];
    beacons.forEach((beacon) => beacon.classList.remove("is-active"));
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function render() {
    const config = getConfig();
    roundText.textContent = String(state.round);
    stageText.textContent = `${state.stage} / ${config.stagesNeeded}`;
    lengthText.textContent = String(config.length);
    mistakeText.textContent = `${state.mistakes} / ${config.maxMistakes}`;
    progressBar.style.width = `${(state.inputIndex / state.sequence.length) * 100 || 0}%`;
    inputButtons.forEach((button) => {
      button.disabled = state.phase !== "input";
    });
    replayButton.disabled = state.phase === "watch";
  }

  function flashSignal(signal) {
    beacons.forEach((beacon) => beacon.classList.remove("is-active"));
    beacons[signal].classList.add("is-active");
    const offTimer = setTimeout(() => {
      beacons[signal].classList.remove("is-active");
    }, getConfig().tempo * 0.56);
    state.timers.push(offTimer);
  }

  function showPattern(reason) {
    clearTimers();
    state.phase = "watch";
    state.inputIndex = 0;
    render();
    setStatus(reason || "패턴을 보여줍니다. 신호가 끝난 뒤 입력하세요.");

    const config = getConfig();
    state.sequence.forEach((signal, index) => {
      const timer = setTimeout(() => flashSignal(signal), index * config.tempo);
      state.timers.push(timer);
    });

    const inputTimer = setTimeout(() => {
      state.phase = "input";
      render();
      setStatus(`이제 같은 순서로 송신하세요. 다음 신호는 ${state.inputIndex + 1}번째입니다.`);
    }, state.sequence.length * config.tempo + 180);
    state.timers.push(inputTimer);
  }

  function startStage(message) {
    clearTimers();
    state.sequence = makeSequence();
    state.inputIndex = 0;
    state.phase = "watch";
    render();
    showPattern(message);
  }

  function resetRun(message) {
    state.round = 1;
    state.stage = 1;
    state.mistakes = 0;
    startStage(message || "실패했습니다. 라운드 1로 돌아갑니다.");
  }

  function advanceAfterClear() {
    const config = getConfig();
    if (state.stage >= config.stagesNeeded) {
      state.round += 1;
      state.stage = 1;
      state.mistakes = 0;
      startStage(`라운드 클리어. 난이도가 오른 라운드 ${state.round}로 바로 이동합니다.`);
      return;
    }

    state.stage += 1;
    startStage(`단계 통과. ${state.stage}단계 신호를 이어서 확인하세요.`);
  }

  function handleWrongInput(expected, actual) {
    const config = getConfig();
    state.mistakes += 1;
    if (state.mistakes >= config.maxMistakes) {
      resetRun(`${actual} 신호가 틀렸습니다. 정답은 ${expected}였습니다. 라운드 1로 돌아갑니다.`);
      return;
    }

    showPattern(`${actual} 신호가 틀렸습니다. 허용 실수가 남아 있어 같은 패턴을 다시 보여줍니다.`);
  }

  function handleInput(signal) {
    if (state.phase !== "input") {
      return;
    }

    const expectedSignal = state.sequence[state.inputIndex];
    if (signal !== expectedSignal) {
      handleWrongInput(SIGNALS[expectedSignal], SIGNALS[signal]);
      return;
    }

    flashSignal(signal);
    state.inputIndex += 1;
    render();

    if (state.inputIndex >= state.sequence.length) {
      state.phase = "watch";
      render();
      setStatus("정확한 송신입니다. 다음 단계로 이동합니다.");
      const timer = setTimeout(advanceAfterClear, 420);
      state.timers.push(timer);
      return;
    }

    setStatus(`좋습니다. 다음 신호는 ${state.inputIndex + 1}번째입니다.`);
  }

  inputButtons.forEach((button, signal) => {
    button.addEventListener("click", () => handleInput(signal));
  });

  replayButton.addEventListener("click", () => {
    showPattern("패턴을 다시 보여줍니다. 이번에는 순서를 더 정확히 기억하세요.");
  });

  restartButton.addEventListener("click", () => {
    resetRun("라운드 1부터 다시 시작합니다.");
  });

  document.addEventListener("keydown", (event) => {
    const keyMap = {
      "1": 0,
      ArrowLeft: 0,
      "2": 1,
      ArrowUp: 1,
      ArrowDown: 1,
      "3": 2,
      ArrowRight: 2
    };
    if (Object.prototype.hasOwnProperty.call(keyMap, event.key)) {
      event.preventDefault();
      handleInput(keyMap[event.key]);
    }
  });

  startStage("첫 패턴을 보여줍니다. 등대가 깜박이는 순서를 기억하세요.");
}());
