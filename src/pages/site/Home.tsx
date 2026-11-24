// /home 珠象官网首页(2026-11-05 第五版,魔法学院风):
// 首屏 —— 校徽 + 「以珠为象,以象为算」(用户选定)+ 会动的画像(闪算实机)· §I 六大系统 = 六面学院旗
// · §II 核心技术(图版式珠态对比 + 指法教学画像 + 四卷引擎)· §III 体验珠象 AI(墨褐皮面舞台,浏览器里跑真实引擎)
// · §IV 联系合作(2026-11-05 用户「升华到最后就是联系合作,稍微突出」):入学邀请函 + 火漆封印 + 首席教练二维码
// 2026-11-12 中英文:右上角切换,文案用 L(中, 英)
import { Link } from "react-router-dom";
import { SiteShell, SecHead, Figure, openContact, useL } from "./SiteShell";
import { Proof, SystemGrid } from "./Systems";
import { AiPlayground, Abacus } from "./AiPlayground";

const ENGINES: [string, string, string, string, string][] = [
  ["I", "指法识别引擎", "Fingering Engine", "逐档模拟算盘珠态,判出每一笔属于 8 类指法中的哪一类。", "Simulates the beads rod by rod and classifies every stroke into one of 8 fingering types."],
  ["II", "约束出题引擎", "Constrained Generator", "按官方拟题规则出题:数码均衡、相邻不重复、只出目标指法。", "Generates by the official rules: balanced digits, no adjacent repeats, only the target fingering."],
  ["III", "难度系数模型", "Difficulty Model", "位数、笔数、速度折算为统一难度分,排行榜跨配置可比。", "Digits, terms and speed fold into one difficulty score, so leaderboards compare across settings."],
  ["IV", "神经网络语音", "Neural Voice", "真人级报题,多音色、多语速,听算如老师在侧。", "Lifelike dictation in several voices and speeds — like a teacher at your side."],
];

export default function SiteHome() {
  const L = useL();
  return (
    <SiteShell>
      {/* 首屏 */}
      <section className="relative">
        <div className="rose left-1/2 top-[-120px] h-[900px] w-[900px] -translate-x-1/2" />
        <div className="relative mx-auto grid max-w-[1040px] items-center gap-12 px-6 pb-14 pt-14 sm:pt-20 lg:grid-cols-[1fr_1.05fr]">
          <div className="fade text-center lg:text-left">
            <img src="/logo-emblem.png?v=2" alt={L("珠象校徽", "Zhuxiang emblem")} className="mx-auto h-16 w-auto lg:mx-0" />
            <p className="cinzel mt-5 text-[11px] text-[var(--gold)]">Zhuxiang Academy · Est. 2026</p>
            <h1 className="serif mt-4 text-[32px] leading-[1.35] sm:text-[40px]">{L(<>以珠为象,<br />以象为算。</>, <>See the beads,<br />think the numbers.</>)}</h1>
            <div className="orn mt-5 justify-center lg:justify-start"><i className="lg:hidden" /><span className="text-[12px]">❦</span><i /></div>
            <p className="mx-auto mt-5 max-w-[24em] text-[15px] text-[var(--muted)] lg:mx-0">{L("珠心算智能训练平台。训练、出题、鉴定、比赛,一座学院覆盖珠心算的教、练、考、赛。", "The intelligent mental-abacus platform. Training, paper generation, grading and contests — one academy for teaching, practice, exams and competition.")}</p>
            <div className="mt-8 flex items-center justify-center gap-6 lg:justify-start">
              <Link to="/" className="btn">{L("进入平台", "Open the Platform")}</Link>
              <button onClick={openContact} className="lnk text-[14px]">{L("联系合作", "Contact us")}</button>{/* 2026-11-13 反馈:首屏副按钮由「体验珠象 AI」改为「联系合作」(弹微信二维码) */}
            </div>
          </div>
          <div className="fade" style={{ animationDelay: ".12s" }}><Figure name="flash" label={L("闪算实机画面:五位数五笔加减", "Flash drill: five 5-digit terms")} cap={L("闪 算 · 五 位 五 笔", "FLASH · 5 DIGITS × 5 TERMS")} /></div>
        </div>
        <div className="relative mx-auto max-w-[1040px] px-6"><Proof /></div>
      </section>

      {/* §I 六大系统 */}
      <section className="mx-auto max-w-[1040px] px-6 pt-24">
        <SecHead no="I" kicker="The Six Halls" title={L("教、练、考、赛,六大系统", "Six systems for teaching, practice, exams and contests")} sub={L("统一账号,数据互通。点击任一面旗帜,直接进入对应系统。", "One account, shared data. Click any banner to enter that system.")} />
        <div className="mt-12"><SystemGrid /></div>
      </section>

      {/* §II 核心技术 */}
      <section className="mx-auto max-w-[1040px] px-6 pt-28">
        <SecHead no="II" kicker="The Core Arts" title={L("看珠子,不只看数字", "It reads the beads, not just the numbers")} sub={L("同样减 6,算盘状态不同,指法就不同。珠象逐档模拟珠态,判断每一笔真正用到的指法 —— AI 陪练与指法教学都建立在这一点上。", "Subtracting 6 uses a different fingering depending on the beads already on the rod. Zhuxiang simulates the abacus rod by rod to find the fingering each stroke really needs — the AI coach and fingering lessons are both built on this.")} />
        <div className="mt-12 grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card p-6">
            <p className="eyebrow relative text-center">Plate I · {L("珠态对比", "Bead states")}</p>
            <div className="relative mt-4 grid grid-cols-2 gap-6">
              {([["10 − 6", [1, 0], L("个位无珠可减", "no beads to take on the ones rod"), L("退位减", "Borrow −")], ["12 − 6", [1, 2], L("个位两颗下珠", "two lower beads on the ones rod"), L("退位满五减", "Borrow & five −")]] as const).map(([e, d, why, cls], i) => (
                <figure key={e} className="text-center">
                  <div className="flex justify-center"><Abacus digits={[...d]} hot={new Set([0])} /></div>
                  <p className="num mt-3 text-[18px]">{e}</p>
                  <figcaption className="text-[12.5px] text-[var(--muted)]">{L(`图 ${i + 1}`, `Fig. ${i + 1}`)} · {why}<br />→ <span className="text-[var(--accent)]">{cls}</span></figcaption>
                </figure>
              ))}
            </div>
          </div>
          <Figure name="teach" label={L("指法教学:讲解后双手同步拨珠", "Fingering lesson: narration, then both hands move the beads")} cap={L("指 法 教 学 · 3 + 9", "FINGERING LESSON · 3 + 9")} />
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ENGINES.map(([n, t, tEn, d, dEn]) => (
            <div key={t} className="card p-5 text-center">
              <p className="num relative text-[13px] text-[var(--gold)]">{n}</p>
              <h3 className="serif relative mt-2 text-[16px]">{L(t, tEn)}</h3>
              <p className="relative mt-2 text-[13px] leading-relaxed text-[var(--muted)]">{L(d, dEn)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* §III 体验珠象 AI */}
      <section id="ai" className="mx-auto max-w-[1040px] scroll-mt-6 px-6 pt-28">
        <div className="stage px-6 py-12 sm:px-12">
          <SecHead no="III" kicker="Try the Engine" title={L("体验珠象 AI", "Try the Zhuxiang AI")} sub={L("引擎就在你的浏览器里运行。输入任意加减算式,看它逐档拨珠、判出指法;或指定一类指法,看它即时出题。", "The engine runs right in your browser. Type any addition or subtraction and watch it move the beads and name each fingering — or pick a fingering and watch it generate problems on the spot.")} className="relative mb-10" />
          <div className="relative"><AiPlayground /></div>
        </div>
      </section>

      {/* §IV 联系合作 —— 入学邀请函 */}
      <section className="mx-auto max-w-[1040px] px-6 pt-28">
        <div className="letter mx-auto max-w-[760px] px-8 pb-12 pt-14 text-center sm:px-16">
          <div className="seal" aria-hidden><img src="/logo-emblem.png?v=2" alt="" /></div>
          <p className="eyebrow relative"><b>IV</b>An Invitation</p>
          <h2 className="serif relative mt-4 text-[26px] leading-[1.4] sm:text-[30px]">{L("诚邀您,共建珠心算学院", "Build the academy of mental abacus with us")}</h2>
          <div className="orn relative mt-4 justify-center"><i /><span className="text-[12px]">❦</span><i /></div>
          <p className="relative mx-auto mt-5 max-w-[30em] text-[15px] text-[var(--muted)]">{L("无论是学校、培训机构,还是赛事与考级主办方 —— 训练、出题、鉴定、比赛,珠象一站为您备齐。扫码联系珠象首席教练,为您的学员量身定制方案。", "Schools, training centers, competition and grading organizers — training, papers, grading and contests, all in one place. Scan to reach our Head Coach for a plan tailored to your students.")}</p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-8 sm:flex-row">
            <div className="portrait w-40 !p-2"><img src="/site/wx-gzh.png" alt={L("珠象首席教练微信二维码", "Head Coach WeChat QR code")} className="relative block w-full bg-white" /></div>
            <div className="text-center sm:text-left">
              <p className="serif text-[18px]">{L("珠象首席教练", "Zhuxiang Head Coach")}</p>
              <p className="mt-1 text-[13px] text-[var(--muted)]">{L("微信扫一扫,直接沟通合作", "Scan on WeChat to talk directly")}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-5 sm:justify-start">
                <button onClick={openContact} className="btn">{L("联系合作", "Contact us")}</button>
                <a href="/home/pricing" className="lnk text-[14px]">{L("查看价格", "See pricing")}</a>
              </div>
            </div>
          </div>
          <p className="cinzel relative mt-10 text-[10.5px] text-[var(--gold)]">Zhuxiang Academy of Mental Abacus</p>
        </div>
      </section>
    </SiteShell>
  );
}
