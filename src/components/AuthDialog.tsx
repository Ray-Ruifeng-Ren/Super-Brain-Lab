import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().email("邮箱格式不正确").max(255);
const pwdSchema = z.string().min(6, "密码至少 6 位").max(72);

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);

  const submitEmail = async () => {
    const e = emailSchema.safeParse(email);
    if (!e.success) return toast({ title: e.error.issues[0].message, variant: "destructive" });
    const p = pwdSchema.safeParse(password);
    if (!p.success) return toast({ title: p.error.issues[0].message, variant: "destructive" });
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nickname: nickname.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast({ title: "注册成功", description: "已自动登录。" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "欢迎回来" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.redirected) return;
    if (r.error) {
      toast({ title: "Google 登录失败", description: String(r.error), variant: "destructive" });
      setLoading(false);
      return;
    }
    onOpenChange(false);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">欢迎来到 NeuroPlay</DialogTitle>
          <DialogDescription>登录后成绩将同步到云端排行榜。</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">登录</TabsTrigger>
            <TabsTrigger value="signup">注册</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-3 pt-3">
            <FieldEmail value={email} onChange={setEmail} />
            <FieldPwd value={password} onChange={setPassword} />
          </TabsContent>

          <TabsContent value="signup" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">昵称</Label>
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={16} placeholder="排行榜上显示的名字" />
            </div>
            <FieldEmail value={email} onChange={setEmail} />
            <FieldPwd value={password} onChange={setPassword} />
          </TabsContent>
        </Tabs>

        <Button onClick={submitEmail} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {mode === "signin" ? "登录" : "注册并登录"}
        </Button>

        <div className="flex items-center gap-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" onClick={google} disabled={loading} className="w-full">
          使用 Google 继续
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function FieldEmail({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">邮箱</Label>
      <Input type="email" autoComplete="email" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function FieldPwd({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">密码</Label>
      <Input type="password" autoComplete="current-password" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
