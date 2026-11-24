// 作答鼓励(2026-10-29 中珠协领导经付海东转达:「孩子做一题不管错和对都有鼓励,有效互动」「语音活动,特效互动」「最好有语音」)。
// 每题交卷后:答对 → 叮咚提示音 + 随机夸奖语音(连对 3/5/10 题有专门语音);答错 → 柔和提示音 + 安慰鼓励语音。
// 语音是预合成的静态 mp3(public/praise/{zh,en}/*.mp3,火山 豆包语音「儿童绘本」/「Tina老师」,scratchpad/gen-praise.mjs 生成),
// 即点即播、不走网络合成,微信内置浏览器 / App 都能放。开关存 localStorage(praise:on,默认开)。

export type PraiseLang = "zh" | "en";
// 2026-11-08 用户「鼓励的声音和样式多样一些,多一些新鲜感,表扬到心坎里,最少 60 个语音」:扩到 66 句,按情境挑 ——
//   ok 答对(夸具体:稳、专注、进步、用心)· f 秒答(作答 < 2.5 秒)· b 上一题错这题马上对 · s 连对里程碑 3/5/7/10/15/20 · no 答错安慰 · all/fin 一轮完成
// 文案与音色在 scratchpad/gen-praise.mjs(键名 = 文件名);几种音色轮着出(温柔老师 / 阳光大哥哥 / 童声小伙伴)
const TEXT: Record<PraiseLang, Record<string, string>> = {
  zh: {
    ok1: "太棒了！", ok2: "答对啦！", ok3: "真厉害！", ok4: "好样的！", ok5: "完全正确！", ok6: "你真棒！", ok7: "漂亮！", ok8: "又快又准！",
    ok9: "算得真稳，一点都不慌！", ok10: "这一题拿下啦！", ok11: "你的小脑袋转得真快！", ok12: "算盘在你心里越来越清楚啦！",
    ok13: "专注的样子真帅气！", ok14: "看得出来，你练得很用心！", ok15: "一步一步，算得清清楚楚！", ok16: "这题不简单，你做到了！",
    ok17: "给你点个大大的赞！", ok18: "越算越有感觉了吧！", ok19: "心算高手就是这样炼成的！", ok20: "稳稳当当，满分表现！",
    ok21: "你今天状态真好！", ok22: "这份认真，老师都看在眼里！", ok23: "太聪明啦，继续保持！", ok24: "答案漂亮，过程也漂亮！",
    ok25: "你又进步了一点点！", ok26: "这么难都难不倒你！",
    f1: "哇，这么快就算出来了！", f2: "闪电一样的速度！", f3: "又快又对，太了不起了！", f4: "脑子里的算盘拨得飞快！", f5: "速度和准确，都是满分！", f6: "快得我都来不及眨眼！",
    b1: "上一题没关系，这一题马上就拿下了！", b2: "知错就改，真了不起！", b3: "摔一跤马上站起来，你真勇敢！", b4: "调整得真快，这就是高手！", b5: "越挫越勇，好样的！", b6: "看，你找回感觉啦！",
    s3: "连对三题，太厉害了！", s3b: "三连对，手感来了！", s5: "连对五题，你是心算小达人！", s5b: "五题全对，稳得像个小老师！", s7: "连对七题，势不可挡！",
    s10: "连对十题，简直是闪电侠！", s10b: "十连对！今天的你闪闪发光！", s15: "连对十五题，太不可思议了！", s20: "连对二十题，你就是心算冠军！", s20b: "二十连对，全场最佳就是你！",
    no1: "没关系，下一题加油！", no2: "差一点点，再接再厉！", no3: "别灰心，你可以的！", no4: "加油，慢慢来！", no5: "再仔细一点就对啦！",
    no6: "没关系，错了才知道哪里要注意！", no7: "深呼吸，下一题一定行！", no8: "每个高手都是这样练出来的！", no9: "别着急，我们再来一次！", no10: "这题有点难，你已经很努力了！",
    no11: "慢一点也没关系，准确最重要！", no12: "错一题不怕，你一直在进步！", no13: "想一想算盘上的珠子，你能行！", no14: "加油，老师相信你！",
    all: "全部答对，太了不起了！", all2: "一题都没错，你是今天的小冠军！", fin: "完成啦，你真棒！", fin2: "坚持到最后，真了不起！",
  },
  en: {
    ok1: "Awesome!", ok2: "You got it!", ok3: "Amazing!", ok4: "Well done!", ok5: "Perfect!", ok6: "Great job!", ok7: "Nice!", ok8: "Fast and right!",
    ok9: "Calm and steady, great work!", ok10: "Nailed this one!", ok11: "Your brain is so quick!", ok12: "The abacus in your mind is getting clearer!",
    ok13: "Look at that focus!", ok14: "I can tell you've been practicing!", ok15: "Step by step, nice and clear!", ok16: "That was a tough one, and you did it!",
    ok17: "Big thumbs up for you!", ok18: "You're getting the hang of it!", ok19: "That's how math masters are made!", ok20: "Rock solid, full marks!",
    ok21: "You're on fire today!", ok22: "Your hard work really shows!", ok23: "So smart, keep it up!", ok24: "Beautiful answer!",
    ok25: "You just got a little better again!", ok26: "Even the hard ones can't stop you!",
    f1: "Wow, that was quick!", f2: "Lightning speed!", f3: "Fast and correct, brilliant!", f4: "Your mental abacus is flying!", f5: "Full marks for speed and accuracy!", f6: "So fast I almost missed it!",
    b1: "Forget the last one, you got this one!", b2: "You fixed it right away, great!", b3: "Fell down, got right back up. So brave!", b4: "Quick bounce back, that's a pro!", b5: "Tougher every time, well done!", b6: "See? You found your rhythm again!",
    s3: "Three in a row, fantastic!", s3b: "Three straight, you're warming up!", s5: "Five in a row, you're a math star!", s5b: "Five for five, steady as a teacher!", s7: "Seven in a row, unstoppable!",
    s10: "Ten in a row, lightning fast!", s10b: "Ten straight! You're shining today!", s15: "Fifteen in a row, unbelievable!", s20: "Twenty in a row, you're the champion!", s20b: "Twenty straight, best in the room!",
    no1: "That's okay, you'll get the next one!", no2: "So close, keep going!", no3: "Don't give up, you can do it!", no4: "Take your time, you've got this!", no5: "Almost! Look a little closer.",
    no6: "Mistakes show us what to watch for!", no7: "Deep breath, you'll get the next one!", no8: "Every expert practiced just like this!", no9: "No rush, let's try again!", no10: "That one was hard, and you tried your best!",
    no11: "Slow is fine, getting it right matters most!", no12: "One miss is nothing, you keep improving!", no13: "Picture the beads, you can do it!", no14: "Keep going, I believe in you!",
    all: "All correct, that's incredible!", all2: "Not a single miss, you're today's champion!", fin: "All done, great work!", fin2: "You kept going to the end, amazing!",
  },
};
export const PRAISE_TEXT = TEXT;
const POOL = {
  ok: Array.from({ length: 26 }, (_, i) => `ok${i + 1}`),
  fast: ["f1", "f2", "f3", "f4", "f5", "f6"],
  back: ["b1", "b2", "b3", "b4", "b5", "b6"],
  no: Array.from({ length: 14 }, (_, i) => `no${i + 1}`),
};
const MILESTONE: Record<number, string[]> = { 3: ["s3", "s3b"], 5: ["s5", "s5b"], 7: ["s7"], 10: ["s10", "s10b"], 15: ["s15"], 20: ["s20", "s20b"] };

const KEY = "praise:on";
export const getPraiseOn = (): boolean => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
export const setPraiseOn = (on: boolean) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* noop */ } };
// 特效(星星彩纸)单独开关(2026-10-29 用户「特效也可以配置关闭」),默认开
const FX_KEY = "praise:fx";
export const getFxOn = (): boolean => { try { return localStorage.getItem(FX_KEY) !== "0"; } catch { return true; } };
export const setFxOn = (on: boolean) => { try { localStorage.setItem(FX_KEY, on ? "1" : "0"); } catch { /* noop */ } };

/** 选哪句:连对里程碑 3/5/7/10/15/20(20 以后每满 5 题)→ 上一题错、这题对 → 秒答(< 2.5 秒,六成概率)→ 普通夸奖;
 *  最近 8 句不重复(66 句轮着出,新鲜感) */
const recent: string[] = [];
let lastCorrect = true;
const pickFrom = (pool: string[]) => {
  const fresh = pool.filter((k) => !recent.includes(k));
  const from = fresh.length ? fresh : pool;
  const k = from[Math.floor(Math.random() * from.length)];
  recent.push(k); if (recent.length > 8) recent.shift();
  return k;
};
export function pickPraise(correct: boolean, streak: number, ms?: number): string {
  const prevWrong = !lastCorrect; lastCorrect = correct;
  if (!correct) return pickFrom(POOL.no);
  const m = MILESTONE[streak] ?? (streak > 20 && streak % 5 === 0 ? ["s20", "s20b", "s10b"] : null);
  if (m) return pickFrom(m);
  if (prevWrong) return pickFrom(POOL.back);
  if (ms != null && ms < 2500 && Math.random() < 0.6) return pickFrom(POOL.fast);
  return pickFrom(POOL.ok);
}
/** 一轮做完:全对 / 做完 各两句轮换 */
export const pickFinish = (allRight: boolean) => (allRight ? (Math.random() < 0.5 ? "all" : "all2") : Math.random() < 0.5 ? "fin" : "fin2");
/** 夸奖配的大表情(按情境随机) */
const EMO = { ok: ["🎉", "👏", "🌟", "💯", "🥳", "😎", "🙌", "⭐"], fast: ["⚡", "🚀", "💨"], back: ["💪", "🔥", "🌈"], s: ["🏆", "🏅", "👑", "🚀"], no: ["💪", "🌱", "🤗", "🌈"] };
export function praiseEmoji(key: string): string {
  const g = key.startsWith("ok") ? EMO.ok : key.startsWith("f") ? EMO.fast : key.startsWith("b") ? EMO.back : key.startsWith("s") ? EMO.s : EMO.no;
  return g[Math.floor(Math.random() * g.length)];
}
export const praiseText = (key: string, lang: PraiseLang) => TEXT[lang][key] ?? "";

// ===== 播放 =====
const cache = new Map<string, HTMLAudioElement>();
const src = (key: string, lang: PraiseLang) => `/praise/${lang}/${key}.mp3`;
/** 进作答页时预载(下一次播放零等待) */
export function preloadPraise(lang: PraiseLang) {
  for (const k of Object.keys(TEXT[lang])) {
    const id = `${lang}/${k}`;
    if (cache.has(id)) continue;
    const a = new Audio(src(k, lang)); a.preload = "auto"; cache.set(id, a);
  }
}
let current: HTMLAudioElement | null = null;
export function stopPraise() { try { current?.pause(); } catch { /* noop */ } current = null; }

/** 播放一句;resolve 于播放结束(失败 / 超时也 resolve,绝不卡住作答流程) */
export function playPraise(key: string, lang: PraiseLang): Promise<void> {
  stopPraise();
  const id = `${lang}/${key}`;
  const a = cache.get(id) ?? new Audio(src(key, lang));
  cache.set(id, a);
  current = a;
  return new Promise((res) => {
    let done = false;
    const end = () => { if (!done) { done = true; res(); } };
    a.onended = end; a.onerror = end;
    try { a.currentTime = 0; } catch { /* noop */ }
    const p = a.play(); if (p && typeof p.catch === "function") p.catch(end);
    window.setTimeout(end, 4000);
  });
}

// ===== 提示音(Web Audio 现合成,不占文件):答对「叮咚」上行两音,答错一声柔和低音 =====
let ctx: AudioContext | null = null;
export function chime(correct: boolean) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    const notes = correct ? [[880, 0], [1318.5, 0.11]] : [[330, 0]];
    for (const [f, dt] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = correct ? "sine" : "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(correct ? 0.18 : 0.1, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + (correct ? 0.35 : 0.3));
      o.connect(g).connect(ctx.destination);
      o.start(t0 + dt); o.stop(t0 + dt + 0.4);
    }
  } catch { /* 没有声音设备就算了 */ }
}
