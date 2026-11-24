// 简易「叮」提示音(Web Audio,无需音频文件)。用于 3-2-1 倒计时准备。
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 播放一声清脆的「叮」。freq 频率(Hz),dur 时长(秒)。 */
export function ding(freq = 880, dur = 0.14): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    /* noop */
  }
}

/** 倒计时数字的「叮」(3/2/1)。 */
export const dingTick = () => ding(880, 0.14);
/** 开始时的「叮～」(更高、更长)。 */
export const dingGo = () => ding(1320, 0.22);
