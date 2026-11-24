// 重置密码弹窗(2026-10-29 布施「我在后台重置密码之后,他用新密码去登录,显示登录失败」):
// 原来用浏览器 prompt 输新密码 —— 手机上会自动首字母大写 / 纠错 / 带空格,看不见实际存进去的是什么。
// 现在:明文显示输入(可切换隐藏)、关掉大写纠错、去首尾空格;成功后把「登录账号 + 新密码」原样显示出来,可一键复制发给学生。
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PasswordInput, cleanPassword } from "@/components/ui/password-input";
import { resetStudentPassword } from "@/lib/classManage";
import { useTx } from "@/lib/tx";
import { useI18n } from "@/lib/i18n";
import { phoneLoginOf } from "@/lib/phoneCountries";

/** 账号邮箱 → 学生登录时实际要填的东西:登录名 / 手机号 / 邮箱 */
export function loginIdOf(email?: string | null): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (domain === "stu.superbrainlab.org") return local;
  if (domain === "phone.superbrainlab.org") return phoneLoginOf(local); // 中国/美加直接是号码,其他国家带 +区号
  return email;
}

export function ResetPasswordDialog({ target, onClose }: { target: { id: string; name: string; loginId?: string } | null; onClose: () => void }) {
  const tx = useTx();
  const { lang } = useI18n();
  const T = (zh: string, en: string) => (lang === "en" ? en : zh);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setPw(""); setErr(""); setDone(null); setCopied(false); }, [target?.id]);
  const clean = cleanPassword(pw);

  const submit = async () => {
    if (!target || busy) return;
    if (clean.length < 6) { setErr(tx("密码至少 6 位")); return; }
    setBusy(true); setErr("");
    const r = await resetStudentPassword(target.id, clean);
    setBusy(false);
    if (!r.ok) { setErr(r.error || tx("重置失败")); return; }
    setDone(clean);
  };
  const shareText = done ? T(`${target?.name} 的新登录信息\n账号:${target?.loginId || "(用原来的手机号/邮箱/登录名)"}\n密码:${done}`, `${target?.name} — new login\nAccount: ${target?.loginId || "(same phone/email/login name as before)"}\nPassword: ${done}`) : "";

  return (
    <Dialog open={!!target} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-base font-black">{T(`重置「${target?.name ?? ""}」的密码`, `Reset password for “${target?.name ?? ""}”`)}</DialogTitle>
        {!done ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            {target?.loginId && <p className="text-xs text-muted-foreground">{tx("登录账号")}:<b className="font-mono-tabular text-foreground">{target.loginId}</b></p>}
            <PasswordInput defaultVisible autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder={tx("新密码(至少 6 位)")} maxLength={72} autoComplete="new-password" />
            {pw !== clean && clean && <p className="text-[11px] text-amber-700">{tx("首尾的空格会自动去掉")}</p>}
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="rounded-full border px-4 py-1.5 text-sm">{tx("取消")}</button>
              <button type="submit" disabled={busy || clean.length < 6} className="rounded-full bg-foreground px-5 py-1.5 text-sm font-bold text-background disabled:opacity-40">{busy ? tx("重置中…") : tx("重置密码")}</button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700">✓ {tx("已重置。把下面的账号和密码原样告诉学生:")}</p>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 font-mono-tabular text-sm">
              {target?.loginId && <div>{tx("账号")}:<b>{target.loginId}</b></div>}
              <div>{tx("密码")}:<b className="text-base tracking-wide">{done}</b></div>
            </div>
            <p className="text-[11px] text-muted-foreground">{tx("登录时注意大小写,前后不要带空格。")}</p>
            <div className="flex justify-end gap-2">
              <button onClick={async () => { try { await navigator.clipboard.writeText(shareText); setCopied(true); } catch { /* 复制不了就手抄 */ } }} className="rounded-full border px-4 py-1.5 text-sm">{copied ? tx("已复制") : tx("复制")}</button>
              <button onClick={onClose} className="rounded-full bg-foreground px-5 py-1.5 text-sm font-bold text-background">{T("完成", "Done")}</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
