// 六大系统 = 六面学院旗(与主站首页锦旗同一套样式):整齐 3 + 3,每面旗一种学院色,点击直接进入(2026-11-12 中英文)
import { Award, ClipboardList, GraduationCap, LayoutGrid, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Pennant } from "@/components/Pennant";
import { cn } from "@/lib/utils";
import { useL } from "./SiteShell";

interface Sys { no: string; icon: LucideIcon; name: string; en: string; desc: string; descEn: string; to: string; color: string }
export const SYSTEMS: Sys[] = [
  { no: "I", icon: LayoutGrid, name: "训练系统", en: "Training", to: "/", color: "#7A1F2B", desc: "六大项目 · AI 陪练", descEn: "Six drills · AI coach" },
  { no: "II", icon: GraduationCap, name: "学生训练", en: "Student", to: "/homework", color: "#1F3A5F", desc: "作业到家 · 错题重做", descEn: "Homework at home · Redo mistakes" },
  { no: "III", icon: Users, name: "教练管理", en: "Coach", to: "/coach", color: "#2E5A3C", desc: "班级学情 · 课堂演示", descEn: "Class insights · Classroom demo" },
  { no: "IV", icon: Award, name: "鉴定系统", en: "Certification", to: "/cert", color: "#8A5A1E", desc: "线上考级 · 即时出证", descEn: "Online grading · Instant certificate" },
  { no: "V", icon: ClipboardList, name: "出题系统", en: "Exam Papers", to: "/exam", color: "#4A2A5A", desc: "鉴定卷 · 比赛样卷", descEn: "Grading papers · Contest papers" },
  { no: "VI", icon: Trophy, name: "比赛系统", en: "Contest", to: "/contest", color: "#2B1A08", desc: "统一开始 · 实时排名", descEn: "Synchronized start · Live ranking" },
];

function Flag({ s }: { s: Sys }) {
  const L = useL();
  const I = s.icon;
  return (
    <Pennant color={s.color} to={s.to} className="!w-[12.5rem]">
      <p className="num text-[11px] tracking-[0.3em] text-[#E8CC8A]/70">{s.no}</p>
      <I className="mx-auto mt-2 h-7 w-7 text-[#E8CC8A]" strokeWidth={1.4} />
      <p className="serif mt-3 text-[19px] text-[#F6E7C1]">{L(s.name, s.en)}</p>
      <p className="cinzel mt-1 text-[9px] text-[#E8CC8A]/70">{L(s.en, s.name)}</p>
      <p className="mt-3 text-[12px] text-[#E9D7B4]/90">{L(s.desc, s.descEn)}</p>
    </Pennant>
  );
}

/** 两排学院旗(3 + 3,手机自动换行) */
export const SystemGrid = () => (
  <div className="flex flex-col items-center gap-10">
    {[SYSTEMS.slice(0, 3), SYSTEMS.slice(3)].map((row, i) => (
      <div key={i} className="flex flex-wrap justify-center gap-8 sm:gap-12">{row.map((s) => <Flag key={s.no} s={s} />)}</div>
    ))}
  </div>
);

export const PROOF: [string, string, string][] = [["6", "大系统", "systems"], ["8", "类指法讲解", "fingering types taught"], ["7", "关 AI 陪练", "AI coach stages"], ["22", "个鉴定级别", "grading levels"], ["3", "端可用", "platforms"]];
/** 数字带:金色双线之间 */
export const Proof = () => {
  const L = useL();
  return (
    <dl className="grid grid-cols-3 gap-y-5 border-y-[3px] border-double border-[var(--line-strong)] py-5 sm:grid-cols-5">
      {PROOF.map(([n, t, tEn], i) => <div key={t} className={cn("text-center", i > 0 && "sm:border-l sm:border-[var(--line)]")}><dt className="num text-[26px] leading-none text-[var(--accent)]">{n}</dt><dd className="mt-2 text-[12px] tracking-[0.15em] text-[var(--muted)]">{L(t, tEn)}</dd></div>)}
    </dl>
  );
};
