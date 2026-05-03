import { useEffect, useState } from "react";
import { formatTime, getTopBySize, type Score } from "@/lib/leaderboard";
import { Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export function Leaderboard({ size, refreshKey }: { size: number; refreshKey: number }) {
  const [scores, setScores] = useState<Score[]>([]);

  useEffect(() => {
    setScores(getTopBySize(size, 10));
  }, [size, refreshKey]);

  const medal = (i: number) => {
    if (i === 0) return <Trophy className="h-4 w-4 text-energy" />;
    if (i === 1) return <Medal className="h-4 w-4 text-muted-foreground" />;
    if (i === 2) return <Award className="h-4 w-4" style={{ color: "hsl(25 80% 50%)" }} />;
    return <span className="w-4 text-center text-xs text-muted-foreground">{i + 1}</span>;
  };

  return (
    <div className="rounded-2xl border bg-gradient-card p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">排行榜</h3>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
          {size}×{size}
        </span>
      </div>
      {scores.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          还没有记录，先打一局占领榜首吧 🚀
        </p>
      ) : (
        <ol className="space-y-1">
          {scores.map((s, i) => (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                i === 0 && "bg-energy/10",
                i > 0 && "hover:bg-secondary/60",
              )}
            >
              <div className="flex h-6 w-6 items-center justify-center">{medal(i)}</div>
              <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
              <span className="font-mono-tabular text-sm font-bold">{formatTime(s.timeMs)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
