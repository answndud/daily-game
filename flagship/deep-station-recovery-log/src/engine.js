import { interact, scan, startRun, step, updateResources } from "./state.js";
import { saveRecords } from "./storage.js";

export function createEngine(state, audio, syncUi) {
  function beginRun() {
    startRun(state);
    saveRecords(state.records);
    audio.blip();
    syncUi();
  }

  function move(dx, dy) {
    if (state.phase === "idle" || state.phase === "failed") {
      beginRun();
      return;
    }
    const before = state.integrity;
    step(state, dx, dy);
    if (state.integrity < before) {
      audio.damage();
    } else {
      audio.blip();
    }
    saveRecords(state.records);
    syncUi();
  }

  function doInteract() {
    if (state.phase === "idle" || state.phase === "failed") {
      beginRun();
      return;
    }
    const result = interact(state);
    if (result === "repair") {
      audio.repair();
    }
    saveRecords(state.records);
    syncUi();
  }

  function doScan() {
    if (state.phase === "idle" || state.phase === "failed") {
      beginRun();
      return;
    }
    const result = scan(state);
    if (result === "scan") {
      audio.scan();
    }
    saveRecords(state.records);
    syncUi();
  }

  function tick(now) {
    updateResources(state, now);
    if (state.phase === "failed") {
      audio.damage();
    }
    saveRecords(state.records);
    syncUi();
  }

  return { beginRun, move, doInteract, doScan, tick };
}
