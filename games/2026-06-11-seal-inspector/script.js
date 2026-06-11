(function () {
  "use strict";

  const TRAITS = {
    shape: {
      label: "모양",
      values: [
        { key: "circle", name: "원형" },
        { key: "square", name: "각형" },
        { key: "diamond", name: "마름모" }
      ]
    },
    texture: {
      label: "결",
      values: [
        { key: "stripe", name: "빗금" },
        { key: "dot", name: "점무늬" },
        { key: "grid", name: "격자" }
      ]
    },
    mark: {
      label: "표식",
      values: [
        { key: "sun", name: "해", symbol: "해" },
        { key: "moon", name: "달", symbol: "달" },
        { key: "star", name: "별", symbol: "별" }
      ]
    },
    direction: {
      label: "방향",
      values: [
        { key: "north", name: "상단" },
        { key: "east", name: "우측" },
        { key: "south", name: "하단" }
      ]
    }
  };
  const TRAIT_KEYS = Object.keys(TRAITS);

  const roundText = document.querySelector("#roundText");
  const stageText = document.querySelector("#stageText");
  const conditionText = document.querySelector("#conditionText");
  const mistakeText = document.querySelector("#mistakeText");
  const ticketCode = document.querySelector("#ticketCode");
  const conditionList = document.querySelector("#conditionList");
  const messageText = document.querySelector("#messageText");
  const restartButton = document.querySelector("#restartButton");
  const plateButtons = Array.from(document.querySelectorAll(".plate"));

  const state = {
    round: 1,
    stage: 1,
    mistakes: 0,
    locked: false,
    answerIndex: 0,
    conditions: [],
    plates: []
  };

  function config() {
    return {
      conditionCount: Math.min(4, 2 + Math.floor((state.round - 1) / 2)),
      stagesNeeded: Math.min(5, 3 + Math.floor((state.round - 1) / 3)),
      maxMistakes: Math.max(1, 2 - Math.floor((state.round - 1) / 5))
    };
  }

  function pickIndex(seed, size) {
    return Math.abs(seed * 37 + state.round * 19 + state.stage * 23) % size;
  }

  function makePlate(offset) {
    const plate = {};
    TRAIT_KEYS.forEach((traitKey, traitIndex) => {
      const values = TRAITS[traitKey].values;
      plate[traitKey] = values[pickIndex(offset + traitIndex * 7, values.length)].key;
    });
    return plate;
  }

  function valueName(traitKey, valueKey) {
    const value = TRAITS[traitKey].values.find((candidate) => candidate.key === valueKey);
    return value ? value.name : valueKey;
  }

  function markSymbol(valueKey) {
    const value = TRAITS.mark.values.find((candidate) => candidate.key === valueKey);
    return value ? value.symbol : "?";
  }

  function plateMatches(plate, conditions) {
    return conditions.every((condition) => plate[condition.trait] === condition.value);
  }

  function makeConditions(answer) {
    const count = config().conditionCount;
    return TRAIT_KEYS.slice(0, count).map((traitKey) => ({
      trait: traitKey,
      value: answer[traitKey]
    }));
  }

  function makeDistractor(answer, index) {
    const plate = { ...answer };
    const conditions = makeConditions(answer);
    const breakTrait = conditions[index % conditions.length].trait;
    const values = TRAITS[breakTrait].values;
    const currentIndex = values.findIndex((value) => value.key === answer[breakTrait]);
    plate[breakTrait] = values[(currentIndex + index + 1) % values.length].key;

    const extraTrait = TRAIT_KEYS[(index + state.round) % TRAIT_KEYS.length];
    if (extraTrait !== breakTrait) {
      const extraValues = TRAITS[extraTrait].values;
      const extraIndex = extraValues.findIndex((value) => value.key === plate[extraTrait]);
      plate[extraTrait] = extraValues[(extraIndex + state.stage + index + 1) % extraValues.length].key;
    }
    return plate;
  }

  function shuffleWithAnswer(plates) {
    const answerIndex = (state.round + state.stage * 2) % plates.length;
    const answer = plates[0];
    const ordered = plates.slice(1);
    ordered.splice(answerIndex, 0, answer);
    state.answerIndex = answerIndex;
    return ordered;
  }

  function newPuzzle() {
    const answer = makePlate(state.round + state.stage * 5);
    state.conditions = makeConditions(answer);
    state.plates = shuffleWithAnswer([
      answer,
      makeDistractor(answer, 0),
      makeDistractor(answer, 1),
      makeDistractor(answer, 2)
    ]);
    state.locked = false;
    render();
  }

  function renderConditions() {
    conditionList.innerHTML = "";
    state.conditions.forEach((condition) => {
      const item = document.createElement("li");
      item.textContent = `${TRAITS[condition.trait].label}: ${valueName(condition.trait, condition.value)}`;
      conditionList.appendChild(item);
    });
  }

  function renderPlate(button, plate, index) {
    const shape = plate.shape;
    const texture = plate.texture;
    button.className = "plate";
    button.disabled = state.locked;
    button.setAttribute("aria-label", `${index + 1}번 인장판`);
    button.innerHTML = `
      <div class="plate-title"><span>${index + 1}번 인장판</span><span>${plate.direction === "north" ? "상단 기준" : plate.direction === "east" ? "우측 기준" : "하단 기준"}</span></div>
      <div class="stamp ${shape} ${texture}"><span>${markSymbol(plate.mark)}</span></div>
      <dl>
        <dt>모양</dt><dd>${valueName("shape", plate.shape)}</dd>
        <dt>결</dt><dd>${valueName("texture", plate.texture)}</dd>
        <dt>표식</dt><dd>${valueName("mark", plate.mark)}</dd>
        <dt>방향</dt><dd>${valueName("direction", plate.direction)}</dd>
      </dl>
    `;
  }

  function render() {
    const current = config();
    roundText.textContent = String(state.round);
    stageText.textContent = `${state.stage} / ${current.stagesNeeded}`;
    conditionText.textContent = `${current.conditionCount}개`;
    mistakeText.textContent = `${state.mistakes} / ${current.maxMistakes}`;
    ticketCode.textContent = `R${String(state.round).padStart(2, "0")}-${String(state.stage).padStart(2, "0")}`;
    renderConditions();
    plateButtons.forEach((button, index) => renderPlate(button, state.plates[index], index));
  }

  function resetRun(message) {
    state.round = 1;
    state.stage = 1;
    state.mistakes = 0;
    messageText.textContent = message || "라운드 1부터 다시 시작합니다.";
    newPuzzle();
  }

  function advance() {
    const current = config();
    if (state.stage >= current.stagesNeeded) {
      state.round += 1;
      state.stage = 1;
      state.mistakes = 0;
      messageText.textContent = `라운드 클리어. 조건이 더 까다로운 다음 라운드 ${state.round}로 이동합니다.`;
      newPuzzle();
      return;
    }

    state.stage += 1;
    messageText.textContent = `검사 통과. ${state.stage}번째 출고표를 확인하세요.`;
    newPuzzle();
  }

  function choosePlate(index) {
    if (state.locked) {
      return;
    }

    const button = plateButtons[index];
    const isCorrect = index === state.answerIndex && plateMatches(state.plates[index], state.conditions);
    if (isCorrect) {
      state.locked = true;
      button.classList.add("is-correct");
      messageText.textContent = "정확한 인장판입니다. 다음 검사로 이동합니다.";
      setTimeout(advance, 360);
      return;
    }

    state.mistakes += 1;
    button.classList.add("is-wrong");
    if (state.mistakes >= config().maxMistakes) {
      state.locked = true;
      messageText.textContent = "검사 실패가 누적되었습니다. 라운드 1로 돌아갑니다.";
      setTimeout(() => resetRun("실패했습니다. 라운드 1로 돌아갑니다."), 520);
      return;
    }

    mistakeText.textContent = `${state.mistakes} / ${config().maxMistakes}`;
    messageText.textContent = "조건 하나가 맞지 않습니다. 남은 실수 안에서 다시 고르세요.";
  }

  plateButtons.forEach((button, index) => {
    button.addEventListener("click", () => choosePlate(index));
  });

  restartButton.addEventListener("click", () => {
    resetRun("라운드 1부터 다시 시작합니다.");
  });

  document.addEventListener("keydown", (event) => {
    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      choosePlate(Number(event.key) - 1);
    }
  });

  newPuzzle();
}());
