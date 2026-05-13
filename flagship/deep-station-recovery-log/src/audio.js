export function createAudio(records) {
  let context = null;

  function ensureContext() {
    if (!context) {
      context = new AudioContext();
    }
    return context;
  }

  function tone(frequency, duration, type = "sine", gainValue = 0.04) {
    if (records.muted) {
      return;
    }
    const audio = ensureContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  return {
    blip: () => tone(520, 0.08, "triangle", 0.035),
    repair: () => {
      tone(330, 0.08, "sine", 0.04);
      window.setTimeout(() => tone(660, 0.09, "sine", 0.035), 70);
    },
    damage: () => tone(95, 0.18, "sawtooth", 0.035),
    scan: () => {
      tone(260, 0.06, "triangle", 0.025);
      window.setTimeout(() => tone(390, 0.08, "triangle", 0.025), 55);
    },
    clear: () => {
      tone(440, 0.1, "triangle", 0.04);
      window.setTimeout(() => tone(740, 0.14, "triangle", 0.035), 90);
    },
  };
}
