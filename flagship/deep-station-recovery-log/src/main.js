import { createAudio } from "./audio.js";
import { createEngine } from "./engine.js";
import { bindInput } from "./input.js";
import { render } from "./render.js";
import { createGameState } from "./state.js";
import { loadRecords, saveRecords } from "./storage.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const records = loadRecords();
const state = createGameState(records);
const audio = createAudio(records);

const ui = {
  sector: document.getElementById("sectorValue"),
  oxygen: document.getElementById("oxygenValue"),
  battery: document.getElementById("batteryValue"),
  integrity: document.getElementById("integrityValue"),
  best: document.getElementById("bestValue"),
  scanner: document.getElementById("scannerValue"),
  message: document.getElementById("messageLine"),
  logLine: document.getElementById("logLine"),
  powerTask: document.getElementById("powerTask"),
  oxygenTask: document.getElementById("oxygenTask"),
  exitTask: document.getElementById("exitTask"),
  overlay: document.getElementById("overlay"),
  overlayLabel: document.getElementById("overlayLabel"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  muteButton: document.getElementById("muteButton"),
  resetButton: document.getElementById("resetButton"),
};

const engine = createEngine(state, audio, syncUi);

bindInput({
  onMove: engine.move,
  onInteract: engine.doInteract,
  onScan: engine.doScan,
  onStart: engine.beginRun,
});

ui.resetButton.addEventListener("click", engine.beginRun);
ui.muteButton.addEventListener("click", () => {
  records.muted = !records.muted;
  saveRecords(records);
  syncUi();
});

function syncUi() {
  ui.sector.textContent = String(state.sector.index);
  ui.oxygen.textContent = String(Math.round(state.oxygen));
  ui.battery.textContent = String(Math.round(state.battery));
  ui.integrity.textContent = String(Math.round(state.integrity));
  ui.best.textContent = String(records.bestSector);
  ui.scanner.textContent = String(Math.round(state.scanner));
  ui.message.textContent = state.message;
  ui.logLine.textContent = records.logs.length
    ? records.logs.slice(-4).join(" / ")
    : "아직 복구된 로그가 없습니다.";
  ui.muteButton.textContent = records.muted ? "Sound Off" : "Sound On";

  ui.powerTask.classList.toggle("done", state.powerOnline);
  ui.powerTask.textContent = state.powerOnline ? "Power relay restored" : "Power relay offline";
  ui.oxygenTask.classList.toggle("done", state.oxygenOnline);
  ui.oxygenTask.textContent = state.oxygenOnline ? "Oxygen valve stable" : "Oxygen valve offline";
  const exitReady = state.powerOnline && state.oxygenOnline;
  ui.exitTask.classList.toggle("done", exitReady);
  ui.exitTask.textContent = exitReady ? "Exit hatch ready" : "Exit hatch locked";

  if (state.phase === "running") {
    ui.overlay.classList.add("hidden");
  } else {
    ui.overlay.classList.remove("hidden");
    if (state.phase === "failed") {
      ui.overlayLabel.textContent = "Run Failed";
      ui.overlayTitle.textContent = "섹터 1로 복귀";
      ui.overlayText.textContent = state.message;
    }
  }
}

let lastResourceTick = performance.now();
function frame(time) {
  if (time - lastResourceTick > 500) {
    engine.tick(time);
    lastResourceTick = time;
  }
  render(ctx, state, time);
  window.requestAnimationFrame(frame);
}

syncUi();
window.requestAnimationFrame(frame);
