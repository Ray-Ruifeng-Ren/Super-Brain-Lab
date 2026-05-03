import { Link } from "react-router-dom";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { AccountMenu } from "@/components/AccountMenu";
import { ArrowRight, Mic, Trophy, Sparkles, Zap, Brain, Timer, Grid3x3, Spade } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const FEATURED: GameId = "flashmath";
const SECONDARY: GameId[] = ["schulte", "reaction", "nback", "cards"];

const ICONS: Record<GameId, LucideIcon> = {
  flashmath: Zap,
  schulte: Grid3x3,
  reaction: Timer,
  nback: Brain,
  cards: Spade,
};

const STATS: { label: string; value: string }[] = [
  { label: "训练模块", value: "5" },
  { label: "极速档位", value: "200ms" },
  { label: "云端排行", value: "实时" },
  { label: "语音作答", value: "支持" },
];

const Index = () => {
  const featured = GAMES[FEATURED];
  const FeaturedIcon = ICONS[FEATURED];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="container flex items-center justify-between py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-sm font-semibold">N</div>
            <div>
              <div className="text-sm font-semibold leading-none">NeuroPlay</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Brain Training Arena</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-xs text-muted-foreground md:flex">
            <a href="#modules" className="transition-colors hover:text-foreground">认知矩阵</a>
            <a href="#values" className="transition-colors hover:text-foreground">设计理念</a>
            <Link to={`/play/${FEATURED}`} className="transition-colors hover:text-foreground">立即训练</Link>
          </nav>
          <AccountMenu />
        </div>
      </header>

      <main className="container max-w-6xl">
        {/* Hero — denser, two columns of equal weight */}
        <section className="grid gap-10 py-14 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-primary" /> 专业级心算 · 排行榜 v2
            </div>
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight md:text-[64px]">
              专注、速算、记忆
              <br />
              <em className="not-italic text-primary">皆可量化。</em>
            </h1>
            <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
              一套面向认知极限的训练与排行系统。每一笔成绩都被记录，每一次进步都可比较。
            </p>
            <div className="mt-7 flex items-center gap-4">
              <Link
                to={`/play/${featured.id}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-95"
              >
                开始 {featured.name} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a
                href="#modules"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                浏览全部训练 →
              </a>
            </div>

            {/* Inline stats */}
            <dl className="mt-10 grid grid-cols-4 gap-4 border-t border-border pt-6">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{s.label}</dt>
                  <dd className="mt-1 font-mono-tabular text-xl font-semibold tracking-tight">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Featured card — bigger, with mock UI hint */}
          <Link
            to={`/play/${featured.id}`}
            className="group relative block overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-primary/5" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" /> 今日推荐
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>

              <div className="mt-6 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FeaturedIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl leading-tight">{featured.name}</h2>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {featured.tagline}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{featured.description}</p>

              {/* Mock display */}
              <div className="mt-5 rounded-md border border-border bg-foreground p-5 text-center">
                <div className="font-mono-tabular text-5xl font-semibold tracking-tight text-background">
                  47 <span className="text-background/40">−</span> 82
                </div>
                <div className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-background/50">
                  step 3 / 10 · 200 ms
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-1.5 text-[10px]">
                <Tag><Mic className="h-2.5 w-2.5" /> 语音作答</Tag>
                <Tag>1–7 位</Tag>
                <Tag>200ms 极速</Tag>
                <Tag>世界冠军规格</Tag>
              </div>
            </div>
          </Link>
        </section>

        {/* Modules — unified row of 4 with consistent icons */}
        <section id="modules" className="border-t border-border py-16">
          <div className="mb-6 flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">02 · Modules</div>
              <h3 className="mt-1 font-display text-2xl">认知矩阵</h3>
            </div>
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {SECONDARY.length} Modules · 全部已上线
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECONDARY.map((id, i) => {
              const g = GAMES[id];
              const Icon = ICONS[id];
              return (
                <Link
                  key={id}
                  to={`/play/${id}`}
                  className="group relative flex flex-col rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-mono-tabular text-[10px] text-muted-foreground">
                      0{i + 2}
                    </span>
                  </div>
                  <h4 className="mt-4 font-display text-lg">{g.name}</h4>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{g.tagline}</p>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{g.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
                    进入训练
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Values */}
        <section id="values" className="border-t border-border py-16">
          <div className="mb-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">03 · Why</div>
            <h3 className="mt-1 font-display text-2xl">为竞技者设计</h3>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Value title="云端排行榜" body="周榜、总榜、个人最佳，全自动同步与排序。" icon={<Trophy className="h-4 w-4 text-primary" />} />
            <Value title="语音作答" body="解放双手，模拟真实赛场计时与作答方式。" icon={<Mic className="h-4 w-4 text-primary" />} />
            <Value title="科学出题" body="每位 0–9 均匀分布、单笔无重复，达到专业珠心算标准。" icon={<Sparkles className="h-4 w-4 text-primary" />} />
          </div>
        </section>

        {/* CTA strip */}
        <section className="my-12 rounded-lg border border-border bg-card p-8 md:p-10">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h4 className="font-display text-xl">准备好登榜了吗？</h4>
              <p className="mt-1 text-sm text-muted-foreground">登录后所有成绩自动云端同步，与全球玩家同台竞速。</p>
            </div>
            <Link
              to={`/play/${featured.id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-95"
            >
              立即开始 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-border py-6 text-center text-[11px] text-muted-foreground">
          © NeuroPlay · 登录后成绩自动同步到云端
        </footer>
      </main>
    </div>
  );
};

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 font-medium text-muted-foreground">
      {children}
    </span>
  );
}
function Value({ title, body, icon }: { title: string; body: string; icon: React.ReactNode }) {
  return (
    <div>
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card">{icon}</div>
      <h4 className="mt-3 font-display text-base">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export default Index;
