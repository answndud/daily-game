const KEY_DIR = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

export function bindInput({ onMove, onInteract, onScan, onStart }) {
  document.querySelectorAll("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      const dir = button.dataset.dir;
      const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      onMove(...map[dir]);
    });
  });

  document.getElementById("interactButton").addEventListener("click", onInteract);
  document.getElementById("scanButton").addEventListener("click", onScan);
  document.getElementById("startButton").addEventListener("click", onStart);

  window.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onInteract();
      return;
    }
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      onScan();
      return;
    }
    const dir = KEY_DIR[event.key] || KEY_DIR[event.key.toLowerCase()];
    if (dir) {
      event.preventDefault();
      onMove(...dir);
    }
  });
}
