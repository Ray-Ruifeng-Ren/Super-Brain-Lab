import { useEffect, useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  fetchWrongAttempts,
  formatExpr,
  type AttemptRow,
} from "@/lib/practiceLog";
import { AbacusDetail } from "./AbacusDetail";
import { masteredSet } from "@/lib/mistakeMastery";

interface Props {
  game: string;
  refreshKey?: number;
  mistakeMode: boolean;
  onMistakeModeChange: (v: boolean) => void;
}

const PAGE_SIZE = 15;

export function MistakeBook({ game, refreshKey, mistakeMode, onMistakeModeChange }: Props) {
  const [unsolved, setUnsolved] = useState<AttemptRow[]>([]);
  const [solved, setSolved] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<"unsolved" | "solved">("unsolved");

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchWrongAttempts(game, 1000).then((w) => {
      if (!live) return;
      const mastered = masteredSet(game);
      const seen = new Set<string>();
      const u: AttemptRow[] = [];
      const s: AttemptRow[] = [];
      for (const r of w) {
        const k = `${(r.signs ?? []).join("")}|${(r.terms ?? []).join(",")}|${r.answer}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (mastered.has(k)) s.push(r);
        else u.push(r);
      }
      setUnsolved(u);
      setSolved(s);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [game, refreshKey]);

  useEffect(() => {
    setPage(0);
    setSelectedIdx(null);
  }, [tab]);

  const wrong = tab === "unsolved" ? unsolved : solved;
  const totalPages = Math.max(1, Math.ceil(wrong.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageItems = useMemo(
    () => wrong.slice(pageStart, pageStart + PAGE_SIZE),
    [wrong, pageStart],
  );


  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col overflow-hidden p-3">
        <div className="mb-2 flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium">只练错题</span>
            {wrong.length > 0 && (
              <span className="rounded bg-destructive/10 px-1 font-mono-tabular text-[10px] text-destructive">
                {wrong.length}
              </span>
            )}
          </div>
          <Switch
            checked={mistakeMode}
            onCheckedChange={onMistakeModeChange}
            disabled={wrong.length === 0}
          />
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground">
            加载中…
          </div>
        ) : wrong.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground">
            还没有错题，继续保持 👍
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-1 overflow-y-auto pr-1">
              {pageItems.map((w, i) => {
                const idx = pageStart + i;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedIdx(idx)}
                      className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono-tabular text-[10px] text-muted-foreground">
                        #{idx + 1}
                      </span>
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
                          <span className="mx-1.5">·</span>
                          <span className="text-primary">查看算珠 →</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {totalPages > 1 && (
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                >
                  <ChevronLeft className="h-3 w-3" /> 上一页
                </button>
                <span className="font-mono-tabular text-[10px] text-muted-foreground">
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                >
                  下一页 <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <AbacusDetail
        attempts={wrong}
        index={selectedIdx}
        onIndexChange={setSelectedIdx}
        onClose={() => setSelectedIdx(null)}
      />
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
