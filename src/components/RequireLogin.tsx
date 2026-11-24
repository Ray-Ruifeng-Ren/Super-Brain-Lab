// 登录门槛(2026-11-01 用户「增加限制,不登录没法使用」):练习、脑力游戏、等级鉴定、出题系统都要登录。
// 不拦:首页(要从这里登录注册)、/key 扫码看答案(印在卷子上的二维码,家长学生不用登录)。教练端 / 作业页 / 后台各有自己的登录页。
// 没登录时自动弹出登录框;登录成功后留在原地址,直接进入想去的页面。
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import { useTx } from "@/lib/tx";

export function RequireLogin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(true);
  const tx = useTx();
  // DEV 专用:?preview=1 免登录看界面(生产构建剔除)
  const devPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  if (user || devPreview) return <>{children}</>;
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 text-foreground">
      <div aria-hidden className="paper-bg pointer-events-none fixed inset-0 z-0" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <Lock className="mx-auto h-9 w-9 text-[#7a5520]" />
        <h1 className="mt-3 text-xl font-black">{tx("登录后才能使用")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{tx("练习成绩、错题和进度都会保存在你的账号里。")}</p>
        <button onClick={() => setOpen(true)} className="hp-leather hp-leather-on mt-5 w-full rounded-full py-2.5 text-sm font-bold">{tx("登录 / 注册")}</button>
        <Link to="/" className="mt-3 block text-xs text-muted-foreground underline-offset-2 hover:underline">{tx("返回首页")}</Link>
      </div>
      <AuthDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
