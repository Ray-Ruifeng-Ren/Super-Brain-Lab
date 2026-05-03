import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthDialog } from "./AuthDialog";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, Pencil, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function AccountMenu() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  if (loading) {
    return <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />;
  }

  if (!user) {
    return (
      <>
        <Button size="sm" onClick={() => setAuthOpen(true)}>登录</Button>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  const display = profile?.nickname || user.email || "玩家";
  const initial = display.charAt(0).toUpperCase();

  const saveName = async () => {
    const v = name.trim();
    if (!v) { setEditing(false); return; }
    const { error } = await supabase.from("profiles").update({ nickname: v }).eq("id", user.id);
    if (error) toast({ title: "保存失败", description: error.message, variant: "destructive" });
    else { await refreshProfile(); toast({ title: "昵称已更新" }); }
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
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">昵称</div>
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
              <span className="truncate">{profile?.nickname || "未设置"}</span>
              <Pencil className="h-3 w-3 opacity-60" />
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
          <LogOut className="mr-2 h-3.5 w-3.5" /> 退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
