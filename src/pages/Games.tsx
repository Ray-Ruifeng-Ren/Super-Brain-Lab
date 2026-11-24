// 脑力游戏(2026-10-13):四个主项之外的认知训练模块单独一页(舒尔特方格、反应、N-Back、记忆卡片、轨道专注、连环闪算)
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { EyeCareToggle } from "@/components/EyeCareToggle";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { Book } from "@/components/ProjectTiles";

const IDS: { id: GameId; emoji: string; leather: string; hero: string; heroEn: string }[] = [
  { id: "schulte", emoji: "🔢", leather: "#6B3A1E", hero: "火眼金睛", heroEn: "Keen Eyes" },
  { id: "reaction", emoji: "⚡", leather: "#8A2E2E", hero: "疾风手", heroEn: "Swift Hand" },
  { id: "nback", emoji: "🧠", leather: "#1F3A5F", hero: "记忆大师", heroEn: "Memory Master" },
  { id: "cards", emoji: "🃏", leather: "#2E5A3C", hero: "过目不忘", heroEn: "Photographic" },
  { id: "orbit", emoji: "🪐", leather: "#4A2A5A", hero: "凝神者", heroEn: "The Focused" },
  { id: "gauntlet", emoji: "🏁", leather: "#2B2B2B", hero: "破关者", heroEn: "Gauntlet" },
];

const Games = () => {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  return (
    <div className="relative min-h-screen text-foreground">
      <div aria-hidden className="paper-bg pointer-events-none fixed inset-0 z-0" />
      <header className="safe-t sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="container flex items-center justify-between py-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {t.arena} <span className="mx-1 text-muted-foreground/60">/</span> <span className="text-foreground">{lang === "en" ? "Brain Games" : "脑力游戏"}</span>
          </button>
          <div className="flex items-center gap-2"><EyeCareToggle /><LanguageToggle /><AccountMenu /></div>
        </div>
      </header>
      <main className="container relative z-10 max-w-5xl py-8">
        <h1 className="hp-title mb-1 text-3xl font-black">🎮 {lang === "en" ? "Brain Games" : "脑力游戏"}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{lang === "en" ? "Attention, memory and reaction drills beyond the four core projects." : "四个主项之外的注意力 · 记忆 · 反应训练"}</p>
        {/* 2026-11-02 排版:6 本书排成 3 + 3 两行(原来自动换行成 4 + 2,第二行偏空) */}
        <div className="flex flex-col items-center gap-6 md:gap-8">
          {[IDS.slice(0, Math.ceil(IDS.length / 2)), IDS.slice(Math.ceil(IDS.length / 2))].map((row, i) => (
            <div key={i} className="flex flex-wrap items-end justify-center gap-6 md:gap-8">
              {row.map((g) => (
                <Book key={g.id} b={{ id: g.id, emoji: g.emoji, zh: t.games[g.id]?.name ?? GAMES[g.id].name, en: t.games[g.id]?.name ?? GAMES[g.id].tagline, hero: g.hero, heroEn: g.heroEn, href: `/play/${g.id}`, leather: g.leather, blurb: GAMES[g.id].tagline, blurbEn: GAMES[g.id].tagline }} />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Games;
