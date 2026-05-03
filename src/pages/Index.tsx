import { useEffect, useState } from "react";
import { SchulteGame } from "@/components/SchulteGame";
import { Leaderboard } from "@/components/Leaderboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getPlayerName, setPlayerName } from "@/lib/leaderboard";
import { Brain, Zap, User } from "lucide-react";

const SIZES = [3, 4, 5, 6];
const LABELS: Record<number, string> = { 3: "入门", 4: "标准", 5: "进阶", 6: "大师" };

const Index = () => {
  const [size, setSize] = useState(4);
  const [name, setName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setName(getPlayerName());
  }, []);

  const handleNameChange = (v: string) => {
    setName(v);
    setPlayerName(v);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-card">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">NeuroPlay</h1>
              <p className="text-xs text-muted-foreground">脑力竞技场</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="你的昵称"
              className="h-6 w-28 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
              maxLength={12}
            />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-gradient-hero">
        <div className="container py-10 text-primary-foreground">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-80">
            <Zap className="h-3.5 w-3.5" />
            今日挑战 · 舒尔特方格
          </div>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">
            训练你的注意力极限
          </h2>
          <p className="mt-2 max-w-xl text-sm opacity-90 md:text-base">
            按 <b>1 → N</b> 顺序点击方格，时间越短分数越高。全球飞行员都在用的经典训练法。
          </p>
        </div>
      </section>

      {/* Main */}
      <main className="container py-8">
        {/* Difficulty selector */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-semibold text-muted-foreground">难度</span>
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition-all",
                size === s
                  ? "border-transparent bg-gradient-primary text-primary-foreground shadow-md"
                  : "bg-card hover:border-primary/40 hover:text-primary",
              )}
            >
              {s}×{s} <span className="ml-1 opacity-70">{LABELS[s]}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border bg-card p-5 shadow-elegant md:p-8">
            <SchulteGame
              size={size}
              onFinished={() => setRefreshKey((k) => k + 1)}
            />
          </div>
          <aside className="space-y-4">
            <Leaderboard size={size} refreshKey={refreshKey} />
            <div className="rounded-2xl border bg-gradient-card p-5 text-sm">
              <h4 className="mb-2 font-bold">💡 玩法提示</h4>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>· 视线尽量盯住中心</li>
                <li>· 用余光扫描周围数字</li>
                <li>· 5×5 平均水平：25-35 秒</li>
                <li>· 大师水平：&lt; 18 秒</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <footer className="container py-6 text-center text-xs text-muted-foreground">
        排名当前保存在本机 · 想看全球榜？接入 Lovable Cloud 即可一键升级
      </footer>
    </div>
  );
};

export default Index;
