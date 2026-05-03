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
  Target,
  Gauge,
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
      {/* Glassy header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none tracking-tight">NeuroPlay</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                脑力竞技场
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 transition-shadow hover:shadow-md">
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

      {/* Compact hero */}
      <section className="relative overflow-hidden border-b bg-gradient-hero">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="container relative py-10 text-primary-foreground">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-90">
            <Sparkles className="h-3.5 w-3.5" />
            脑力竞技广场 · 4 款专业训练
          </div>
          <h2 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
            在快乐里 <span className="opacity-80">进化</span> 你的大脑
          </h2>
          <p className="mt-2 max-w-xl text-sm opacity-90">
            注意力 · 反应 · 记忆 · 速算 —— 全球玩家同台竞技，你的每一次提升都被记录。
          </p>
        </div>
      </section>

      <main className="container py-10 space-y-12">
        {/* Featured game */}
        <section>
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-energy">
            <Sparkles className="h-3.5 w-3.5" />
            今日主推
          </div>

          <Link
            to={`/play/${featured.id}`}
            className={cn(
              "group relative block overflow-hidden rounded-3xl text-white shadow-elegant transition-all hover:-translate-y-1 hover:shadow-glow",
              "bg-gradient-to-br",
              featured.accent,
            )}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 80% 50%, white 1.5px, transparent 1.5px)",
                backgroundSize: "30px 30px",
              }}
            />
            <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
                  {featured.tagline}
                </div>
                <h3 className="mt-2 text-3xl font-bold md:text-4xl">{featured.name}</h3>
                <p className="mt-2 max-w-md text-sm opacity-95 md:text-base">
                  {featured.description}。支持<b>语音作答</b>，闭眼心算也能即时记分。
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Tag icon={<Mic className="h-3 w-3" />}>语音识别</Tag>
                  <Tag icon={<Gauge className="h-3 w-3" />}>速度可调</Tag>
                  <Tag icon={<Target className="h-3 w-3" />}>位数可选</Tag>
                </div>

                <Button
                  size="lg"
                  className="mt-6 bg-white text-foreground hover:bg-white/90 shadow-lg"
                >
                  立即挑战
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white/15 backdrop-blur md:h-40 md:w-40">
                  <FeaturedIcon className="h-16 w-16 md:h-20 md:w-20" strokeWidth={1.8} />
                </div>
              </div>
            </div>
          </Link>
        </section>

        {/* Secondary games */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="text-xl font-bold">更多训练</h3>
              <p className="text-sm text-muted-foreground">挑选一款，加入榜单</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {SECONDARY_IDS.map((id) => {
              const g = GAMES[id];
              const Icon = GAME_ICONS[id];
              const best = getGlobalBest(id, defaultMode(id));
              const players = getPlayerCount(id, defaultMode(id));
              return (
                <Link
                  key={id}
                  to={`/play/${id}`}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                      "bg-gradient-to-br",
                      g.accent,
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="truncate text-sm font-bold">{g.name}</h4>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-2.5 w-2.5" />
                        {players}
                      </span>
                      {best && (
                        <span className="flex items-center gap-1">
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
        <section className="grid gap-4 md:grid-cols-3">
          <ValueCard
            icon={<Trophy className="h-5 w-5" />}
            title="专业排行榜"
            text="周榜 · 总榜 · 个人最佳，每一次进步都看得见"
          />
          <ValueCard
            icon={<Mic className="h-5 w-5" />}
            title="语音作答"
            text="动嘴不动手，更接近真实速算赛场"
          />
          <ValueCard
            icon={<Sparkles className="h-5 w-5" />}
            title="科学训练"
            text="融合心算、记忆、注意力等被验证的训练方法"
          />
        </section>

        <footer className="text-center text-xs text-muted-foreground">
          排名当前保存在本机 · 接入 Lovable Cloud 即可解锁全球榜与好友 PK
        </footer>
      </main>
    </div>
  );
};

function Tag({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur">
      {icon}
      {children}
    </span>
  );
}

function ValueCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border bg-gradient-card p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h4 className="mt-3 text-base font-bold">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function defaultMode(id: GameId) {
  if (id === "schulte") return "4x4";
  if (id === "flashmath") return "5q-2d";
  return "default";
}

export default Index;
