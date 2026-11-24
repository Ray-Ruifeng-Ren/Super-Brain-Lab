// /home/about 关于:团队背景 + 五层技术架构(2026-11-12 中英文)
import { SiteShell, SecHead, openContact, useL } from "./SiteShell";

const TEAM: [string, string, string, string][] = [
  ["麻省理工 · 清华", "MIT · Tsinghua", "核心技术团队来自麻省理工学院与清华大学背景,负责平台架构、出题引擎与多端产品。", "The core engineering team, with MIT and Tsinghua backgrounds, builds the platform architecture, the problem engines and the multi-device apps."],
  ["AI 专家", "AI specialists", "把一线名师的教学经验,做成可规模化的智能系统:AI 陪练、智能出题、神经网络语音。", "Turning the know-how of leading teachers into systems that scale: the AI coach, smart problem generation and neural voice."],
  ["最强大脑", "Brain-training veterans", "「最强大脑」级脑力训练经验,与一线珠心算名师共同打磨每一个训练项目。", "Championship-level brain-training experience, refining every drill together with top mental-abacus teachers."],
];
const LAYERS: [string, string, string, string][] = [
  ["应用层", "Applications", "训练 · 学生 · 教练 · 鉴定 · 出题 · 比赛", "Training · Student · Coach · Grading · Papers · Contest"],
  ["智能交互层", "Intelligent interaction", "指法讲解生成 · 神经网络语音 · AI 陪练", "Fingering narration · Neural voice · AI coach"],
  ["核心引擎层", "Core engines", "指法识别引擎 · 约束出题引擎 · 难度系数模型 · 学情诊断", "Fingering engine · Constrained generator · Difficulty model · Learning diagnostics"],
  ["数据与知识层", "Data & knowledge", "指法知识库 · 标准题型库 · 作答数据", "Fingering knowledge base · Standard paper formats · Answer data"],
  ["云基础设施", "Cloud infrastructure", "无服务器架构 · 国内同域加速 · 服务器统一计时 · 数据隔离", "Serverless · Same-origin acceleration · Server-synchronized timing · Data isolation"],
];

export default function SiteAbout() {
  const L = useL();
  return (
    <SiteShell>
      <section className="mx-auto max-w-[1120px] px-6 pt-16 sm:pt-24">
        <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
          <SecHead left kicker="About" no={L<string | undefined>("关于", undefined)} title={L("懂技术,更懂脑力训练", "Strong in engineering, stronger in brain training")} sub={L("把珠心算名师的指法体系与教学经验,做成每个孩子每天都能用的训练平台。", "We turn master teachers' fingering system and classroom experience into a platform every child can train on, every day.")} />
          <dl className="border-t border-[var(--ink)]">
            {TEAM.map(([t, tEn, d, dEn]) => <div key={t} className="grid gap-2 border-b border-[var(--line)] py-6 sm:grid-cols-[200px_1fr]"><dt className="serif text-[19px]">{L(t, tEn)}</dt><dd className="text-[15px] text-[var(--muted)]">{L(d, dEn)}</dd></div>)}
          </dl>
        </div>
      </section>
      <section className="mx-auto mt-24 max-w-[1120px] px-6">
        <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
          <SecHead left kicker="Architecture" no={L<string | undefined>("架构", undefined)} title={L("五层架构", "Five layers")} sub={L("把名师经验做成可规模化的智能引擎。", "Master teachers' experience, built into engines that scale.")} />
          <ol className="border-t border-[var(--ink)]">
            {LAYERS.map(([n, nEn, d, dEn], i) => (
              <li key={n} className="grid grid-cols-[48px_1fr] gap-x-4 border-b border-[var(--line)] py-5 sm:grid-cols-[48px_200px_1fr]">
                <span className="num text-[13px] text-[var(--brass)]">0{i + 1}</span>
                <span className={`serif text-[17px] ${i === 2 ? "text-[var(--accent)]" : ""}`}>{L(n, nEn)}</span>
                <span className="col-start-2 text-[15px] text-[var(--muted)] sm:col-start-3">{L(d, dEn)}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-16 text-[15px] text-[var(--muted)]">{L("学校、机构、赛事合作", "Schools, centers and competitions")} <button onClick={openContact} className="lnk ml-2">{L("扫码联系珠象首席教练", "Scan to reach our Head Coach")}</button></p>
      </section>
    </SiteShell>
  );
}
