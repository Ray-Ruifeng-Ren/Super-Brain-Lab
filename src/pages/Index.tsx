import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { AccountMenu } from "@/components/AccountMenu";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { ArrowRight, Mic, Trophy, Sparkles } from "lucide-react";
import NeuralCanvas from "@/components/hero/NeuralCanvas";
import { ScrambleText, ScrambleIn } from "@/components/hero/ScrambleText";
import { useLenis } from "@/lib/useLenis";

const FEATURED: GameId = "flashmath";
const SECONDARY: GameId[] = ["gauntlet", "schulte", "reaction", "nback", "cards", "orbit"];

const Index = () => {
  const { t } = useI18n();
  const featured = GAMES[FEATURED];
  const fT = t.games[FEATURED];
  useLenis();

  const [mounted, setMounted] = useState(false);
  const [announceHover, setAnnounceHover] = useState(false);
  const [ctaHover, setCtaHover] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const hero = heroRef.current;
      if (!hero) return;
      const h = hero.offsetHeight;
      const p = Math.min(1, Math.max(0, window.scrollY / (h * 0.6)));
      if (canvasWrapRef.current) {
        canvasWrapRef.current.style.transform = `scale(${1 + p * 0.06})`;
        canvasWrapRef.current.style.opacity = `${1 - p * 0.7}`;
      }
      if (titleRef.current) {
        titleRef.current.style.transform = `translateY(${-p * 40}px)`;
        titleRef.current.style.opacity = `${1 - p * 1.4}`;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Announcement bar — premium */}
      <div className="relative overflow-hidden bg-foreground text-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.7), transparent)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            background:
              "radial-gradient(60% 120% at 20% 50%, hsl(var(--primary)) 0%, transparent 60%), radial-gradient(50% 120% at 85% 50%, hsl(var(--primary)) 0%, transparent 65%)",
          }}
        />
        <div
          className="container relative flex items-center justify-center gap-3 py-2 text-center text-[11px] tracking-wide md:text-xs"
          onMouseEnter={() => setAnnounceHover(true)}
          onMouseLeave={() => setAnnounceHover(false)}
        >
          <span className="relative hidden h-1.5 w-1.5 md:inline-block">
            <span className="absolute inset-0 rounded-full bg-primary" />
            <span className="absolute -inset-1 rounded-full bg-primary/40 animate-ping" style={{ animationDuration: "2.4s" }} />
          </span>
          <ScrambleText text={t.coauthor} isHovered={announceHover} className="font-medium" />
          <span className="hidden text-background/50 md:inline">·</span>
          <span className="hidden font-mono-tabular uppercase tracking-[0.2em] text-background/60 md:inline">
            {t.coauthor_sub}
          </span>
        </div>
      </div>

      {/* Header — sits on dark hero, white text */}
      <header className="absolute left-0 right-0 top-[34px] z-50">
        <div className="container flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-2.5 text-background">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-sm font-semibold">S</div>
            <div>
              <div className="text-sm font-semibold leading-none">Super Brain Lab</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-background/60">{t.brand_sub}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* HERO — cinematic dark */}
      <section
        ref={heroRef}
        className="relative isolate overflow-hidden bg-foreground text-background"
        style={{ minHeight: "min(820px, 100vh)" }}
      >
        {/* particle canvas */}
        <div ref={canvasWrapRef} className="absolute inset-0 z-0 will-change-transform" style={{ transformOrigin: "center" }}>
          <NeuralCanvas className="h-full w-full" />
        </div>

        {/* vignette + grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 40%, transparent 0%, hsl(var(--foreground) / 0.55) 80%), radial-gradient(40% 50% at 50% 100%, hsl(var(--foreground)) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--background)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--background)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* content */}
        <div className="container relative z-10 flex min-h-[100vh] items-center pt-32 pb-40">
          <div ref={titleRef} className="grid w-full gap-12 md:grid-cols-[1.3fr_1fr] md:items-end will-change-transform">
            <div>
              <div
                className={`mb-5 inline-flex items-center gap-2 rounded-full border border-background/15 bg-background/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-background/70 backdrop-blur transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
              >
                <Sparkles className="h-3 w-3 text-primary" /> {t.today_pick}
              </div>
              <h1 className="font-display leading-[0.98] tracking-tight text-5xl md:text-7xl">
                <ScrambleIn text={t.hero_h1_a} trigger={mounted} className="block" />
                <em className="not-italic">
                  <ScrambleIn text={t.hero_h1_b} trigger={mounted} delay={350} className="block text-primary" />
                </em>
              </h1>
              <p
                className={`mt-6 max-w-prose text-[15px] text-background/65 transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
                style={{ transitionDelay: "700ms" }}
              >
                {t.hero_desc}
              </p>
              <div
                className={`mt-9 flex items-center gap-5 transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
                style={{ transitionDelay: "900ms" }}
              >
                <Link
                  to={`/play/${featured.id}`}
                  onMouseEnter={() => setCtaHover(true)}
                  onMouseLeave={() => setCtaHover(false)}
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.6)] transition-transform hover:scale-[1.02]"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />
                  <ScrambleText text={`${t.start} ${fT.name}`} isHovered={ctaHover} />
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to={`/play/nback`}
                  className="story-link text-sm font-medium text-background/70 transition-colors hover:text-background"
                >
                  {t.browse_all}
                </Link>
              </div>
            </div>

            {/* Featured card on right — glassy on dark */}
            <Link
              to={`/play/${featured.id}`}
              className={`group block rounded-xl border border-background/15 bg-background/[0.04] p-6 backdrop-blur-md transition-all duration-1000 hover:border-primary/40 hover:bg-background/[0.07] ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "600ms" }}
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-background/60">
                <span>{featured.tagline}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <h2 className="mt-3 font-display text-2xl text-background">{fT.name}</h2>
              <p className="mt-1.5 text-sm text-background/60">{fT.desc}</p>
              <div className="mt-5 flex flex-wrap gap-1.5 text-[10px]">
                <DarkTag><Mic className="h-2.5 w-2.5" /> {t.tag_voice}</DarkTag>
                <DarkTag>{t.tag_digits}</DarkTag>
                <DarkTag>{t.tag_speed}</DarkTag>
                <DarkTag>{t.tag_pro}</DarkTag>
              </div>
            </Link>
          </div>
        </div>

        {/* dark→light dissolve */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32"
          style={{
            background: "linear-gradient(to bottom, transparent, hsl(var(--background)) 90%)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />
      </section>

      <main className="container max-w-5xl py-16 md:py-20">
        {/* Modules */}
        <section>
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

function DarkTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-background/15 bg-background/[0.04] px-1.5 py-0.5 font-medium text-background/70">
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
