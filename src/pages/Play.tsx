import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Brain, Calculator, Sparkles, User, Zap } from "lucide-react";
import { GAMES, GameId, getPlayerName, setPlayerName } from "@/lib/leaderboard";
import { SchulteGame } from "@/components/games/SchulteGame";
import { ReactionGame } from "@/components/games/ReactionGame";
import { MemoryGame } from "@/components/games/MemoryGame";
import { FlashMathGame } from "@/components/games/FlashMathGame";
import { ProLeaderboard } from "@/components/ProLeaderboard";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ICONS = { schulte: Brain, reaction: Zap, memory: Sparkles, flashmath: Calculator };

const Play = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [name, setName] = useState("");
  const [schulteSize, setSchulteSize] = useState(4);
  const [flashCfg, setFlashCfg] = useState({ count: 5, digits: 2, includeSub: false });

  useEffect(() => setName(getPlayerName()), []);

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
  const Icon = ICONS[game.id];
  const handleFinished = (extra?: { count: number; digits: number; includeSub: boolean }) => {
    if (extra) setFlashCfg(extra);
    setRefreshKey((k) => k + 1);
  };

  const mode =
    game.id === "schulte"
      ? `${schulteSize}x${schulteSize}`
      : game.id === "flashmath"
        ? `${flashCfg.count}q-${flashCfg.digits}d${flashCfg.includeSub ? "-sub" : ""}`
        : "default";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex items-center justify-between py-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> 广场
          </button>
          <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPlayerName(e.target.value);
              }}
              placeholder="设置昵称"
              className="h-6 w-28 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
              maxLength={12}
            />
          </div>
        </div>
      </header>

      <section className={cn("border-b bg-gradient-to-br text-white", game.accent)}>
        <div className="container py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <Icon className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                {game.tagline}
              </div>
              <h1 className="text-2xl font-bold leading-tight">{game.name}</h1>
            </div>
          </div>
          <p className="mt-2 text-sm opacity-90">{game.description}</p>
        </div>
      </section>

      <main className="container py-6 md:py-8">
        {game.id === "schulte" && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              难度
            </span>
            {[3, 4, 5, 6].map((s) => (
              <button
                key={s}
                onClick={() => setSchulteSize(s)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition-all",
                  schulteSize === s
                    ? "border-transparent bg-gradient-primary text-primary-foreground shadow-md"
                    : "bg-card hover:border-primary/40 hover:text-primary",
                )}
              >
                {s}×{s}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border bg-card p-5 shadow-elegant md:p-7">
            {game.id === "schulte" && <SchulteGame size={schulteSize} onFinished={() => handleFinished()} />}
            {game.id === "reaction" && <ReactionGame onFinished={() => handleFinished()} />}
            {game.id === "memory" && <MemoryGame onFinished={() => handleFinished()} />}
            {game.id === "flashmath" && <FlashMathGame onFinished={() => handleFinished()} />}
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
