/**
 * Lightweight Web Audio beep helpers for countdown ticks and start signals.
 * Falls back silently in environments without AudioContext.
 */

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!C) return null;
  return new C();
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.08) {
  const c = ctx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  o.connect(g);
  g.connect(c.destination);
  o.start(c.currentTime);
  o.stop(c.currentTime + duration);
  // Auto-close context shortly after to avoid leaks
  setTimeout(() => { try { c.close(); } catch { /* noop */ } }, Math.ceil(duration * 1000) + 50);
}

export function dingTick() {
  tone(880, 0.12, "sine", 0.06);
}

export function dingGo() {
  tone(1320, 0.35, "sine", 0.08);
}
