// /overview 系统(官网「系统」页):六大系统目录,点击直接进入对应系统(2026-11-12 中英文)
import { SiteShell, SecHead, useL } from "./site/SiteShell";
import { Proof, SystemGrid } from "./site/Systems";

export default function Overview() {
  const L = useL();
  return (
    <SiteShell>
      <section className="mx-auto max-w-[1120px] px-6 pt-16 sm:pt-24">
        <SecHead kicker="The Six Halls" no={L<string | undefined>("系统", undefined)} title={L("一个平台,覆盖珠心算的教、练、考、赛", "One platform for teaching, practice, exams and contests")} sub={L("六大系统,统一账号,数据互通。点击任一系统直接进入。", "Six systems, one account, shared data. Click any system to enter.")} />
        <div className="mt-12"><SystemGrid /></div>
        <div className="mt-16"><Proof /></div>
      </section>
    </SiteShell>
  );
}
