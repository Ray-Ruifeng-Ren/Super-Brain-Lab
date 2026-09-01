import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

type Overview = { users: number; attempts: number; correct: number };
type AdminUser = {
  id: string;
  nickname: string;
  email: string;
  created_at: string;
  total: number;
  correct: number;
  last_active: string | null;
};
type Attempt = {
  id: string;
  user_id: string;
  game: string;
  mode: string;
  terms: number[];
  signs: string[];
  answer: number;
  user_answer: number | null;
  correct: boolean;
  used_ms: number;
  created_at: string;
};

async function callAdmin<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-data", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

export default function Admin() {
  const { user, loading } = useAuth();
  const { isAdmin, checking } = useIsAdmin();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const [o, u, a] = await Promise.all([
        callAdmin<Overview>("overview"),
        callAdmin<{ users: AdminUser[] }>("users", { limit: 200 }),
        callAdmin<{ attempts: Attempt[] }>("attempts", { limit: 200 }),
      ]);
      setOverview(o);
      setUsers(u.users);
      setAttempts(a.attempts);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (loading || checking) {
    return <div className="p-10 text-sm text-muted-foreground">加载中…</div>;
  }
  if (!user) {
    return (
      <div className="p-10 space-y-3">
        <p className="text-sm">请先登录。</p>
        <Button asChild variant="outline">
          <Link to="/">返回首页</Link>
        </Button>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="p-10 space-y-3">
        <h1 className="text-lg font-semibold">无权访问</h1>
        <p className="text-sm text-muted-foreground">这个页面仅管理员可见。</p>
        <Button asChild variant="outline">
          <Link to="/">返回首页</Link>
        </Button>
      </div>
    );
  }

  const acc = overview && overview.attempts > 0
    ? Math.round((overview.correct / overview.attempts) * 100)
    : 0;

  const shown = users.filter(
    (u) =>
      !filter ||
      u.nickname?.toLowerCase().includes(filter.toLowerCase()) ||
      u.email?.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">管理后台</h1>
          <p className="text-xs text-muted-foreground">全部用户数据（服务端读取，绕过行级权限）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            {busy ? "刷新中…" : "刷新"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">返回</Link>
          </Button>
        </div>
      </header>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "用户数", value: overview?.users ?? "—" },
          { label: "总答题数", value: overview?.attempts ?? "—" },
          { label: "答对数", value: overview?.correct ?? "—" },
          { label: "整体正确率", value: overview ? `${acc}%` : "—" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">用户</TabsTrigger>
          <TabsTrigger value="attempts">最近答题</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">用户列表（{shown.length}）</CardTitle>
              <Input
                className="mt-2 h-8 max-w-xs"
                placeholder="搜索昵称或邮箱"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2">昵称</th>
                    <th className="py-2">邮箱</th>
                    <th className="py-2 text-right">题数</th>
                    <th className="py-2 text-right">正确率</th>
                    <th className="py-2">最近活跃</th>
                    <th className="py-2">注册时间</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((u) => (
                    <tr key={u.id} className="border-t border-border/60">
                      <td className="py-2">{u.nickname || "—"}</td>
                      <td className="py-2">{u.email || "—"}</td>
                      <td className="py-2 text-right tabular-nums">{u.total}</td>
                      <td className="py-2 text-right tabular-nums">
                        {u.total ? `${Math.round((u.correct / u.total) * 100)}%` : "—"}
                      </td>
                      <td className="py-2">{fmt(u.last_active)}</td>
                      <td className="py-2">{fmt(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attempts">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">最近 200 条答题</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2">时间</th>
                    <th className="py-2">项目</th>
                    <th className="py-2">题目</th>
                    <th className="py-2 text-right">答案</th>
                    <th className="py-2 text-right">作答</th>
                    <th className="py-2">结果</th>
                    <th className="py-2 text-right">用时</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t border-border/60">
                      <td className="py-2">{fmt(a.created_at)}</td>
                      <td className="py-2">{a.game}</td>
                      <td className="py-2">
                        {a.terms
                          ?.map((t, i) => (i === 0 ? `${t}` : `${a.signs?.[i - 1] ?? "+"}${t}`))
                          .join(" ")}
                      </td>
                      <td className="py-2 text-right tabular-nums">{a.answer}</td>
                      <td className="py-2 text-right tabular-nums">{a.user_answer ?? "—"}</td>
                      <td className={`py-2 ${a.correct ? "text-emerald-600" : "text-destructive"}`}>
                        {a.correct ? "对" : "错"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {(a.used_ms / 1000).toFixed(1)}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
