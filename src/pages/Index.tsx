import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import TreeBackdrop from "@/components/hero/TreeBackdrop";
import SparkleCursor from "@/components/hero/SparkleCursor";
import CardDeck from "@/components/hero/CardDeck";

const Index = () => {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Cinematic looping video + cursor sparkles */}
      <TreeBackdrop />
      <SparkleCursor />

      {/* Nav */}
      <header className="relative z-30">
        <div className="container flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-baseline gap-1.5">
            <span className="font-display text-2xl leading-none tracking-tight text-foreground">
              Super Brain Lab
            </span>
            <sup className="font-mono-tabular text-[9px] text-muted-foreground">®</sup>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            <span className="text-sm text-foreground">{t.nav_lab}</span>
            <span className="cursor-default text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground">
              {t.nav_research}
            </span>
            <span className="cursor-default text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground">
              {t.nav_journal}
            </span>
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
      </header>

      {/* HERO + MODULES — fit in one viewport */}
      <main className="container relative z-10 px-6">
        <section className="flex flex-col items-center pt-6 pb-6 text-center md:pt-8">
          <div className="animate-fade-rise inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {t.status_live}
            </span>
          </div>

          <h1
            className="animate-fade-rise-d1 mt-5 font-display text-5xl leading-[0.95] md:text-6xl lg:text-7xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            <em className="italic text-muted-foreground">{t.hero_headline}</em>
          </h1>

          <p className="animate-fade-rise-d2 mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {t.hero_sub}
          </p>

          <Link
            to="/play/flashmath"
            className="animate-fade-rise-d2 group mt-7 inline-flex items-center gap-2 rounded-full bg-foreground px-9 py-3 text-sm font-medium text-background transition-transform duration-300 hover:scale-[1.03]"
          >
            {t.begin_journey}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </section>

        {/* Modules grid — visible above the fold */}
        <section id="modules" className="relative pb-6">
          <div className="mb-3 flex items-center gap-4">
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              MODULES · 07
            </span>
            <div className="h-px flex-1 bg-border/70" />
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {t.modules_meta}
            </span>
          </div>
          <CardDeck />
        </section>
      </main>
    </div>
  );
};

export default Index;
