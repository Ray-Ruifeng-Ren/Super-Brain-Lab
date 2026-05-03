import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  GAMES,
  GameId,
  getGlobalBest,
  getPlayerCount,
  getPlayerName,
  setPlayerName,
} from "@/lib/leaderboard";
import {
  Brain,
  User,
  ArrowRight,
  Users,
  Trophy,
  Zap,
  Sparkles,
  Calculator,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GAME_ICONS = {
  schulte: Brain,
  reaction: Zap,
  memory: Sparkles,
  flashmath: Calculator,
};

const FEATURED_ID: GameId = "flashmath";
const SECONDARY_IDS: GameId[] = ["schulte", "reaction", "memory"];

const Index = () => {
  const [name, setName] = useState("");
  useEffect(() => setName(getPlayerName()), []);

  const featured = GAMES[FEATURED_ID];
  const FeaturedIcon = GAME_ICONS[FEATURED_ID];

  return (
    <div className="min-h-screen bg-background">
      {/* Slogan strip — slim, top */}
      <div className="bg-gradient-hero text-primary-foreground">
        <div className="container flex items-center justify-center gap-2 py-1.5 text-[11px] font-medium">
          <Sparkles className="h-3 w-3" />
          脑力竞技广场 · 注意力 · 反应 · 记忆 · 速算
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-lg">
        <div className="container flex items-center justify-between py-2.5">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none tracking-tight">NeuroPlay</h1>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">
                脑力竞技场
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPlayerName(e.target.value);
              }}
              placeholder="昵称"
              className="h-5 w-24 border-0 bg-transparent p-0 text-xs focus-visible:ring-0"
              maxLength={12}
            />
          </div>
        </div>
      </header>

      <main className="container py-5 space-y-7">
        {/* Featured — first thing user sees */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-energy">
              <Sparkles className="h-3 w-3" />
              今日主推
            </div>
            <span className="text-[10px] text-muted-foreground">推荐先打这个</span>
          </div>

          <Link
            to={`/play/${featured.id}`}
            className={cn(
              "group relative block overflow-hidden rounded-2xl text-white shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow",
              "bg-gradient-to-br",
              featured.accent,
            )}
          >
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative grid gap-4 p-5 md:grid-cols-[1fr_auto] md:p-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-90">
                  {featured.tagline}
                </div>
                <h3 className="mt-1.5 text-2xl font-bold md:text-3xl">{featured.name}</h3>
                <p className="mt-1.5 max-w-md text-xs opacity-95 md:text-sm">
                  {featured.description}。世界级珠心算选手都在用，速度可低至 200ms。
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Tag icon={<Mic className="h-2.5 w-2.5" />}>语音作答</Tag>
                  <Tag>自定义笔数 1-100</Tag>
                  <Tag>位数 1-7</Tag>
                </div>
                <Button
                  size="sm"
                  className="mt-4 bg-white text-foreground hover:bg-white/90 shadow-md"
                >
                  立即挑战
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
              <div className="hidden items-center justify-center md:flex">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <FeaturedIcon className="h-12 w-12" strokeWidth={1.8} />
                </div>
              </div>
            </div>
          </Link>
        </section>

        {/* Secondary games */}
        <section>
          <div className="mb-2.5 flex items-end justify-between">
            <h3 className="text-sm font-bold">更多训练</h3>
            <span className="text-[10px] text-muted-foreground">
              {SECONDARY_IDS.length} 款
            </span>
          </div>
          <div className="grid gap-2.5 md:grid-cols-3">
            {SECONDARY_IDS.map((id) => {
              const g = GAMES[id];
              const Icon = GAME_ICONS[id];
              const best = getGlobalBest(id, defaultMode(id));
              const players = getPlayerCount(id, defaultMode(id));
              return (
                <Link
                  key={id}
                  to={`/play/${id}`}
                  className="group relative flex items-center gap-2.5 overflow-hidden rounded-xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
                      "bg-gradient-to-br",
                      g.accent,
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="truncate text-xs font-bold">{g.name}</h4>
                      <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5" />
                        {players}
                      </span>
                      {best && (
                        <span className="flex items-center gap-0.5">
                          <Trophy className="h-2.5 w-2.5 text-energy" />
                          <span className="font-mono-tabular font-semibold text-foreground">
                            {g.formatValue(best.value)}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Value props */}
        <section className="grid gap-2.5 md:grid-cols-3">
          <ValueCard
            icon={<Trophy className="h-4 w-4" />}
            title="专业排行榜"
            text="周榜 · 总榜 · 个人最佳"
          />
          <ValueCard
            icon={<Mic className="h-4 w-4" />}
            title="语音作答"
            text="动嘴不动手，模拟真实赛场"
          />
          <ValueCard
            icon={<Sparkles className="h-4 w-4" />}
            title="科学训练"
            text="融合心算、记忆、注意力"
          />
        </section>

        <footer className="text-center text-[10px] text-muted-foreground">
          排名当前保存在本机 · 接入 Lovable Cloud 即可解锁全球榜
        </footer>
      </main>
    </div>
  );
};

function Tag({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
      {icon}
      {children}
    </span>
  );
}

function ValueCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-gradient-card p-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h4 className="mt-2 text-xs font-bold">{title}</h4>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{text}</p>
    </div>
  );
}

function defaultMode(id: GameId) {
  if (id === "schulte") return "4x4";
  if (id === "flashmath") return "5q-2d";
  return "default";
}

export default Index;
