import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { SchulteGame } from "@/components/games/SchulteGame";
import { ReactionGame } from "@/components/games/ReactionGame";
import { FlashMathGame, type FlashCfg } from "@/components/games/FlashMathGame";
import { AbacusGame } from "@/components/games/AbacusGame";
import { DEFAULT_ABACUS_CFG, abacusMode, type AbacusCfg } from "@/lib/abacus";
import { NBackGame } from "@/components/games/NBackGame";
import { CardMemoryGame } from "@/components/games/CardMemoryGame";
import { OrbitFocusGame } from "@/components/games/OrbitFocusGame";
import { GauntletFlashGame } from "@/components/games/GauntletFlashGame";
import { DEFAULT_GAUNTLET, encodeMode, type GauntletConfig } from "@/lib/gauntlet";
import { ProLeaderboard } from "@/components/ProLeaderboard";
import { AccountMenu } from "@/components/AccountMenu";
import { PracticeLog } from "@/components/PracticeLog";
import { MistakeBook } from "@/components/MistakeBook";
import { PracticeStats } from "@/components/PracticeStats";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const Play = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [schulteSize, setSchulteSize] = useState(4);
  const [flashCfg, setFlashCfg] = useState<FlashCfg>({ count: 5, digits: 2, speedMs: 700, includeSub: false, rounds: 1 });
  const [flashMistakeMode, setFlashMistakeMode] = useState(false);
  const [abacusCfg, setAbacusCfg] = useState<AbacusCfg>(DEFAULT_ABACUS_CFG);
  const [abacusMistakeMode, setAbacusMistakeMode] = useState(false);
  const [nbackCfg, setNbackCfg] = useState({ n: 2, trials: 20, intervalMs: 2000 });
  const [orbitMode, setOrbitMode] = useState<string>("overall");
  const [gauntletCfg, setGauntletCfg] = useState<GauntletConfig>(DEFAULT_GAUNTLET);
  const [gauntletView, setGauntletView] = useState<"overall" | "current">("overall");

  if (!gameId || !(gameId in GAMES)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">游戏不存在</p>
          <Link to="/" className="mt-3 inline-block text-primary underline">返回广场</Link>
        </div>
      </div>
    );
  }

  const game = GAMES[gameId as GameId];
  const handleFinished = () => setRefreshKey((k) => k + 1);

  const mode =
    game.id === "schulte" ? `${schulteSize}x${schulteSize}` :
    game.id === "flashmath" ? `${flashCfg.count}q-${flashCfg.digits}d${flashCfg.includeSub ? "-sub" : ""}` :
    game.id === "abacus" ? abacusMode(abacusCfg) :
    game.id === "nback" ? `${nbackCfg.n}-back-${nbackCfg.trials}` :
    game.id === "cards" ? "deck52" :
    game.id === "orbit" ? orbitMode :
    game.id === "gauntlet" ? (gauntletView === "overall" ? "overall" : encodeMode(gauntletCfg)) :
    "default";

  const isAbacus = game.id === "abacus";

  return (
    <div
      className={cn("min-h-screen", isAbacus ? "relative overflow-hidden" : "bg-background")}
      style={isAbacus ? { background: "linear-gradient(180deg, #BDE8FF 0%, #DDF3FF 34%, #FBF1D8 70%, #FFF6E6 100%)" } : undefined}
    >
      {isAbacus && <AbacusScene />}
      <header className={cn("sticky top-0 z-30 border-b", isAbacus ? "border-transparent bg-white/40 backdrop-blur" : "border-border bg-background/90 backdrop-blur")}>
        <div className="container flex items-center justify-between py-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t.arena}
            <span className="ml-1 text-muted-foreground/60">/</span>
            <span className="ml-1 text-foreground">{t.games[game.id]?.name ?? game.name}</span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className={cn("container py-2 md:py-3", isAbacus && "relative z-10")}>
        {game.id === "flashmath" && (
          <div className="mb-2">
            <PracticeStats game="flashmath" refreshKey={refreshKey} />
          </div>
        )}

        {game.id === "abacus" && (
          <div className="mb-2">
            <PracticeStats game="abacus" refreshKey={refreshKey} />
          </div>
        )}

        {game.id === "schulte" && (
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">难度</span>
            {[3, 4, 5, 6].map((s) => (
              <button
                key={s}
                onClick={() => setSchulteSize(s)}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                  schulteSize === s
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s}×{s}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[1fr_560px]">
          <div className={cn("flex flex-col", isAbacus ? "" : "rounded-md border border-border bg-card p-3 md:p-4")}>
            {game.id === "schulte" && <SchulteGame size={schulteSize} onFinished={handleFinished} />}
            {game.id === "reaction" && <ReactionGame onFinished={handleFinished} />}
            {game.id === "flashmath" && (
              <FlashMathGame
                onFinished={handleFinished}
                onCfgChange={setFlashCfg}
                mistakeMode={flashMistakeMode}
                onMistakeModeChange={setFlashMistakeMode}
              />
            )}
            {game.id === "abacus" && (
              <AbacusGame
                onFinished={handleFinished}
                onCfgChange={setAbacusCfg}
                mistakeMode={abacusMistakeMode}
                onMistakeModeChange={setAbacusMistakeMode}
              />
            )}
            {game.id === "nback" && <NBackGame onFinished={handleFinished} onCfgChange={setNbackCfg} />}
            {game.id === "cards" && <CardMemoryGame />}
            {game.id === "orbit" && <OrbitFocusGame onFinished={handleFinished} />}
            {game.id === "gauntlet" && <GauntletFlashGame onFinished={handleFinished} onCfgChange={setGauntletCfg} />}
          </div>
          <aside className="space-y-3 lg:flex lg:flex-col">
            {game.id === "orbit" && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setOrbitMode("overall")}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    orbitMode === "overall"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  PFI 通榜
                </button>
                {Array.from({ length: 10 }).map((_, i) => {
                  const m = `L${i + 1}`;
                  return (
                    <button
                      key={m}
                      onClick={() => setOrbitMode(m)}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono-tabular text-[11px] font-medium transition-colors",
                        orbitMode === m
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
            {game.id === "gauntlet" && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setGauntletView("overall")}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    gauntletView === "overall"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  GFI 通榜
                </button>
                <button
                  onClick={() => setGauntletView("current")}
                  className={cn(
                    "rounded-md border px-2.5 py-1 font-mono-tabular text-[11px] font-medium transition-colors",
                    gauntletView === "current"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  title={encodeMode(gauntletCfg)}
                >
                  当前配置榜
                </button>
              </div>
            )}
            {game.id === "flashmath" ? (
              <div className="h-full min-h-[520px]">
                <PracticeLog
                  game="flashmath"
                  refreshKey={refreshKey}
                  extraTab={<ProLeaderboard game={game.id} mode={mode} refreshKey={refreshKey} />}
                  mistakeTab={
                    <MistakeBook
                      game="flashmath"
                      refreshKey={refreshKey}
                      mistakeMode={flashMistakeMode}
                      onMistakeModeChange={setFlashMistakeMode}
                    />
                  }
                />
              </div>
            ) : game.id === "abacus" ? (
              <div className="h-full min-h-[520px]">
                <PracticeLog
                  game="abacus"
                  refreshKey={refreshKey}
                  extraTab={<ProLeaderboard game={game.id} mode={mode} refreshKey={refreshKey} />}
                  mistakeTab={
                    <MistakeBook
                      game="abacus"
                      refreshKey={refreshKey}
                      mistakeMode={abacusMistakeMode}
                      onMistakeModeChange={setAbacusMistakeMode}
                    />
                  }
                />
              </div>
            ) : (
              <ProLeaderboard game={game.id} mode={mode} refreshKey={refreshKey} />
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

// 珠心算专属:童话风背景场景(原创,借鉴洛克王国明亮奇幻画风)
function AbacusScene() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {/* 太阳光晕 */}
      <div style={{ position: "absolute", top: -80, right: -40, width: 260, height: 260, borderRadius: 999, background: "radial-gradient(circle, #FFE7A340 0%, transparent 70%)" }} />
      {/* 云朵 */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} preserveAspectRatio="none" viewBox="0 0 1440 900">
        <g fill="#FFFFFF" opacity="0.85">
          <ellipse cx="180" cy="120" rx="70" ry="34" />
          <ellipse cx="240" cy="110" rx="52" ry="30" />
          <ellipse cx="120" cy="132" rx="46" ry="26" />
          <ellipse cx="1180" cy="90" rx="64" ry="30" />
          <ellipse cx="1240" cy="100" rx="48" ry="26" />
          <ellipse cx="1120" cy="104" rx="40" ry="22" />
          <ellipse cx="720" cy="70" rx="54" ry="24" opacity="0.7" />
        </g>
        {/* 远山/草坡 */}
        <path d="M0 820 Q 360 700 720 810 T 1440 780 V900 H0 Z" fill="#BEE79B" opacity="0.75" />
        <path d="M0 860 Q 400 770 820 850 T 1440 840 V900 H0 Z" fill="#8FD06A" opacity="0.9" />
      </svg>
      {/* 闪烁星点 */}
      {[[320, 210], [1080, 240], [560, 150], [960, 300], [200, 320], [1280, 360]].map(([x, y], i) => (
        <span key={i} className="animate-pulse" style={{ position: "absolute", left: x, top: y, fontSize: 16, opacity: 0.8, animationDelay: `${i * 0.4}s` }}>✨</span>
      ))}
    </div>
  );
}

export default Play;
