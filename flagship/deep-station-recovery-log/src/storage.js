const STORAGE_KEY = "deep-station-recovery-log";

export function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      bestSector: Number(parsed.bestSector) || 1,
      muted: Boolean(parsed.muted),
      runs: Number(parsed.runs) || 0,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch {
    return { bestSector: 1, muted: false, runs: 0, logs: [] };
  }
}

export function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
