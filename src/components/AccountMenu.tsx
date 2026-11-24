import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthDialog } from "./AuthDialog";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LEGAL_READY } from "@/lib/legal";
import { LogOut, User as UserIcon, Pencil, Check, BookOpen, GraduationCap, KeyRound, Info, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useTx } from "@/lib/tx";
import { PasswordInput } from "@/components/ui/password-input";

export function AccountMenu() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const { coach } = useCoachAccess();
  const tx = useTx();
  const [authOpen, setAuthOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  // 改密码(2026-10-12):登录态下直接 updateUser,教练建的学生账号也能自己改
  const [pwOpen, setPwOpen] = useState(false);
  const [pw1, setPw1] = useState(""); const [pw2, setPw2] = useState(""); const [pwBusy, setPwBusy] = useState(false);
  const changePassword = async () => {
    const p1 = pw1.trim(), p2 = pw2.trim(); // 首尾空格去掉(输入法常带空格,下次登录又不带 → 登不上)
    if (p1.length < 6) { toast({ title: tx("密码至少 6 位"), variant: "destructive" }); return; }
    if (p1 !== p2) { toast({ title: tx("两次输入不一致"), variant: "destructive" }); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setPwBusy(false);
    if (error) { toast({ title: tx("修改失败"), description: error.message, variant: "destructive" }); return; }
    toast({ title: tx("密码已修改"), description: tx("下次登录请用新密码。") });
    setPw1(""); setPw2(""); setPwOpen(false);
  };

  if (loading) {
    return <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />;
  }

  if (!user) {
    return (
      <>
        <Button size="sm" onClick={() => setAuthOpen(true)}>{tx("登录")}</Button>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  const display = profile?.nickname || user.email || tx("玩家");
  const initial = display.charAt(0).toUpperCase();

  const saveName = async () => {
    const v = name.trim();
    if (!v) { setEditing(false); return; }
    const { error } = await supabase.from("profiles").update({ nickname: v }).eq("id", user.id);
    if (error) toast({ title: tx("保存失败"), description: error.message, variant: "destructive" });
    else { await refreshProfile(); toast({ title: tx("昵称已更新") }); }
    setEditing(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 transition-colors hover:border-primary/40">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted font-mono-tabular text-[11px] font-semibold">
            {initial}
          </span>
          <span className="max-w-[100px] truncate text-xs font-medium">{display}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{tx("昵称")}</div>
          {editing ? (
            <div className="mt-1 flex gap-1">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                maxLength={16}
                className="h-7 text-xs"
              />
              <Button size="icon" variant="ghost" onClick={saveName} className="h-7 w-7"><Check className="h-3.5 w-3.5" /></Button>
            </div>
          ) : (
            <button
              onClick={() => { setName(profile?.nickname || ""); setEditing(true); }}
              className="mt-0.5 flex w-full items-center justify-between rounded text-sm font-medium hover:text-primary"
            >
              <span className="truncate">{profile?.nickname || tx("未设置")}</span>
              <Pencil className="h-3 w-3 opacity-60" />
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {!coach && <DropdownMenuItem asChild><Link to="/homework"><BookOpen className="mr-2 h-3.5 w-3.5" /> {tx("我的作业")}</Link></DropdownMenuItem>}
        {coach && <DropdownMenuItem asChild><Link to="/coach"><GraduationCap className="mr-2 h-3.5 w-3.5" /> {tx("珠象教练端")}</Link></DropdownMenuItem>}
        <DropdownMenuItem onClick={() => setPwOpen(true)}><KeyRound className="mr-2 h-3.5 w-3.5" /> {tx("修改密码")}</DropdownMenuItem>
        {LEGAL_READY && <DropdownMenuItem asChild><Link to="/about-app"><Info className="mr-2 h-3.5 w-3.5" /> {tx("关于珠象 · 隐私政策")}</Link></DropdownMenuItem>}
        <DropdownMenuItem asChild><Link to="/account/delete" className="text-muted-foreground"><UserX className="mr-2 h-3.5 w-3.5" /> {tx("注销账号")}</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
          <LogOut className="mr-2 h-3.5 w-3.5" /> {tx("退出登录")}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader><DialogTitle>{tx("修改密码")}</DialogTitle><DialogDescription>{tx("设置一个新密码(至少 6 位),立即生效。")}</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <PasswordInput autoComplete="new-password" placeholder={tx("新密码")} value={pw1} onChange={(e) => setPw1(e.target.value)} />
            <PasswordInput autoComplete="new-password" placeholder={tx("再输一遍")} value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && changePassword()} />
            <Button onClick={changePassword} disabled={pwBusy} className="w-full">{pwBusy ? tx("修改中…") : tx("确认修改")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}
