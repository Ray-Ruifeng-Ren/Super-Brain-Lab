// 注销账号(2026-11-08 上架必需:国内商店要求可注销;Google Play 要求 App 内 + 网页都能申请删除账号):
// 登录后确认 → 云函数 delete-account 校验登录令牌后删除该账号的训练数据、成绩、角色、资料和账号本身 → 退出登录。
import { useState } from "react";
import { Link } from "react-router-dom";
import { RequireLogin } from "@/components/RequireLogin";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/appEnv";
import { LEGAL, LEGAL_READY } from "@/lib/legal";

function Inner() {
  const [txt, setTxt] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState(false);
  const go = async () => {
    setBusy(true); setErr("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token; if (!token) throw new Error("请先登录");
      const r = await fetch(siteUrl("/.netlify/functions/delete-account"), { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "注销失败,请稍后再试");
      await supabase.auth.signOut().catch(() => {});
      setDone(true);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  if (done) return <Shell><p className="text-lg font-bold">账号已注销</p><p className="mt-2 text-sm text-muted-foreground">你的账号和训练数据已删除。感谢使用珠象。</p><Link to="/" className="mt-6 inline-block text-primary underline">返回首页</Link></Shell>;
  return (
    <Shell>
      <h1 className="text-xl font-black">注销账号 · Delete account</h1>
      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-left text-sm text-foreground/85">
        <li>将永久删除你的账号、昵称、全部训练记录、成绩、作业和班级关系,无法恢复。</li>
        <li>已购买的账号时长随账号一并失效。</li>
        <li>比赛报名信息由比赛主办方保存;如需删除请联系{LEGAL_READY ? ` ${LEGAL.email}` : "比赛主办方"}。</li>
        <li className="text-muted-foreground">This permanently deletes your account and all practice data.</li>
      </ul>
      <p className="mt-5 text-sm">请输入「<b>注销</b>」确认:</p>
      <input value={txt} onChange={(e) => setTxt(e.target.value.trim())} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-center" placeholder="注销" />
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <button disabled={busy || txt !== "注销"} onClick={go} className="mt-4 h-11 w-full rounded-lg bg-destructive font-bold text-destructive-foreground disabled:opacity-40">{busy ? "处理中…" : "永久注销账号"}</button>
      <Link to="/" className="mt-4 inline-block text-sm text-muted-foreground underline">取消</Link>
    </Shell>
  );
}
const Shell = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-screen items-start justify-center bg-background px-5 py-12 text-center text-foreground"><div className="w-full max-w-md">{children}</div></div>;
export default function DeleteAccount() { return <RequireLogin><Inner /></RequireLogin>; }
