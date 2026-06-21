import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle } from "lucide-react";
import {
  fetchWrongAttempts,
  formatExpr,
  type AttemptRow,
} from "@/lib/practiceLog";

interface Props {
  game: string;
  refreshKey?: number;
  mistakeMode: boolean;
  onMistakeModeChange: (v: boolean) => void;
}

export function MistakeBook({ game, refreshKey, mistakeMode, onMistakeModeChange }: Props) {
  const [wrong, setWrong] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchWrongAttempts(game, 50).then((w) => {
      if (!live) return;
      setWrong(w);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [game, refreshKey]);

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <AlertTriangle className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          错题本
        </span>
        {wrong.length > 0 && (
          <span className="ml-auto rounded bg-destructive/10 px-1 font-mono-tabular text-[10px] text-destructive">
            {wrong.length}
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="mb-2 flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <div>
            <div className="text-xs font-medium">只练错题</div>
            <div className="text-[10px] text-muted-foreground">下一局从错题池抽题</div>
          </div>
          <Switch
            checked={mistakeMode}
            onCheckedChange={onMistakeModeChange}
            disabled={wrong.length === 0}
          />
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">加载中…</div>
        ) : wrong.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            还没有错题，继续保持 👍
          </div>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {wrong.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono-tabular text-[11px]">
                    {formatExpr(w.terms, w.signs)} = {w.answer}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    你答{" "}
                    <span className="font-mono-tabular text-destructive">
                      {w.user_answer ?? "超时"}
                    </span>
                    <span className="mx-1.5">·</span>
                    {timeAgo(w.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(iso).toLocaleDateString();
}
