import { Link } from "react-router-dom";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { AccountMenu } from "@/components/AccountMenu";
import { ArrowRight, Mic, Trophy, Sparkles } from "lucide-react";

const FEATURED: GameId = "flashmath";
const SECONDARY: GameId[] = ["schulte", "reaction", "nback"];

const Index = () => {
  const featured = GAMES[FEATURED];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="container flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-sm font-semibold">N</div>
            <div>
              <div className="text-sm font-semibold leading-none">NeuroPlay</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Brain Training Arena</div>
            </div>
          </Link>
          <AccountMenu />
        </div>
      </header>

      <main className="container max-w-5xl py-12 md:py-16">
        {/* Hero */}
        <section className="grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> 今日推荐
            </div>
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight md:text-6xl">
              专注、速算、记忆<br />
              <em className="not-italic text-primary">皆可量化。</em>
            </h1>
            <p className="mt-5 max-w-prose text-base text-muted-foreground">
              一套面向认知极限的训练与排行系统。每一笔成绩都被记录，每一次进步都可比较。
            </p>
            <div className="mt-7 flex items-center gap-3">
              <Link
                to={`/play/${featured.id}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-95"
              >
                开始 {featured.name} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to={`/play/nback`}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                浏览全部训练 →
              </Link>
            </div>
          </div>

          <Link
            to={`/play/${featured.id}`}
            className="group block rounded-md border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>{featured.tagline}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <h2 className="mt-3 font-display text-2xl">{featured.name}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{featured.description}</p>
            <div className="mt-5 flex flex-wrap gap-1.5 text-[10px]">
              <Tag><Mic className="h-2.5 w-2.5" /> 语音作答</Tag>
              <Tag>1–7 位</Tag>
              <Tag>200ms 极速</Tag>
              <Tag>专业出题</Tag>
            </div>
          </Link>
        </section>

        {/* Modules */}
        <section className="mt-20">
          <div className="mb-5 flex items-baseline justify-between border-b border-border pb-2.5">
            <h3 className="font-display text-xl">认知矩阵</h3>
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {SECONDARY.length} Modules
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {SECONDARY.map((id) => {
              const g = GAMES[id];
              return (
                <Link
                  key={id}
                  to={`/play/${id}`}
                  className="group rounded-md border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent font-mono-tabular text-xs font-semibold text-primary">
                      {g.initial}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <h4 className="mt-3 font-display text-lg">{g.name}</h4>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{g.tagline}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{g.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Values */}
        <section className="mt-20 grid gap-6 border-t border-border pt-12 md:grid-cols-3">
          <Value title="云端排行榜" body="周榜、总榜、个人最佳，全自动同步与排序。" icon={<Trophy className="h-3.5 w-3.5 text-primary" />} />
          <Value title="语音作答" body="解放双手，模拟真实赛场计时与作答方式。" icon={<Mic className="h-3.5 w-3.5 text-primary" />} />
          <Value title="科学出题" body="每位 0–9 均匀分布、单笔无重复，达到专业珠心算标准。" icon={<Sparkles className="h-3.5 w-3.5 text-primary" />} />
        </section>

        <footer className="mt-16 border-t border-border pt-6 text-center text-[11px] text-muted-foreground">
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
      <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card">{icon}</div>
      <h4 className="mt-3 font-display text-base">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export default Index;
