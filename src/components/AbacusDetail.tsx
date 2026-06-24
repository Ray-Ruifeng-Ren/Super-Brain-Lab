import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttemptRow } from "@/lib/practiceLog";

interface Props {
  attempts: AttemptRow[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
  onClose: () => void;
}

/** Render a single suanpan column. Value 0-9. */
function AbacusColumn({ value, dim }: { value: number; dim?: boolean }) {
  const upper = value >= 5 ? 1 : 0; // 1 upper bead worth 5
  const lower = value % 5; // 0..4 lower beads worth 1 each

  // Layout (px). Total height 220.
  // 0..6 top frame, upper bead area 6..62, bar 62..70, lower area 70..214, bottom 214..220
  const upperY = upper ? 46 : 6; // down (against bar) vs up (rest)
  const lowerY = (i: number) => (i < lower ? 70 + i * 18 : 142 + i * 18);

  return (
    <div
      className={cn(
        "relative h-[220px] w-[34px] rounded-sm border border-amber-900/40 bg-amber-50/60",
        dim && "opacity-30",
      )}
    >
      {/* Bar */}
      <div className="absolute left-0 right-0 top-[62px] h-[8px] bg-amber-900/70" />
      {/* Center rod */}
      <div className="absolute inset-y-1 left-1/2 w-[2px] -translate-x-1/2 bg-amber-900/30" />

      {/* Upper bead */}
      <Bead y={upperY} active={upper === 1} />

      {/* Lower beads */}
      {[0, 1, 2, 3].map((i) => (
        <Bead key={i} y={lowerY(i)} active={i < lower} />
      ))}
    </div>
  );
}

function Bead({ y, active }: { y: number; active: boolean }) {
  return (
    <div
      className={cn(
        "absolute left-1/2 h-[16px] w-[28px] -translate-x-1/2 rounded-full border transition-all duration-500 ease-out",
        active
          ? "border-amber-900 bg-gradient-to-b from-amber-700 to-amber-900 shadow-sm"
          : "border-amber-800/60 bg-gradient-to-b from-amber-500/80 to-amber-700/80",
      )}
      style={{ top: y }}
    />
  );
}

function Abacus({ value, columns }: { value: number; columns: number }) {
  // Split value into per-column digits (right-aligned)
  const abs = Math.abs(value);
  const digits = abs.toString().padStart(columns, "0").split("").map(Number);
  // Determine which columns are "dim" (leading zeros before the first significant digit)
  const firstSig = digits.findIndex((d) => d !== 0);
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-md border border-amber-900/30 bg-amber-100/40 p-3">
      {digits.map((d, i) => (
        <AbacusColumn key={i} value={d} dim={firstSig !== -1 && i < firstSig} />
      ))}
    </div>
  );
}

export function AbacusDetail({ attempts, index, onIndexChange, onClose }: Props) {
  const [step, setStep] = useState(1);
  const attempt = index !== null ? attempts[index] ?? null : null;

  // Compute running sums per step (1..n = after applying term i)
  const steps = useMemo(() => {
    if (!attempt) return [] as { running: number; op: string; term: number; sign: string }[];
    const out: { running: number; op: string; term: number; sign: string }[] = [];
    let running = 0;
    attempt.terms.forEach((t, i) => {
      const sign = attempt.signs[i] ?? "+";
      running = sign === "-" ? running - t : running + t;
      out.push({
        running,
        op: i === 0 ? `${sign === "-" ? "−" : ""}${t}` : `${sign === "-" ? "−" : "+"} ${t}`,
        term: t,
        sign,
      });
    });
    return out;
  }, [attempt]);

  useEffect(() => {
    setStep(1);
  }, [attempt?.id]);

  const n = steps.length;
  const cur = steps[step - 1];
  const final = steps[n - 1]?.running ?? 0;
  const columns = Math.max(
    3,
    Math.abs(final).toString().length,
    Math.abs(cur?.running ?? 0).toString().length,
  );

  const hasPrev = attempt !== null && index !== null && (step > 1 || index > 0);
  const hasNext =
    attempt !== null && index !== null && (step < n || index < attempts.length - 1);

  const goNext = () => {
    if (index === null || !attempt) return;
    if (step < n) setStep(step + 1);
    else if (index < attempts.length - 1) onIndexChange(index + 1);
  };
  const goPrev = () => {
    if (index === null || !attempt) return;
    if (step > 1) setStep(step - 1);
    else if (index > 0) {
      const prevAttempt = attempts[index - 1];
      onIndexChange(index - 1);
      setTimeout(() => setStep(prevAttempt.terms.length), 0);
    }
  };

  useEffect(() => {
    if (!attempt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!attempt || index === null) return null;

  return (
    <Dialog open={!!attempt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-sm">
            <span>算珠演示</span>
            <span className="font-mono-tabular text-xs text-muted-foreground">
              错题 #{index + 1} / {attempts.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Expression with highlight */}
        <div className="flex flex-wrap items-center justify-center gap-1 font-mono-tabular text-sm">
          {attempt.terms.map((t, i) => {
            const s = attempt.signs[i] ?? "+";
            const active = i === step - 1;
            return (
              <span
                key={i}
                className={cn(
                  "rounded px-1.5 py-0.5 transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : i < step - 1
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {i === 0 ? (s === "-" ? `−${t}` : `${t}`) : `${s === "-" ? "−" : "+"} ${t}`}
              </span>
            );
          })}
          <span className="text-muted-foreground">= {attempt.answer}</span>
        </div>

        {/* Abacus */}
        <div className="flex justify-center py-2">
          <Abacus value={cur?.running ?? 0} columns={columns} />
        </div>

        {/* Step info */}
        <div className="text-center text-xs">
          <div className="font-medium">
            第 {step} 步 · 拨入 <span className="font-mono-tabular text-primary">{cur?.op}</span>
          </div>
          <div className="mt-0.5 text-muted-foreground">
            当前算珠 = <span className="font-mono-tabular text-foreground">{cur?.running}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={!hasPrev}>
            <ChevronLeft className="h-4 w-4" />
            {step > 1 ? "上一步" : "上一题"}
          </Button>
          <span className="font-mono-tabular text-xs text-muted-foreground">
            {step} / {n}
          </span>
          <Button size="sm" onClick={goNext} disabled={!hasNext}>
            {step < n ? "下一步" : "下一题"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

