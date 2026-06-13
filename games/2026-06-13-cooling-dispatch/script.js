(function () {
  "use strict";

  const LIMIT = 100;
  const reactorNames = ["A동", "B동", "C동", "D동", "E동"];
  const roundText = document.querySelector("#roundText");
  const shiftText = document.querySelector("#shiftText");
  const coolText = document.querySelector("#coolText");
  const dispatchCode = document.querySelector("#dispatchCode");
  const messageText = document.querySelector("#messageText");
  const reactorGrid = document.querySelector("#reactorGrid");
  const restartButton = document.querySelector("#restartButton");

  const state = {
    round: 1,
    shift: 1,
    reactors: [],
    locked: false
  };

  function config() {
    return {
      reactorCount: Math.min(5, 3 + Math.floor((state.round - 1) / 3)),
      shiftsNeeded: Math.min(8, 5 + Math.floor((state.round - 1) / 2)),
      cooling: Math.max(22, 34 - state.round),
      baseRise: 6 + state.round
    };
  }

  function seededValue(index, min, max) {
    const raw = Math.sin((state.round + 3) * 41.7 + (state.shift + 5) * 19.9 + index * 13.1) * 10000;
    return Math.floor(min + (raw - Math.floor(raw)) * (max - min + 1));
  }

  function makeReactors() {
    const current = config();
    return Array.from({ length: current.reactorCount }, (_, index) => ({
      name: reactorNames[index],
      heat: seededValue(index, 38 + state.round * 2, 64 + state.round * 2),
      rise: current.baseRise + seededValue(index + 11, 0, 4 + Math.floor(state.round / 3))
    }));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setMessage(message) {
    messageText.textContent = message;
  }

  function renderHud() {
    const current = config();
    roundText.textContent = String(state.round);
    shiftText.textContent = `${state.shift} / ${current.shiftsNeeded}`;
    coolText.textContent = String(current.cooling);
    dispatchCode.textContent = `R${String(state.round).padStart(2, "0")}-S${String(state.shift).padStart(2, "0")}`;
  }

  function heatClass(heat) {
    if (heat >= 82) {
      return "is-danger";
    }
    if (heat >= 68) {
      return "is-warm";
    }
    return "";
  }

  function renderReactors() {
    reactorGrid.innerHTML = "";
    state.reactors.forEach((reactor, index) => {
      const button = document.createElement("button");
      const dangerAfterRise = reactor.heat + reactor.rise >= LIMIT;
      button.type = "button";
      button.className = "reactor";
      button.disabled = state.locked;
      button.setAttribute("aria-label", `${reactor.name} 원자로 선택`);
      button.innerHTML = `
        <span class="reactor-name">${reactor.name}</span>
        <span class="meter" aria-hidden="true">
          <span class="meter-fill ${heatClass(reactor.heat)}" style="width:${clamp(reactor.heat, 0, 100)}%"></span>
        </span>
        <span class="reactor-meta">${reactor.heat}도 · +${reactor.rise}${dangerAfterRise ? " 위험" : ""}</span>
      `;
      button.addEventListener("click", () => dispatchCooling(index));
      reactorGrid.appendChild(button);
    });
  }

  function render() {
    renderHud();
    renderReactors();
  }

  function resetRound(message) {
    state.shift = 1;
    state.reactors = makeReactors();
    state.locked = false;
    setMessage(message || "가장 위험한 원자로를 선택해 냉각차를 보내세요.");
    render();
  }

  function resetRun(message) {
    state.round = 1;
    resetRound(message || "실패했습니다. 라운드 1로 돌아갑니다.");
  }

  function applyRise() {
    state.reactors = state.reactors.map((reactor) => ({
      ...reactor,
      heat: reactor.heat + reactor.rise
    }));
  }

  function dispatchCooling(index) {
    if (state.locked) {
      return;
    }

    const current = config();
    state.reactors[index].heat = clamp(state.reactors[index].heat - current.cooling, 0, LIMIT);
    applyRise();

    const failed = state.reactors.find((reactor) => reactor.heat >= LIMIT);
    if (failed) {
      state.locked = true;
      setMessage(`${failed.name} 원자로가 한계를 넘었습니다. 라운드 1로 돌아갑니다.`);
      setTimeout(() => resetRun("과열 사고가 발생했습니다. 라운드 1로 돌아갑니다."), 420);
      render();
      return;
    }

    if (state.shift >= current.shiftsNeeded) {
      state.round += 1;
      resetRound(`근무 완료. 더 빠르게 과열되는 다음 라운드 ${state.round}로 바로 이동합니다.`);
      return;
    }

    state.shift += 1;
    setMessage(`${reactorNames[index]}에 냉각차를 보냈습니다. 다음 위험도를 다시 판단하세요.`);
    render();
  }

  restartButton.addEventListener("click", () => {
    resetRun("라운드 1부터 다시 시작합니다.");
  });

  document.addEventListener("keydown", (event) => {
    if (/^[1-5]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < state.reactors.length) {
        event.preventDefault();
        dispatchCooling(index);
      }
    }
  });

  resetRound("가장 먼저 한계를 넘을 원자로를 찾아 냉각차를 보내세요.");
}());
