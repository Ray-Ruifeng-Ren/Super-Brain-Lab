// /home/pricing 价格(同 2026-11-04 报价单:统一价格不设阶梯;教练账号限时特惠;学生价格不变;教练推广每个学生 ¥30)
// 2026-11-12 中英文(价格仍以人民币计)
import { SiteShell, SecHead, openContact, useL } from "./SiteShell";

const ROWS: [string, string, string, string][] = [
  ["训练系统 · 教练 · 按年", "Training · Coach · yearly", "¥500", "¥300"], ["训练系统 · 教练 · 按月", "Training · Coach · monthly", "¥50", "¥30"],
  ["训练系统 · 教练 · 带 AI 陪练 · 按年", "Training · Coach · with AI coach · yearly", "¥600", "¥360"], ["训练系统 · 教练 · 带 AI 陪练 · 按月", "Training · Coach · with AI coach · monthly", "¥60", "¥36"],
  ["出题系统 · 教练 · 按年", "Exam papers · Coach · yearly", "¥500", "¥300"], ["出题系统 · 教练 · 按月", "Exam papers · Coach · monthly", "¥50", "¥30"],
  ["训练系统 · 学生 · 按年", "Training · Student · yearly", "¥100", "—"], ["训练系统 · 学生 · 按月", "Training · Student · monthly", "¥10", "—"],
  ["训练系统 · 学生 · 带 AI 陪练 · 按年", "Training · Student · with AI coach · yearly", "¥120", "—"], ["训练系统 · 学生 · 带 AI 陪练 · 按月", "Training · Student · with AI coach · monthly", "¥12", "—"],
];

export default function SitePricing() {
  const L = useL();
  return (
    <SiteShell>
      <section className="mx-auto max-w-[1120px] px-6 pt-16 sm:pt-24">
        <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
          <div>
            <SecHead left kicker="Pricing" no={L<string | undefined>("价格", undefined)} title={L("统一价格,不设阶梯", "One price, no tiers")} sub={L("个人、机构、政府采购同价。教练账号限时特惠,学生账号价格不变。", "The same price for individuals, institutions and public procurement. Coach accounts are on a limited-time offer; student prices stay the same.")} />
            <div className="mt-10 border-t border-[var(--line)] pt-6">
              <p className="num text-[44px] leading-none text-[var(--accent)]">¥0.82<span className="ml-1 text-[15px] text-[var(--muted)]">/ {L("天", "day")}</span></p>
              <p className="mt-2 text-[14px] text-[var(--muted)]">{L("教练账号限时特惠,每天不到 1 元", "Coach account on offer — under ¥1 a day")}</p>
            </div>
            <div className="mt-8 border-t border-[var(--line)] pt-6">
              <p className="num text-[32px] leading-none">¥30<span className="ml-1 text-[14px] text-[var(--muted)]">/ {L("年 · 每个学生", "year · per student")}</span></p>
              <p className="mt-2 text-[14px] text-[var(--muted)]">{L("教练推广:开通教练账号 → 获取邀请码 → 学生购买账号 → 获得 ¥30", "Coach referral: open a coach account → get your invite code → a student buys an account → you earn ¥30")}</p>
            </div>
          </div>
          <div>
            <table className="w-full text-[15px]">
              <thead><tr className="border-b border-[var(--ink)] text-left text-[13px] text-[var(--muted)]"><th className="pb-3 font-normal">{L("账号", "Account")}</th><th className="pb-3 text-right font-normal">{L("原价", "List price")}</th><th className="pb-3 text-right font-normal text-[var(--accent)]">{L("限时特惠", "Limited offer")}</th></tr></thead>
              <tbody>{ROWS.map(([n, nEn, o, sp]) => (
                <tr key={n} className="border-b border-[var(--line)]">
                  <td className="py-3.5">{L(n, nEn)}</td>
                  <td className={`num py-3.5 text-right ${sp !== "—" ? "text-[var(--muted)] line-through" : ""}`}>{o}</td>
                  <td className="num py-3.5 text-right text-[var(--accent)]">{sp}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="mt-6 text-[13px] text-[var(--muted)]">{L("计价单位:人民币元 / 账号。出题系统不涉及 AI 陪练。含税方式、开票及最终价格以正式合同为准。", "Prices in CNY per account. The exam-paper system does not include the AI coach. Taxes, invoicing and final pricing per the signed contract.")}<button onClick={openContact} className="lnk ml-2">{L("联系合作", "Contact us")}</button></p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
