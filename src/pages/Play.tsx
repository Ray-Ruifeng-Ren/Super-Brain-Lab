import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { SchulteGame } from "@/components/games/SchulteGame";
import { ReactionGame } from "@/components/games/ReactionGame";
import { FlashMathGame, type FlashCfg } from "@/components/games/FlashMathGame";
import { NBackGame } from "@/components/games/NBackGame";
import { ProLeaderboard } from "@/components/ProLeaderboard";
import { AccountMenu } from "@/components/AccountMenu";
import { cn } from "@/lib/utils";

const Play = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [schulteSize, setSchulteSize] = useState(4);
  const [flashCfg, setFlashCfg] = useState<FlashCfg>({ count: 5, digits: 2, speedMs: 700, includeSub: false });
  const [nbackCfg, setNbackCfg] = useState({ n: 2, trials: 20, intervalMs: 2000 });

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
          </button>
          <AccountMenu />
        </div>
      </header>

      <section className="border-b border-border bg-card">
        <div className="container py-7">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{game.tagline}</div>
          <h1 className="mt-1 font-display text-3xl leading-tight">{game.name}</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{game.description}</p>
        </div>
      </section>

      <main className="container py-6 md:py-8">
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

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="rounded-md border border-border bg-card p-5 md:p-6">
            {game.id === "schulte" && <SchulteGame size={schulteSize} onFinished={handleFinished} />}
            {game.id === "reaction" && <ReactionGame onFinished={handleFinished} />}
            {game.id === "flashmath" && <FlashMathGame onFinished={handleFinished} onCfgChange={setFlashCfg} />}
            {game.id === "nback" && <NBackGame onFinished={handleFinished} onCfgChange={setNbackCfg} />}
          </div>
          <aside>
            <ProLeaderboard game={game.id} mode={mode} refreshKey={refreshKey} />
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Play;
