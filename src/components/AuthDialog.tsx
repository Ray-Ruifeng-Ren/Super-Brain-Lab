import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { isLoginName, loginToEmail } from "@/lib/classManage";
import { useTx } from "@/lib/tx";
import { PasswordInput } from "@/components/ui/password-input";

// 注册:名字 + 手机号(国家/地区下拉 + 号码,必填合法校验)+ 邮箱(系统选填)+ 自设密码。不走短信验证码。
// 登录:一个框填手机号或邮箱 + 密码。手机号底层映射成内部邮箱: <区号><号码>@phone.superbrainlab.org
// 2026-10-29 用户「只有 +86 和 +1,可以设置其他国家的吗」→ 国家表见 lib/phoneCountries;中国 11 位、美加 10 位直接填号码即可登录,
// 其他国家/地区登录时号码前加区号(+44 7911…),因为位数会撞车、单看号码判断不出国家
import { PHONE_COUNTRIES, sortedMore, countryById, nationalDigits, phoneError, phoneToEmail, intlPhoneToEmail, bareLoginCandidates, IN_LOCALE } from "@/lib/phoneCountries";
import { useI18n } from "@/lib/i18n";
import { siteUrl } from "@/lib/appEnv";

const emailSchema = z.string().trim().email("邮箱格式不正确").max(255);
const pwdSchema = z.string().min(6, "密码至少 6 位").max(72);

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const tx = useTx();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  // 登录
  const [identifier, setIdentifier] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  // 注册
  const [name, setName] = useState("");
  const [ccId, setCcId] = useState(IN_LOCALE ? "IN" : "CN"); // 国家/地区;"other" = 手动填区号;在印度默认 +91
  const [otherCode, setOtherCode] = useState("");
  const { lang } = useI18n();
  const ccInfo = countryById(ccId);
  const ccCode = ccInfo ? ccInfo.code : otherCode.replace(/\D/g, "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [regPwd, setRegPwd] = useState("");

  // 登录标识 → 可能的登录邮箱(按先后逐个试):含 @ 视作邮箱;+区号直接定国家;
  // 纯数字按位数猜:11 位 → +86;10 位 → +1 / +91(印度手机号也是 10 位,两个都试)
  const resolveLoginEmails = (raw: string): string[] => {
    const id = raw.trim();
    if (id.includes("@")) return emailSchema.safeParse(id).success ? [id] : [];
    const intl = intlPhoneToEmail(id); // +44 7911… / 0044…
    if (intl) return [intl];
    const out = bareLoginCandidates(id);
    if (isLoginName(id)) out.push(loginToEmail(id)); // 教练建的学生账号:登录名
    return out;
  };

  const login = async () => {
    if (!identifier.trim()) return toast({ title: tx("请输入手机号 / 邮箱 / 登录名"), variant: "destructive" });
    if (!loginPwd) return toast({ title: tx("请输入密码"), variant: "destructive" });
    const candidates = resolveLoginEmails(identifier);
    if (!candidates.length) {
      // 其他国家的号码没带区号:提示加区号(单看号码分不出是哪国)
      if (/^[\d\s-]{6,16}$/.test(identifier.trim())) return toast({ title: tx("海外手机号请在前面加区号"), description: tx("例如 +44 7911123456、+852 61234567"), variant: "destructive" });
      return toast({ title: tx("请输入有效的手机号、邮箱或登录名"), variant: "destructive" });
    }
    setLoading(true);
    try {
      let error: Error | null = null;
      for (const loginEmail of candidates) {
        ({ error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd }));
        // 输入法带进来的首尾空格:原样登不上就去掉空格再试一次(2026-10-29 重置密码后登录失败排查)
        if (error && loginPwd !== loginPwd.trim() && loginPwd.trim()) ({ error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd.trim() }));
        if (!error) break;
        if (!/invalid login credentials/i.test(error.message)) break; // 网络等其他错误不再换号码重试
      }
      // 填的是注册时附带的邮箱(账号其实是手机号):到服务端查出真正的账号再试一次(2026-11-12 印度用户)
      if (error && /invalid login credentials/i.test(error.message) && identifier.includes("@") && !/@(phone|stu)\.superbrainlab\.org$/i.test(identifier.trim())) {
        const alias = await fetch(siteUrl("/.netlify/functions/login-alias"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: identifier.trim() }) })
          .then((r) => (r.ok ? r.json() : null)).then((j) => (j?.account as string | null) ?? null).catch(() => null);
        if (alias) ({ error } = await supabase.auth.signInWithPassword({ email: alias, password: loginPwd.trim() }));
      }
      if (error) throw error;
      toast({ title: tx("欢迎回来") });
      onOpenChange(false);
    } catch (err: any) {
      // 纯数字但不是中国 11 位 / 美加 10 位:可能是没带区号的海外手机号(也可能是数字登录名),失败时提示加区号
      // 纯数字登不上:多半是海外号码没带区号(各国号码位数会撞车),提示加上区号再试
      const digitsOnly = /^[\d\s\-().]{6,18}$/.test(identifier.trim()) && !identifier.trim().startsWith("+");
      toast({ title: tx("登录失败"), description: tx(humanizeAuthError(err)) + (digitsOnly ? (lang === "en" ? " If you signed up with a phone number, add the country code and try again, e.g. +91 9876543210 or +1 4165551234." : " 如果用手机号注册的,请在号码前加区号再试,如 +91 9876543210、+1 4165551234。") : ""), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const signup = async () => {
    if (!name.trim()) return toast({ title: tx("请填写名字"), variant: "destructive" });
    const national = nationalDigits(ccCode, phone);
    const perr = phoneError(ccCode, national, ccInfo, lang === "en");
    if (perr) return toast({ title: perr, variant: "destructive" });
    const acct = phoneToEmail(ccCode, national);
    const ageN = Number(age);
    if (!Number.isFinite(ageN) || ageN < 3 || ageN > 99) return toast({ title: tx("请填写年龄(3-99 周岁)"), variant: "destructive" });
    const pw = pwdSchema.safeParse(regPwd.trim());
    if (!pw.success) return toast({ title: tx(pw.error.issues[0].message), variant: "destructive" });
    if (email.trim()) { const e = emailSchema.safeParse(email); if (!e.success) return toast({ title: tx(e.error.issues[0].message), variant: "destructive" }); }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: acct,
        password: regPwd.trim(),
        // birthYear:等级鉴定按年龄分组用(存出生年,不过期)
        options: { data: { nickname: name.trim(), name: name.trim(), phone: `+${ccCode}${national}`, signup_email: email.trim() || null, birthYear: new Date().getFullYear() - Math.round(ageN) } },
      });
      if (error) throw error;
      if (!data.session) {
        const { error: e2 } = await supabase.auth.signInWithPassword({ email: acct, password: regPwd.trim() });
        if (e2) throw new Error("注册成功,但无法自动登录(后台可能开启了邮箱确认,需关闭)。");
      }
      // 海外号码:告诉用户以后登录要带区号
      toast(ccCode === "86" || ccCode === "1" || ccCode === "91" // 这三个国家直接填号码就能登录
        ? { title: tx("注册成功"), description: tx("已自动登录。") }
        : { title: tx("注册成功"), description: lang === "en" ? `You're logged in. Next time, log in with +${ccCode} ${national}` : `已自动登录。以后登录请填 +${ccCode} ${national}` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: tx("注册失败"), description: tx(humanizeAuthError(err)), variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <img src="/logo-emblem.png?v=2" alt="" className="mb-1 h-14 w-auto self-center sm:self-start [@media(max-height:560px)]:hidden" />
          <DialogTitle className="font-display text-2xl">{tx("欢迎来到珠象")}</DialogTitle>
          <DialogDescription>{tx("登录后成绩将同步到云端排行榜。")}</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{tx("登录")}</TabsTrigger>
            <TabsTrigger value="signup">{tx("注册")}</TabsTrigger>
          </TabsList>

          {/* 登录:手机号或邮箱 + 密码 */}
          <TabsContent value="signin" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tx("手机号 / 邮箱 / 学生登录名")}</Label>
              <Input autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={tx("手机号(海外加区号 +44…)、邮箱或登录名")}
                value={identifier} onChange={(e) => setIdentifier(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tx("密码")}</Label>
              <PasswordInput autoComplete="current-password" placeholder={tx("输入密码")}
                value={loginPwd} onChange={(e) => setLoginPwd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
            </div>
            <Button onClick={login} disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{tx("登录")}
            </Button>
          </TabsContent>

          {/* 注册:名字 + 手机号(区号下拉) + 邮箱 + 密码 */}
          <TabsContent value="signup" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tx("名字")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder={tx("你的名字(排行榜显示)")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tx("手机号")}</Label>
              <div className="flex items-center gap-2">
                <select value={ccId} onChange={(e) => { setCcId(e.target.value); setPhone(""); }} aria-label={tx("国家/地区")}
                  className="h-10 w-[7.5rem] shrink-0 rounded-md border border-input bg-muted px-1.5 text-sm outline-none focus:border-primary">
                  <optgroup label={tx("常用")}>
                    {PHONE_COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.flag} +{c.code} {lang === "en" ? c.en : c.zh}</option>)}
                  </optgroup>
                  <optgroup label={tx("全部国家/地区")}>
                    {sortedMore(lang === "en").map((c) => <option key={c.id} value={c.id}>{c.flag} +{c.code} {lang === "en" ? c.en : c.zh}</option>)}
                    <option value="other">🌐 {tx("其他(填区号)")}</option>
                  </optgroup>
                </select>
                {ccId === "other" && (
                  <Input inputMode="numeric" aria-label={tx("区号")} placeholder={tx("+区号")} className="w-[4.5rem] shrink-0 px-2"
                    value={otherCode ? `+${otherCode}` : ""} onChange={(e) => setOtherCode(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                )}
                <Input inputMode="numeric" autoComplete="tel" maxLength={ccInfo ? ccInfo.max + 1 : 15}
                  placeholder={ccId === "CN" ? tx("11 位手机号") : ccId === "US" ? tx("10 位号码") : tx("手机号码")}
                  value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tx("年龄(周岁)")}</Label>
              <Input inputMode="numeric" maxLength={2} placeholder={tx("等级鉴定按年龄分组,如 8")}
                value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tx("邮箱")}</Label>
              <Input type="email" autoComplete="email" placeholder={tx("请填写你的邮箱")} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tx("设置密码(至少 6 位)")}</Label>
              <PasswordInput autoComplete="new-password" placeholder={tx("设定登录密码")}
                value={regPwd} onChange={(e) => setRegPwd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signup()} />
            </div>
            <Button onClick={signup} disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{tx("注册并登录")}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function humanizeAuthError(err: any): string {
  const m = String(err?.message ?? err ?? "");
  if (/already registered|already exists|user_already_exists/i.test(m)) return "该手机号已注册,请直接登录。";
  if (/invalid login credentials/i.test(m)) return "账号或密码错误。";
  if (/email not confirmed/i.test(m)) return "账号未激活(后台需关闭邮箱确认),请联系管理员。";
  if (/rate|too many/i.test(m)) return "操作过于频繁,请稍后再试。";
  // 2026-11-03 网络连不上(手机流量直连境外被墙等)单独说清楚,别和「密码错」混在一起
  if (/failed to fetch|load failed|network|fetch|timeout|AuthRetryableFetchError/i.test(m) || err?.name === "AuthRetryableFetchError") return "网络连接不上服务器,请检查网络后重试(可换 Wi-Fi 或手机流量试试)。";
  return m || "操作失败";
}
