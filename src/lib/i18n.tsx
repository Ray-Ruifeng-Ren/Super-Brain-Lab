import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";

const DICT = {
  zh: {
    brand_sub: "Brain Training Arena",
    today_pick: "今日推荐",
    hero_h1_a: "专注、速算、记忆",
    hero_h1_b: "皆可量化。",
    hero_desc: "一套面向认知极限的训练与排行系统。每一笔成绩都被记录，每一次进步都可比较。",
    start: "开始",
    browse_all: "浏览全部训练 →",
    matrix: "认知矩阵",
    modules: "Modules",
    cloud_lb: "云端排行榜",
    cloud_lb_d: "周榜、总榜、个人最佳，全自动同步与排序。",
    voice: "语音作答",
    voice_d: "解放双手，模拟真实赛场计时与作答方式。",
    sci: "科学出题",
    sci_d: "每位 0–9 均匀分布、单笔无重复，达到专业珠心算标准。",
    footer: "© NeuroPlay · 登录后成绩自动同步到云端",
    coauthor: "由速算世界冠军 × 麻省理工学院 联合研发",
    coauthor_sub: "World Mental-Calc Champion × MIT · Cognitive Performance Lab",
    tag_voice: "语音作答",
    tag_digits: "1–7 位",
    tag_speed: "200ms 极速",
    tag_pro: "专业出题",
    arena: "广场",
    games: {
      flashmath: { name: "闪电心算", desc: "数字逐笔闪现，心算累加。支持语音作答。" },
      schulte: { name: "舒尔特方格", desc: "依序点击 1→N 数字，专注力经典训练。" },
      reaction: { name: "反应速度", desc: "屏幕变绿瞬间立刻点击，毫秒级反应测试。" },
      nback: { name: "N-Back", desc: "工作记忆的国际黄金标准训练。" },
      cards: { name: "扑克记忆", desc: "随机洗一副 52 张扑克牌，记忆顺序后翻面互测。" },
      orbit: { name: "轨道追焦", desc: "眼动追踪 × 专注力。光点沿轨道运动，盯住目标并应对突发挑战。" },
      gauntlet: { name: "障碍闪电心算", desc: "在位置漂移、干扰数字、噪点背景与颜色反转中完成闪电心算。" },
    },
  },
  en: {
    brand_sub: "Brain Training Arena",
    today_pick: "Today's Pick",
    hero_h1_a: "Focus, Calc, Memory —",
    hero_h1_b: "all measurable.",
    hero_desc: "A training & ranking system built for cognitive limits. Every score logged, every gain comparable.",
    start: "Start",
    browse_all: "Browse all training →",
    matrix: "Cognitive Matrix",
    modules: "Modules",
    cloud_lb: "Cloud Leaderboard",
    cloud_lb_d: "Weekly, all-time, personal best — auto-synced and ranked.",
    voice: "Voice Answer",
    voice_d: "Hands-free, simulating a real competition timing & answer flow.",
    sci: "Scientific Problems",
    sci_d: "Uniform 0–9 per digit, no repeats per stroke — professional abacus standard.",
    footer: "© NeuroPlay · Scores auto-sync to cloud after login",
    coauthor: "Co-developed by a World Mental-Calc Champion × MIT",
    coauthor_sub: "Cognitive Performance Lab · Backed by competition data",
    tag_voice: "Voice answer",
    tag_digits: "1–7 digits",
    tag_speed: "200ms speed",
    tag_pro: "Pro problems",
    arena: "Arena",
    games: {
      flashmath: { name: "Flash Math", desc: "Digits flash one by one; add them up mentally. Voice answer supported." },
      schulte: { name: "Schulte Table", desc: "Tap 1→N in order — the classic attention drill." },
      reaction: { name: "Reaction Time", desc: "Click the instant the screen turns green — millisecond test." },
      nback: { name: "N-Back", desc: "The international gold standard for working memory." },
      cards: { name: "Card Memory", desc: "Shuffle a 52-card deck, memorize the order, then test yourself." },
      orbit: { name: "Orbit Focus", desc: "Eye-tracking × focus. Lock onto moving dots and handle sudden challenges." },
      gauntlet: { name: "Gauntlet Flash Math", desc: "Flash math under position drift, decoys, noisy backgrounds and color flips." },
    },
  },
};

type Dict = typeof DICT["zh"];

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({
  lang: "zh",
  setLang: () => {},
  t: DICT.zh,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "zh";
    const v = window.localStorage.getItem("lang");
    return v === "en" ? "en" : "zh";
  });
  useEffect(() => {
    try { window.localStorage.setItem("lang", lang); } catch { /* noop */ }
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  }, [lang]);
  return (
    <LangCtx.Provider value={{ lang, setLang: setLangState, t: DICT[lang] }}>
      {children}
    </LangCtx.Provider>
  );
}

export function useI18n() {
  return useContext(LangCtx);
}

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center rounded-md border border-border bg-card p-0.5 text-[11px] font-medium">
      <button
        onClick={() => setLang("zh")}
        className={`rounded px-2 py-0.5 transition-colors ${
          lang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={lang === "zh"}
      >
        中
      </button>
      <button
        onClick={() => setLang("en")}
        className={`rounded px-2 py-0.5 transition-colors ${
          lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
    </div>
  );
}
