import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import AnatomicalBrain from "@/components/hero/AnatomicalBrain";
import CardDeck from "@/components/hero/CardDeck";

const Index = () => {
  const { t } = useI18n();

  const scrollToModules = () => {
    document.getElementById("modules")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient warm wash — Aethera-style cinematic backdrop, no video */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 520px at 50% 18%, hsl(160 60% 94% / 0.55), transparent 60%), radial-gradient(700px 420px at 88% 6%, hsl(40 40% 92% / 0.7), transparent 60%)",
        }}
      />

      {/* Nav — minimal, Aethera-pill CTA, hover color transitions */}
      <header className="relative z-30">
        <div className="container flex items-center justify-between px-6 py-5">
          <Link to="/" className="group flex items-baseline gap-1.5">
            <span className="font-display text-2xl leading-none tracking-tight text-foreground">
              Super Brain Lab
            </span>
            <sup className="font-mono-tabular text-[9px] text-muted-foreground">®</sup>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {[
              { label: t.nav_lab, active: true },
              { label: t.nav_modules, onClick: scrollToModules },
              { label: t.nav_research },
              { label: t.nav_journal },
            ].map((item, i) =>
              item.onClick ? (
                <button
                  key={i}
                  onClick={item.onClick}
                  className="text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
                >
                  {item.label}
                </button>
              ) : (
                <span
                  key={i}
                  className={`text-sm transition-colors duration-300 ${
                    item.active ? "text-foreground" : "cursor-default text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </span>
              )
            )}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <AccountMenu />
            <Link
              to="/play/flashmath"
              className="ml-1 rounded-full bg-foreground px-5 py-2 text-xs font-medium text-background transition-transform duration-300 hover:scale-[1.03]"
            >
              {t.begin_journey}
            </Link>
          </div>
        </div>
        <div className="container px-6"><div className="h-px w-full bg-border/70" /></div>
      </header>

      {/* HERO */}
      <main className="container px-6">
        <section className="flex flex-col items-center pt-10 pb-10 text-center md:pt-14">
          {/* Status chip */}
          <div className="animate-fade-rise inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {t.status_live}
            </span>
          </div>

          <span className="animate-fade-rise mt-6 font-mono-tabular text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            {t.lab_tag}
          </span>

          <h1
            className="animate-fade-rise-d1 mt-5 max-w-5xl font-display text-5xl leading-[0.95] md:text-7xl lg:text-[5.5rem]"
            style={{ letterSpacing: "-0.03em" }}
          >
            {t.hero_h1_a}
            <br />
            <em className="italic text-muted-foreground">{t.hero_h1_b}</em>
          </h1>

          <p className="animate-fade-rise-d2 mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {t.hero_desc}
          </p>

          {/* Brain centerpiece with halo */}
          <div className="animate-fade-rise-d2 relative mt-8">
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, hsl(160 70% 60% / 0.16), transparent 70%)",
                animation: "brain-breath 5.4s ease-in-out infinite",
              }}
            />
            <AnatomicalBrain size={300} />
          </div>

          <Link
            to="/play/flashmath"
            className="animate-fade-rise-d3 group mt-10 inline-flex items-center gap-2 rounded-full bg-foreground px-10 py-3.5 text-sm font-medium text-background transition-transform duration-300 hover:scale-[1.03]"
          >
            {t.begin_journey}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>

          {/* Scroll cue */}
          <button
            onClick={scrollToModules}
            className="animate-fade-rise-d3 mt-12 flex flex-col items-center gap-1.5 text-muted-foreground transition-colors duration-300 hover:text-foreground"
          >
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.28em]">
              {t.scroll_cue}
            </span>
            <ChevronDown className="h-3.5 w-3.5 animate-bounce" style={{ animationDuration: "2.2s" }} />
          </button>
        </section>

        {/* MODULES */}
        <section id="modules" className="relative scroll-mt-8 pb-12 pt-4">
          <div className="mb-5 flex items-center gap-4">
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              MODULES · 07
            </span>
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {t.modules_meta}
            </span>
          </div>
          <CardDeck />
        </section>

        {/* footer line */}
        <footer className="border-t border-border py-6 text-center">
          <p className="font-mono-tabular text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            {t.coauthor_sub}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
