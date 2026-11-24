import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { GAMES, type GameId } from "@/lib/leaderboard";
import { SchulteGame } from "@/components/games/SchulteGame";
import { ReactionGame } from "@/components/games/ReactionGame";
import { FlashMathGame, type FlashCfg, type FlashMode } from "@/components/games/FlashMathGame";
import { AbacusGame } from "@/components/games/AbacusGame";
import { BeadTrain } from "@/components/games/BeadTrain";
import { ScrollTrain } from "@/components/games/ScrollTrain";
import { ObstacleTrain } from "@/components/games/ObstacleTrain";
import { DEFAULT_ABACUS_CFG, abacusMode, type AbacusCfg, type AbacusMode, type Project } from "@/lib/abacus";
import { useEffect } from "react";
import { NBackGame } from "@/components/games/NBackGame";
import { CardMemoryGame } from "@/components/games/CardMemoryGame";
import { OrbitFocusGame } from "@/components/games/OrbitFocusGame";
import { GauntletFlashGame } from "@/components/games/GauntletFlashGame";
import { DEFAULT_GAUNTLET, encodeMode, type GauntletConfig } from "@/lib/gauntlet";
import { ProLeaderboard } from "@/components/ProLeaderboard";
import { RankBoards } from "@/components/RankBoards";
import { modePrefix } from "@/lib/difficulty";
import { AccountMenu } from "@/components/AccountMenu";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { EyeCareToggle } from "@/components/EyeCareToggle";
import { PracticeLog } from "@/components/PracticeLog";
import { MistakeBook } from "@/components/MistakeBook";
import { PracticeStats } from "@/components/PracticeStats";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PROJECT_TILES } from "@/components/ProjectTiles";

const Play = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const modeParam = searchParams.get("mode");
  const projectParam = searchParams.get("project");
  const initialAbacusMode: AbacusMode | undefined =
    modeParam === "flash" || modeParam === "glance" || modeParam === "listen" ? modeParam : undefined;
  const flashInitialMode: FlashMode | undefined =
    modeParam === "flash" || modeParam === "glance" || modeParam === "listen" ? modeParam :
    modeParam === "multiply" || modeParam === "divide" ? "glance" : // 旧链接:乘/除已并入看算,内选运算
    undefined;
  const initialAbacusProject: Project | undefined =
    projectParam === "multiply" || projectParam === "divide" || projectParam === "bead" ? projectParam : undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const [panel, setPanel] = useState<"train" | "board">("train"); // 底部第 5 个 tab:排行榜 + 数据(2026-10-13)
  type BoardProject = "flash" | "listen" | "glance" | "bead" | "scroll" | "obstacle";
  const [boardProject, setBoardProject] = useState<BoardProject>("flash"); // 排行榜顶部可切换看哪个项目
  const [schulteSize, setSchulteSize] = useState(4);
  const [flashCfg, setFlashCfg] = useState<FlashCfg>({ mode: flashInitialMode ?? "flash", op: "addsub", count: 5, digits: 2, digitsMax: 2, method: "mental", listenVoice: "female", speedMs: 700, flashScale: 1, listenSec: 800, listenSpeed: 5, announcePlus: true, announceUnit: true, listenLang: "zh", glanceLimitSec: 0, includeSub: false, rounds: 1, mulA: 2, mulB: 2, divD: 1, divQ: 3, divEnough: "any", decimals: false, decimalPlaces: 2 });
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
          <p className="text-muted-foreground">{lang === "en" ? "Game not found" : "游戏不存在"}</p>
          <Link to="/" className="mt-3 inline-block text-primary underline">{lang === "en" ? "Back to home" : "返回广场"}</Link>
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
  const isFlash = game.id === "flashmath";
  const isScrollPage = isAbacus && projectParam === "scroll"; // 心算马拉松(2026-10-14):与数珠互译同款单页训练台
  const isObstaclePage = isAbacus && projectParam === "obstacle"; // 障碍算(2026-10-15)
  const isBeadPage = isAbacus && (initialAbacusProject === "bead" || isScrollPage || isObstaclePage);
  useEffect(() => { setBoardProject(isObstaclePage ? "obstacle" : isScrollPage ? "scroll" : isBeadPage ? "bead" : ((flashCfg.mode ?? flashInitialMode ?? "flash") as BoardProject)); }, [isBeadPage, isScrollPage, isObstaclePage, flashCfg.mode, flashInitialMode]);
  const flashPrefix = modePrefix(flashCfg.mode ?? flashInitialMode ?? "flash");
  // 训练台标题里的项目名:闪电心算 / 看算 / 听算(随呈现方式)
  const FLASH_NAMES = lang === "en" ? ({ flash: "Flash Math", glance: "Glance", listen: "Listen" } as const) : ({ flash: "闪电心算", glance: "看算", listen: "听算" } as const);
  const flashModeName = FLASH_NAMES[flashCfg.mode ?? flashInitialMode ?? "flash"];
  // 顶部面包屑:闪电心算页随「呈现方式 + 运算」动态显示,而非恒为「闪电心算」
  const flashTitle = () => {
    const m = FLASH_NAMES[flashCfg.mode ?? "flash"];
    const o = (lang === "en" ? ({ addsub: "", mul: " · Multiply", div: " · Divide" } as const) : ({ addsub: "", mul: " · 乘法", div: " · 除法" } as const))[flashCfg.op ?? "addsub"];
    return m + o;
  };
  const headerTitle = isFlash ? flashTitle() : isScrollPage ? (lang === "en" ? "Mental Marathon" : "心算马拉松") : isObstaclePage ? (lang === "en" ? "Obstacle" : "障碍算") : (t.games[game.id]?.name ?? game.name);

  // 排行榜 + 数据面板(底部第 5 个 tab):顶部切换项目(2026-10-13 用户要求)
  const beadBoardMode = abacusMode({ ...DEFAULT_ABACUS_CFG, project: "bead", beadDigits: abacusCfg.project === "bead" ? abacusCfg.beadDigits : DEFAULT_ABACUS_CFG.beadDigits });
  const boardPanel = (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2">
        {PROJECT_TILES.map((pt) => (
          <button key={pt.id} onClick={() => setBoardProject(pt.id as BoardProject)}
            className={cn("hp-leather flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition-transform hover:-translate-y-0.5", boardProject === pt.id && "hp-leather-on")}>
            <span>{pt.emoji}</span>{lang === "en" ? pt.en : pt.zh}
          </button>
        ))}
      </div>
      {boardProject === "scroll" || boardProject === "obstacle" ? (
        <>
          <PracticeStats game="flashmath" refreshKey={refreshKey} />
          <div className="hp-card min-h-[420px] p-3 md:p-4">
            <PracticeLog game="flashmath" refreshKey={refreshKey} title={boardProject === "scroll" ? (lang === "en" ? "Mental Marathon" : "心算马拉松") : (lang === "en" ? "Obstacle" : "障碍算")} />
          </div>
        </>
      ) : boardProject === "bead" ? (
        <>
          <PracticeStats game="abacus" refreshKey={refreshKey} />
          <div className="hp-card min-h-[420px] p-3 md:p-4">
            <PracticeLog game="abacus" refreshKey={refreshKey} title={lang === "en" ? "Beads" : "数珠互译"}
              extraTab={<ProLeaderboard game="abacus" mode={beadBoardMode} refreshKey={refreshKey} />}
              mistakeTab={<MistakeBook game="abacus" refreshKey={refreshKey} mistakeMode={abacusMistakeMode} onMistakeModeChange={setAbacusMistakeMode} />} />
          </div>
        </>
      ) : (
        <>
          <PracticeStats game="flashmath" refreshKey={refreshKey} />
          <div className="hp-card min-h-[420px] p-3 md:p-4">
            <PracticeLog game="flashmath" refreshKey={refreshKey} title={FLASH_NAMES[boardProject]}
              extraTab={<RankBoards game="flashmath" prefix={modePrefix(boardProject)} refreshKey={refreshKey} op={flashCfg.op ?? "addsub"} />}
              mistakeTab={<MistakeBook game="flashmath" refreshKey={refreshKey} mistakeMode={flashMistakeMode} onMistakeModeChange={setFlashMistakeMode} />} />
          </div>
        </>
      )}
    </div>
  );

  return (
    // overflow-x-clip 而非 overflow-hidden:hidden 会让页面成为滚动容器,配置页的 sticky 开始按钮失效
    <div className="relative min-h-screen overflow-x-clip">
      {/* 2026-10-13 与首页/教练端统一:训练页用羊皮纸底(珠算首页保留童话场景) */}
      {!(isAbacus && !isBeadPage) && <div aria-hidden className="paper-bg pointer-events-none fixed inset-0 z-0" />}
      <header className={cn("sticky top-0 z-30", isAbacus && !isBeadPage ? "border-b-0 bg-transparent" : "border-b border-[#B8925A]/40 bg-[#FBF5E6]/85 backdrop-blur")}>
        <div className="container flex items-center justify-between py-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t.arena}
            <span className="ml-1 text-muted-foreground/60">/</span>
            <span className="ml-1 text-foreground">{headerTitle}</span>
          </button>
          <div className="flex items-center gap-2">
            {isFlash && <BackgroundPicker />}
            <EyeCareToggle />
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className={cn("container relative z-10 py-2 md:py-3", (isFlash || isBeadPage) && "pb-28")}>

        {game.id === "abacus" && abacusView === "train" && (
          <div className="mb-2">
            <PracticeStats game="abacus" refreshKey={refreshKey} />
          </div>
        )}

        {game.id === "schulte" && (
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{lang === "en" ? "Size" : "难度"}</span>
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

        {isFlash ? (
          <div className="relative">
            {panel === "train" ? (
              <div className="hp-card p-5 md:p-8">
                <FlashMathGame
                  key={flashInitialMode ?? "flash"}
                  onFinished={handleFinished}
                  onCfgChange={setFlashCfg}
                  mistakeMode={flashMistakeMode}
                  onMistakeModeChange={setFlashMistakeMode}
                  initialMode={flashInitialMode}
                />
              </div>
            ) : boardPanel}
          </div>
        ) : (
        <div className={cn("grid gap-3", isAbacus && abacusView === "home" ? "" : isBeadPage ? "" : "lg:grid-cols-[1fr_560px]")}>
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
            {game.id === "abacus" && initialAbacusProject === "bead" && (panel === "board" ? boardPanel : <BeadTrain onFinished={handleFinished} onCfgChange={setAbacusCfg} />)}
            {isScrollPage && (panel === "board" ? boardPanel : <ScrollTrain onFinished={handleFinished} />)}
            {isObstaclePage && (panel === "board" ? boardPanel : <ObstacleTrain onFinished={handleFinished} />)}
            {game.id === "abacus" && initialAbacusProject !== "bead" && !isScrollPage && !isObstaclePage && (
              <AbacusGame
                onFinished={handleFinished}
                onCfgChange={setAbacusCfg}
                onViewChange={setAbacusView}
                mistakeMode={abacusMistakeMode}
                onMistakeModeChange={setAbacusMistakeMode}
                initialMode={initialAbacusMode}
                initialProject={initialAbacusProject}
              />
            )}
            {game.id === "nback" && <NBackGame onFinished={handleFinished} onCfgChange={setNbackCfg} />}
            {game.id === "cards" && <CardMemoryGame />}
            {game.id === "orbit" && <OrbitFocusGame onFinished={handleFinished} />}
            {game.id === "gauntlet" && <GauntletFlashGame onFinished={handleFinished} onCfgChange={setGauntletCfg} />}
          </div>
          {!(isAbacus && abacusView === "home") && !isBeadPage && (
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
                  {lang === "en" ? "PFI overall" : "PFI 通榜"}
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
                  {lang === "en" ? "GFI overall" : "GFI 通榜"}
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
                  {lang === "en" ? "This setup" : "当前配置榜"}
                </button>
              </div>
            )}
            {game.id === "flashmath" ? (
              <div className="h-full min-h-[520px]">
                <PracticeLog
                  game="flashmath"
                  refreshKey={refreshKey}
                  title={flashModeName}
                  extraTab={<RankBoards game={game.id} prefix={flashPrefix} refreshKey={refreshKey} op={flashCfg.op ?? "addsub"} />}
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
        )}
      </main>

      {/* 底部四个项目大按钮(2026-10-13 与教练端演示一致):在训练页里直接切换 闪算/听算/看算/数珠互译 */}
      {(isFlash || isBeadPage) && (
        <nav className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-[#B8925A]/40 bg-[#FBF5E6]/90 backdrop-blur">
          <div className="proj-nav container grid max-w-6xl grid-cols-7 gap-1.5 py-3 sm:gap-2">
            {PROJECT_TILES.map((pt) => {
              const on = panel === "train" && (pt.id === "bead" ? isAbacus && !isScrollPage && !isObstaclePage : pt.id === "scroll" ? isScrollPage : pt.id === "obstacle" ? isObstaclePage : isFlash && (flashCfg.mode ?? flashInitialMode ?? "flash") === pt.id);
              return (
                <button key={pt.id} onClick={() => { setPanel("train"); navigate(pt.href); }}
                  className={cn("hp-leather flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-black transition-transform hover:-translate-y-0.5 sm:py-4 sm:text-lg", on && "hp-leather-on")}>
                  <span className="text-xl">{pt.emoji}</span>{lang === "en" ? pt.en : pt.zh}
                </button>
              );
            })}
            <button onClick={() => setPanel((p) => (p === "board" ? "train" : "board"))}
              className={cn("hp-leather flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-black transition-transform hover:-translate-y-0.5 sm:py-4 sm:text-lg", panel === "board" && "hp-leather-on")}>
              <span className="text-xl">🏆</span>{lang === "en" ? "Ranks" : "排行榜"}
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

// 珠心算专属:童话世界背景(原创绘制)
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
