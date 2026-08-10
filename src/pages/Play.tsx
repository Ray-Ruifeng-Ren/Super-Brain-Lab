import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { SchulteGame } from "@/components/games/SchulteGame";
import { ReactionGame } from "@/components/games/ReactionGame";
import { FlashMathGame, type FlashCfg } from "@/components/games/FlashMathGame";
import { AbacusGame } from "@/components/games/AbacusGame";
import { DEFAULT_ABACUS_CFG, abacusMode, type AbacusCfg } from "@/lib/abacus";
import { NBackGame } from "@/components/games/NBackGame";
import { CardMemoryGame } from "@/components/games/CardMemoryGame";
import { OrbitFocusGame } from "@/components/games/OrbitFocusGame";
import { GauntletFlashGame } from "@/components/games/GauntletFlashGame";
import { DEFAULT_GAUNTLET, encodeMode, type GauntletConfig } from "@/lib/gauntlet";
import { ProLeaderboard } from "@/components/ProLeaderboard";
import { AccountMenu } from "@/components/AccountMenu";
import { PracticeLog } from "@/components/PracticeLog";
import { MistakeBook } from "@/components/MistakeBook";
import { PracticeStats } from "@/components/PracticeStats";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const Play = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [schulteSize, setSchulteSize] = useState(4);
  const [flashCfg, setFlashCfg] = useState<FlashCfg>({ count: 5, digits: 2, speedMs: 700, includeSub: false, rounds: 1 });
  const [flashMistakeMode, setFlashMistakeMode] = useState(false);
  const [abacusCfg, setAbacusCfg] = useState<AbacusCfg>(DEFAULT_ABACUS_CFG);
  const [abacusMistakeMode, setAbacusMistakeMode] = useState(false);
  const [abacusView, setAbacusView] = useState<"home" | "train">("home");
  const [nbackCfg, setNbackCfg] = useState({ n: 2, trials: 20, intervalMs: 2000 });
  const [orbitMode, setOrbitMode] = useState<string>("overall");
  const [gauntletCfg, setGauntletCfg] = useState<GauntletConfig>(DEFAULT_GAUNTLET);
  const [gauntletView, setGauntletView] = useState<"overall" | "current">("overall");

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
    game.id === "abacus" ? abacusMode(abacusCfg) :
    game.id === "nback" ? `${nbackCfg.n}-back-${nbackCfg.trials}` :
    game.id === "cards" ? "deck52" :
    game.id === "orbit" ? orbitMode :
    game.id === "gauntlet" ? (gauntletView === "overall" ? "overall" : encodeMode(gauntletCfg)) :
    "default";

  const isAbacus = game.id === "abacus";

  return (
    <div
      className={cn("min-h-screen", isAbacus ? "relative overflow-hidden" : "bg-background")}
      style={isAbacus ? { background: "linear-gradient(180deg, #BDE8FF 0%, #DDF3FF 34%, #FBF1D8 70%, #FFF6E6 100%)" } : undefined}
    >
      {isAbacus && <AbacusScene view={abacusView} />}
      <header className={cn("sticky top-0 z-30", isAbacus ? "border-b-0 bg-transparent" : "border-b border-border bg-background/90 backdrop-blur")}>
        <div className="container flex items-center justify-between py-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t.arena}
            <span className="ml-1 text-muted-foreground/60">/</span>
            <span className="ml-1 text-foreground">{t.games[game.id]?.name ?? game.name}</span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className={cn("container py-2 md:py-3", isAbacus && "relative z-10")}>
        {game.id === "flashmath" && (
          <div className="mb-2">
            <PracticeStats game="flashmath" refreshKey={refreshKey} />
          </div>
        )}

        {game.id === "abacus" && abacusView === "train" && (
          <div className="mb-2">
            <PracticeStats game="abacus" refreshKey={refreshKey} />
          </div>
        )}

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

        <div className={cn("grid gap-3", isAbacus && abacusView === "home" ? "" : "lg:grid-cols-[1fr_560px]")}>
          <div className={cn("flex flex-col", isAbacus ? "" : "rounded-md border border-border bg-card p-3 md:p-4")}>
            {game.id === "schulte" && <SchulteGame size={schulteSize} onFinished={handleFinished} />}
            {game.id === "reaction" && <ReactionGame onFinished={handleFinished} />}
            {game.id === "flashmath" && (
              <FlashMathGame
                onFinished={handleFinished}
                onCfgChange={setFlashCfg}
                mistakeMode={flashMistakeMode}
                onMistakeModeChange={setFlashMistakeMode}
              />
            )}
            {game.id === "abacus" && (
              <AbacusGame
                onFinished={handleFinished}
                onCfgChange={setAbacusCfg}
                onViewChange={setAbacusView}
                mistakeMode={abacusMistakeMode}
                onMistakeModeChange={setAbacusMistakeMode}
              />
            )}
            {game.id === "nback" && <NBackGame onFinished={handleFinished} onCfgChange={setNbackCfg} />}
            {game.id === "cards" && <CardMemoryGame />}
            {game.id === "orbit" && <OrbitFocusGame onFinished={handleFinished} />}
            {game.id === "gauntlet" && <GauntletFlashGame onFinished={handleFinished} onCfgChange={setGauntletCfg} />}
          </div>
          {!(isAbacus && abacusView === "home") && (
          <aside className="space-y-3 lg:flex lg:flex-col">
            {game.id === "orbit" && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setOrbitMode("overall")}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    orbitMode === "overall"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  PFI 通榜
                </button>
                {Array.from({ length: 10 }).map((_, i) => {
                  const m = `L${i + 1}`;
                  return (
                    <button
                      key={m}
                      onClick={() => setOrbitMode(m)}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono-tabular text-[11px] font-medium transition-colors",
                        orbitMode === m
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
            {game.id === "gauntlet" && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setGauntletView("overall")}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    gauntletView === "overall"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  GFI 通榜
                </button>
                <button
                  onClick={() => setGauntletView("current")}
                  className={cn(
                    "rounded-md border px-2.5 py-1 font-mono-tabular text-[11px] font-medium transition-colors",
                    gauntletView === "current"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  title={encodeMode(gauntletCfg)}
                >
                  当前配置榜
                </button>
              </div>
            )}
            {game.id === "flashmath" ? (
              <div className="h-full min-h-[520px]">
                <PracticeLog
                  game="flashmath"
                  refreshKey={refreshKey}
                  extraTab={<ProLeaderboard game={game.id} mode={mode} refreshKey={refreshKey} />}
                  mistakeTab={
                    <MistakeBook
                      game="flashmath"
                      refreshKey={refreshKey}
                      mistakeMode={flashMistakeMode}
                      onMistakeModeChange={setFlashMistakeMode}
                    />
                  }
                />
              </div>
            ) : game.id === "abacus" ? (
              <div className="h-full min-h-[520px]">
                <PracticeLog
                  game="abacus"
                  refreshKey={refreshKey}
                  extraTab={<ProLeaderboard game={game.id} mode={mode} refreshKey={refreshKey} />}
                  mistakeTab={
                    <MistakeBook
                      game="abacus"
                      refreshKey={refreshKey}
                      mistakeMode={abacusMistakeMode}
                      onMistakeModeChange={setAbacusMistakeMode}
                    />
                  }
                />
              </div>
            ) : (
              <ProLeaderboard game={game.id} mode={mode} refreshKey={refreshKey} />
            )}
          </aside>
          )}
        </div>
      </main>
    </div>
  );
};

// 珠心算专属:童话世界背景(原创绘制,借鉴洛克王国的构图与配色,未使用其素材)
function Cloud({ x, y, s, o = 0.95 }: { x: number; y: number; s: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      <ellipse cx="0" cy="10" rx="60" ry="26" fill="#EAF6FF" />
      <ellipse cx="0" cy="0" rx="46" ry="30" fill="#fff" />
      <ellipse cx="42" cy="8" rx="38" ry="24" fill="#fff" />
      <ellipse cx="-40" cy="10" rx="34" ry="22" fill="#fff" />
      <ellipse cx="20" cy="-14" rx="30" ry="22" fill="#fff" />
    </g>
  );
}
function Tower({ x, w, h, roof }: { x: number; w: number; h: number; roof: string }) {
  return (
    <g>
      <rect x={x} y={430 - h} width={w} height={h} rx="4" fill="#FBF6EC" />
      <polygon points={`${x - 4},${430 - h} ${x + w + 4},${430 - h} ${x + w / 2},${430 - h - w * 1.1}`} fill={roof} />
      <rect x={x + w / 2 - 4} y={430 - h + 14} width="8" height="14" rx="3" fill="#BFD8F0" />
    </g>
  );
}
function AbacusScene({ view }: { view: "home" | "train" }) {
  // 首页用主视觉大图(home-bg.png);训练页用清淡草原(abacus-bg.png)。缺失则回退原创 SVG 场景。
  const [bgOk, setBgOk] = useState(true);
  const bgSrc = view === "home" ? "/home-bg.png" : "/abacus-bg.png";
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* 原创场景(回退底) */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 1440 810" preserveAspectRatio="xMidYMid slice">
        {/* 天空 */}
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8FD1FF" />
            <stop offset="0.5" stopColor="#C4E9FF" />
            <stop offset="0.8" stopColor="#EAF6FF" />
            <stop offset="1" stopColor="#FBF3DF" />
          </linearGradient>
          <linearGradient id="hillA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A6E07E" /><stop offset="1" stopColor="#8AD062" /></linearGradient>
          <linearGradient id="hillB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7FC85A" /><stop offset="1" stopColor="#63B441" /></linearGradient>
        </defs>
        <rect width="1440" height="810" fill="url(#sky)" />
        {/* 太阳光晕 */}
        <circle cx="1180" cy="120" r="180" fill="#FFF3C9" opacity="0.5" />
        <circle cx="1180" cy="120" r="70" fill="#FFF6DA" opacity="0.9" />
        {/* 彩虹 */}
        <g fill="none" strokeWidth="7" opacity="0.5">
          {["#FF8FA3", "#FFC46B", "#FFE873", "#9BE38B", "#7FD1FF", "#C6A6FF"].map((c, i) => (
            <path key={i} d={`M ${120 + i * 8} 300 A ${300 - i * 8} ${300 - i * 8} 0 0 1 ${720 - i * 8} 300`} stroke={c} />
          ))}
        </g>
        {/* 远处城堡剪影(浅色,不抢内容) */}
        <g opacity="0.55">
          <Tower x={690} w={40} h={150} roof="#E8654E" />
          <Tower x={760} w={54} h={200} roof="#E8654E" />
          <Tower x={834} w={40} h={150} roof="#E8654E" />
          <rect x={686} y={330} width="196" height="100" fill="#FBF6EC" />
          <rect x={720} y={370} width="26" height="60" rx="12" fill="#CFE4F6" />
          <rect x={824} y={370} width="26" height="60" rx="12" fill="#CFE4F6" />
        </g>
        {/* 云朵 */}
        <Cloud x={230} y={130} s={1.1} />
        <Cloud x={520} y={90} s={0.8} o={0.85} />
        <Cloud x={1040} y={150} s={1.0} />
        <Cloud x={1300} y={90} s={0.7} o={0.8} />
        {/* 金色大树(左) */}
        <g>
          <path d="M150 470 C 140 400 150 360 165 330 C 150 300 175 285 185 300 C 205 275 235 290 225 315 C 250 320 245 355 225 360 C 235 400 220 450 210 470 Z" fill="#F6C445" />
          <circle cx="150" cy="360" r="46" fill="#FFD75E" />
          <circle cx="215" cy="345" r="52" fill="#FBCB47" />
          <circle cx="185" cy="315" r="44" fill="#FFDE77" />
          <rect x="176" y="450" width="16" height="60" rx="6" fill="#E9E2D2" />
        </g>
        {/* 层叠草坡 */}
        <path d="M0 560 Q 360 500 760 560 T 1440 540 V810 H0 Z" fill="url(#hillA)" opacity="0.9" />
        <path d="M0 640 Q 420 580 900 650 T 1440 630 V810 H0 Z" fill="url(#hillB)" />
        {/* 小花 */}
        {[[120, 690], [300, 720], [520, 700], [760, 730], [1000, 705], [1240, 725], [1360, 700]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <circle key={a} cx={Math.cos(a * Math.PI / 180) * 7} cy={Math.sin(a * Math.PI / 180) * 7} r="5" fill={i % 2 ? "#FF9FB2" : "#FFFFFF"} />
            ))}
            <circle r="4" fill="#FFD75E" />
          </g>
        ))}
      </svg>
      {/* 已授权图片背景(存在时覆盖在原创场景之上) */}
      {bgOk && (
        <>
          <img
            key={bgSrc}
            src={bgSrc}
            alt=""
            onError={() => setBgOk(false)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* 可读性蒙版:训练页更强(护住卡片文字),首页较淡(露出主视觉) */}
          <div style={{ position: "absolute", inset: 0, background: view === "home"
            ? "linear-gradient(180deg, rgba(255,255,255,.05) 0%, rgba(255,251,242,.12) 60%, rgba(255,248,236,.30) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,.30) 0%, rgba(255,251,242,.55) 45%, rgba(255,248,236,.78) 100%)" }} />
        </>
      )}
      {/* 闪烁星点 */}
      {[["22%", "26%"], ["70%", "20%"], ["40%", "16%"], ["86%", "34%"], ["12%", "40%"]].map(([x, y], i) => (
        <span key={i} className="animate-pulse" style={{ position: "absolute", left: x, top: y, fontSize: 15, opacity: 0.85, animationDelay: `${i * 0.5}s` }}>✨</span>
      ))}
    </div>
  );
}

export default Play;
