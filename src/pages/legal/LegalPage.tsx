// 隐私政策 / 用户协议 页面(上架应用商店用,2026-11-08):/privacy /terms,?lang=en 英文版(Google Play 印度);内容在 lib/legal.ts
import { Link, useSearchParams } from "react-router-dom";
import { privacyEn, privacyZh, termsEn, termsZh, LEGAL } from "@/lib/legal";

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const [sp, setSp] = useSearchParams();
  const en = sp.get("lang") === "en";
  const secs = kind === "privacy" ? (en ? privacyEn() : privacyZh()) : en ? termsEn() : termsZh();
  const title = kind === "privacy" ? (en ? "Privacy Policy" : "隐私政策") : en ? "Terms of Service" : "用户协议";
  return (
    <div className="min-h-screen bg-background px-5 py-8 text-foreground">
      <article className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <img src="/logo-emblem.png?v=2" alt="" className="h-10" />
          <div><h1 className="text-2xl font-black">{en ? "Zhuxiang" : "珠象"} · {title}</h1><p className="text-xs text-muted-foreground">{en ? `Last updated: ${LEGAL.updatedEn}` : `更新日期:${LEGAL.updated}`}</p></div>
          <button onClick={() => setSp(en ? {} : { lang: "en" })} className="ml-auto rounded-full border border-border px-3 py-1 text-xs">{en ? "中文" : "English"}</button>
        </div>
        {secs.map((s) => (
          <section key={s.h} className="mt-6">
            <h2 className="text-base font-bold">{s.h}</h2>
            {s.p.map((p, i) => <p key={i} className="mt-2 text-sm leading-relaxed text-foreground/85">{p}</p>)}
          </section>
        ))}
        <p className="mt-10 flex gap-4 text-xs text-muted-foreground">
          <Link to={`/privacy${en ? "?lang=en" : ""}`} className="underline">{en ? "Privacy Policy" : "隐私政策"}</Link>
          <Link to={`/terms${en ? "?lang=en" : ""}`} className="underline">{en ? "Terms" : "用户协议"}</Link>
          <Link to="/account/delete" className="underline">{en ? "Delete account" : "注销账号"}</Link>
        </p>
      </article>
    </div>
  );
}
export const PrivacyPage = () => <LegalPage kind="privacy" />;
export const TermsPage = () => <LegalPage kind="terms" />;
