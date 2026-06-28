import { Link } from "react-router-dom";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { AccountMenu } from "@/components/AccountMenu";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { ArrowRight, Mic, Trophy, Sparkles } from "lucide-react";

const FEATURED: GameId = "flashmath";
const SECONDARY: GameId[] = ["gauntlet", "schulte", "reaction", "nback", "cards", "orbit"];

const Index = () => {
  const { t } = useI18n();
  const featured = GAMES[FEATURED];
  const fT = t.games[FEATURED];

  return (
    <div className="min-h-screen bg-background">
      {/* Top announcement bar */}
      <div className="relative overflow-hidden border-b border-border bg-foreground text-background">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            background:
              "radial-gradient(60% 120% at 20% 50%, hsl(var(--primary)) 0%, transparent 60%), radial-gradient(50% 120% at 85% 50%, hsl(var(--primary)) 0%, transparent 65%)",
          }}
        />
        <div className="container relative flex items-center justify-center gap-3 py-2 text-center text-[11px] tracking-wide md:text-xs">
          <span className="hidden h-1.5 w-1.5 rounded-full bg-primary md:inline-block animate-pulse" />
          <span className="font-medium">{t.coauthor}</span>
          <span className="hidden text-background/50 md:inline">·</span>
          <span className="hidden font-mono-tabular uppercase tracking-[0.2em] text-background/60 md:inline">
            {t.coauthor_sub}
          </span>
        </div>
      </div>

      <header className="border-b border-border bg-background">
        <div className="container flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-sm font-semibold">N</div>
            <div>
              <div className="text-sm font-semibold leading-none">NeuroPlay</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t.brand_sub}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-12 md:py-16">
        {/* Hero */}
        <section className="relative grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-center">
          {/* Premium backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-8 -top-10 -bottom-10 -z-10"
            style={{
              background:
                "radial-gradient(40% 60% at 15% 20%, hsl(var(--primary) / 0.10) 0%, transparent 70%), radial-gradient(45% 70% at 90% 80%, hsl(var(--primary) / 0.07) 0%, transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> {t.today_pick}
            </div>
            <h1 className="font-display leading-[1.05] tracking-tight md:text-6xl text-4xl">
              {t.hero_h1_a}<br />
              <em className="not-italic text-primary">{t.hero_h1_b}</em>
            </h1>
            <p className="mt-5 max-w-prose text-base text-muted-foreground">
              {t.hero_desc}
            </p>
            <div className="mt-7 flex items-center gap-3">
              <Link
                to={`/play/${featured.id}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-95"
              >
                {t.start} {fT.name} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to={`/play/nback`}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t.browse_all}
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
            <h2 className="mt-3 font-display text-2xl">{fT.name}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{fT.desc}</p>
            <div className="mt-5 flex flex-wrap gap-1.5 text-[10px]">
              <Tag><Mic className="h-2.5 w-2.5" /> {t.tag_voice}</Tag>
              <Tag>{t.tag_digits}</Tag>
              <Tag>{t.tag_speed}</Tag>
              <Tag>{t.tag_pro}</Tag>
            </div>
          </Link>
        </section>

        {/* Modules */}
        <section className="mt-20">
          <div className="mb-5 flex items-baseline justify-between border-b border-border pb-2.5">
            <h3 className="font-display text-xl">{t.matrix}</h3>
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {SECONDARY.length} {t.modules}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECONDARY.map((id) => {
              const g = GAMES[id];
              const gT = t.games[id];
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
                  <h4 className="mt-3 font-display text-lg">{gT.name}</h4>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{g.tagline}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{gT.desc}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Values */}
        <section className="mt-20 grid gap-6 border-t border-border pt-12 md:grid-cols-3">
          <Value title={t.cloud_lb} body={t.cloud_lb_d} icon={<Trophy className="h-3.5 w-3.5 text-primary" />} />
          <Value title={t.voice} body={t.voice_d} icon={<Mic className="h-3.5 w-3.5 text-primary" />} />
          <Value title={t.sci} body={t.sci_d} icon={<Sparkles className="h-3.5 w-3.5 text-primary" />} />
        </section>

        <footer className="mt-16 border-t border-border pt-6 text-center text-[11px] text-muted-foreground">
          {t.footer}
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
