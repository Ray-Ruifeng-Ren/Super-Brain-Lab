import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { SchulteGame } from "@/components/games/SchulteGame";
import { ReactionGame } from "@/components/games/ReactionGame";
import { FlashMathGame, type FlashCfg } from "@/components/games/FlashMathGame";
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
import { cn } from "@/lib/utils";

const Play = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [schulteSize, setSchulteSize] = useState(4);
  const [flashCfg, setFlashCfg] = useState<FlashCfg>({ count: 5, digits: 2, speedMs: 700, includeSub: false });
  const [flashMistakeMode, setFlashMistakeMode] = useState(false);
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
    game.id === "nback" ? `${nbackCfg.n}-back-${nbackCfg.trials}` :
    game.id === "cards" ? "deck52" :
    game.id === "orbit" ? orbitMode :
    game.id === "gauntlet" ? (gauntletView === "overall" ? "overall" : encodeMode(gauntletCfg)) :
    "default";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="container flex items-center justify-between py-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 广场
            <span className="ml-1 text-muted-foreground/60">/</span>
            <span className="ml-1 text-foreground">{game.name}</span>
          </button>
          <AccountMenu />
        </div>
      </header>

      <main className="container py-2 md:py-3">
        {game.id === "flashmath" && (
          <div className="mb-2">
            <PracticeStats game="flashmath" refreshKey={refreshKey} />
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
          <div className="flex flex-col rounded-md border border-border bg-card p-3 md:p-4">
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
            ) : (
              <ProLeaderboard game={game.id} mode={mode} refreshKey={refreshKey} />
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Play;
