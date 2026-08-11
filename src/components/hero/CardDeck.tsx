import { useState } from "react";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { useI18n } from "@/lib/i18n";
import { ModuleCard } from "./ModuleCard";

type CardCfg = {
  key: string;          // drives artwork + palette (ART[key])
  href: string;         // destination
  name: string;
  tagline: string;
  featured?: boolean;
};

// The other, already-existing modules — hidden behind "展开更多".
const MORE_IDS: GameId[] = ["gauntlet", "schulte", "nback", "reaction", "cards", "orbit"];

export default function CardDeck() {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const fromGame = (id: GameId) => ({ name: t.games[id].name, tagline: GAMES[id].tagline });

  // Default three, centered: 闪电心算 · 听算 · 看算
  const featured: CardCfg[] = [
    { key: "flashmath", href: "/play/flashmath", featured: true, ...fromGame("flashmath") },
    { key: "listen", href: "/play/abacus?mode=listen", name: lang === "en" ? "Listen Calc" : "听算", tagline: "Listen & Calc" },
    { key: "glance", href: "/play/abacus?mode=glance", name: lang === "en" ? "Glance Calc" : "看算", tagline: "Glance & Calc" },
  ];

  const more: CardCfg[] = MORE_IDS.map((id) => ({ key: id, href: `/play/${id}`, ...fromGame(id) }));

  const renderCard = (c: CardCfg, i: number, centerIdx: number) => {
    const rot = (i - centerIdx) * 1.2; // gentle fan around the middle card
    const hovered = hover === i;
    let shift = 0;
    if (hover !== null && !hovered) shift = i < hover ? -10 : 10;
    return (
      <ModuleCard
        key={c.key}
        id={c.key}
        href={c.href}
        index={i}
        name={c.name}
        tagline={c.tagline}
        featured={c.featured}
        rotate={rot}
        hovered={hovered}
        shift={shift}
        onHover={() => setHover(i)}
        onLeave={() => setHover((h) => (h === i ? null : h))}
      />
    );
  };

  return (
    <div className="flex flex-col items-center">
      {/* Default three — centered */}
      <div className="grid w-full max-w-2xl grid-cols-3 gap-3 sm:gap-4">
        {featured.map((c, i) => renderCard(c, i, 1))}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/60 px-5 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
      >
        {expanded ? (lang === "en" ? "Show less" : "收起") : (lang === "en" ? "Show more" : "展开更多")}
        <span className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* The rest — revealed on demand */}
      {expanded && (
        <div className="animate-fade-rise mt-5 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-2">
          {more.map((c, i) => renderCard(c, featured.length + i, featured.length + (more.length - 1) / 2))}
        </div>
      )}
    </div>
  );
}
