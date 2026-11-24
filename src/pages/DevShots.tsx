// 应用商店截图场景(仅开发环境 /dev/shots/:id,2026-11-08 安卓上架):无头 Chrome 按商店尺寸截屏(scripts/store-shots.sh)。
// 用真实组件 + 示例数据(不需要登录、不碰线上数据)。
import { useParams } from "react-router-dom";
import { CoachPanel } from "@/components/CoachPanel";
import { TeachStage } from "@/components/FingerTeach";
import { COACH_STAGES } from "@/lib/fingering";
import { genProblems, normalizeItem } from "@/lib/homework";

const BG = "linear-gradient(135deg,#2B1A08 0%,#4A2E14 55%,#2B1A08 100%)";
const STAGE = "radial-gradient(120% 90% at 50% 25%, #3a2513 0%, #1c1108 55%, #0e0803 100%)";

function Frame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center overflow-hidden" style={{ background: BG }}>
      <div className="flex items-center gap-4 pt-[4vh]">
        <img src="/logo-emblem.png?v=2" alt="" style={{ height: "7vh" }} />
        <div>
          <h1 className="font-black text-[#FBF5E6]" style={{ fontSize: "5vh", lineHeight: 1.15 }}>{title}</h1>
          <p className="text-[#E8CC8A]" style={{ fontSize: "2.4vh" }}>{sub}</p>
        </div>
      </div>
      <div className="mt-[3.5vh] flex w-[86vw] flex-1 items-start justify-center overflow-hidden rounded-t-[2.2vh] border-[0.5vh] border-b-0 border-[#E8CC8A]/50 shadow-2xl">{children}</div>
    </div>
  );
}

// AI 陪练截图的示例掌握度(只写本机开发环境的 localStorage)
try { localStorage.setItem("flashmath:classStats", JSON.stringify({ 直加: { n: 160, wrong: 5 }, 直减: { n: 120, wrong: 6 }, 满五加: { n: 90, wrong: 8 }, 破五减: { n: 64, wrong: 17 }, 进位加: { n: 40, wrong: 6 }, 破五进位加: { n: 22, wrong: 5 }, 退位减: { n: 12, wrong: 2 } })); } catch { /* noop */ }
const coachZoom = () => Math.min(window.innerHeight / 470, (window.innerWidth * 0.8) / 720);
const coachProg = { stage: 3, passed: [1, 2], recent: { 1: Array(100).fill(true), 2: Array(100).fill(true), 3: Array.from({ length: 64 }, (_, i) => ![2, 6, 11, 17, 43].includes(i)) } };

export default function DevShots() {
  const { id = "coach" } = useParams();
  if (id === "teach") return <TeachStage problems={["55+89"]} onClose={() => {}} onEdit={() => {}} demoStep={1} />;
  if (id === "teachmul") return <TeachStage problems={["356×4"]} onClose={() => {}} onEdit={() => {}} demoStep={2} />;
  if (id === "feature") return (
    <div className="flex h-screen w-screen items-center justify-center gap-[5vw]" style={{ background: BG }}>
      <img src="/logo-emblem.png?v=2" alt="" style={{ height: "52vh" }} />
      <div><h1 className="font-black text-[#FBF5E6]" style={{ fontSize: "17vh", lineHeight: 1 }}>珠象</h1>
        <p className="mt-[3vh] text-[#E8CC8A]" style={{ fontSize: "6.5vh" }}>以珠为象，以象为算</p>
        <p className="mt-[2vh] text-[#E9D7B4]" style={{ fontSize: "4.2vh" }}>珠心算智能训练平台 · Mental Abacus Academy</p></div>
    </div>
  );
  if (id === "flash") return (
    <Frame title="闪电心算 · 看得清、算得快" sub="闪算 · 听算 · 看算 · 数码秒记 · 心算马拉松 · 障碍算 · 六大训练项目">
      <div className="flex h-full w-full flex-col text-white" style={{ background: STAGE }}>
        <div className="flex justify-between px-[2vw] py-[1.6vh] text-[2vh] text-white/80"><span>闪算 · 加减 4位×10笔 · 0.6s/笔</span><span>第 4 题</span></div>
        <div className="flex flex-1 items-center justify-center font-hand font-bold" style={{ fontSize: "30vh" }}>7,286</div>
      </div>
    </Frame>
  );
  if (id === "coach") return (
    <Frame title="AI 陪练 · 七关指法进阶" sub="按指法出题，正确率、最近 20 题、薄弱指法一目了然">
      <div className="flex h-full w-full items-center overflow-hidden bg-background p-[2vh] pb-[8vh]">
        <div style={{ zoom: coachZoom() }} className="mx-auto max-w-[720px]">
          <CoachPanel prog={coachProg} stage={COACH_STAGES[2]} lessonIdx={-1} onStage={() => {}} onLesson={() => {}} T={(z) => z} tx={(s) => s} />
        </div>
      </div>
    </Frame>
  );
  if (id === "contest") {
    const rows = [["A0381", "王小明", 48, 49], ["A1207", "李思琪", 46, 48], ["A0925", "张子涵", 45, 46], ["A3316", "陈一诺", 43, 45], ["A0418", "刘浩然", 41, 44], ["A2290", "赵欣怡", 40, 43]] as const;
    return (
      <Frame title="比赛系统 · 统一开赛、实时排名" sub="扫码报名 · 后台统一开始 / 结束 · 大屏排名 + 直播任一选手画面 · 一键导出成绩">
        <div className="grid h-full w-full grid-cols-[1fr_1.2fr] gap-[2vw] p-[3vh] text-[#F6E7C1]" style={{ background: "radial-gradient(ellipse at 20% 0%,#3A2612,#140c05 70%)" }}>
          <div className="space-y-[1.2vh]">{rows.map(([no, nm, c, a], i) => (
            <div key={no} className={`flex items-center gap-[1.5vw] rounded-xl px-[1.5vw] py-[1.2vh] text-[2.8vh] ${i < 3 ? "bg-[#E8CC8A] text-[#2B1A08]" : "bg-white/5"}`}>
              <b className="w-[3vw] font-mono text-[3.4vh]">{i + 1}</b><span className="font-mono">{no}</span><b className="flex-1">{nm}</b><span className="font-mono"><b className="text-[3.6vh]">{c}</b> / {a}</span></div>))}</div>
          <div className="flex flex-col rounded-3xl border border-[#E8CC8A]/30 bg-[#0e0803]/80 p-[2.5vh]">
            <div className="flex items-center gap-[1vw] text-[2.6vh]"><span className="rounded-full bg-[#9e2a2b] px-[1vw] font-black text-white">● 直播</span><b className="font-mono text-[#E8CC8A]">A0381</b><b className="text-white">王小明</b><span className="ml-auto font-mono text-[4vh] font-black text-white">4:12</span></div>
            <div className="flex flex-1 items-center justify-center font-hand font-bold text-white" style={{ fontSize: "20vh" }}>593</div>
          </div>
        </div>
      </Frame>
    );
  }
  if (id === "exam") {
    const ps = genProblems(normalizeItem({ project: "glance", op: "addsub", digits: 3, digitsMax: 3, count: 6, includeSub: true }), 10);
    return (
      <Frame title="出题系统 · 一键生成鉴定卷、比赛卷" sub="按官方题型逐张复刻 · 加减乘除 · 指法知识点出题 · 扫码看答案">
        <div className="flex h-full w-full justify-center bg-[#e9e2d3] pt-[3vh]">
          <div className="w-[62vw] bg-white px-[3vw] py-[3vh] shadow-xl">
            <div className="flex items-baseline justify-between border-b-2 border-black pb-[1vh]"><b className="text-[3vh]">珠心算三级鉴定模拟题 · 加减算</b><span className="text-[1.8vh]">姓名 ______ 得分 ______</span></div>
            <div className="mt-[2vh] grid grid-cols-10 border-l border-t border-black text-center font-mono text-[2.3vh]">
              {ps.map((p, i) => <div key={i} className="border-b border-r border-black"><div className="border-b border-black bg-black/5 py-[0.5vh] text-[1.8vh]">{i + 1}</div>{p.terms.map((t, k) => <div key={k} className="py-[0.4vh]">{p.signs[k] === "-" ? "-" : ""}{Math.abs(t)}</div>)}<div className="h-[4vh] border-t border-black" /></div>)}
            </div>
          </div>
        </div>
      </Frame>
    );
  }
  return null;
}
