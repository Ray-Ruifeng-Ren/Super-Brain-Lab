// 顶栏「护眼」开关:全局生效(广场 / 训练页 / 作业页同一个),见 lib/eyeCare
import { Sun, Moon } from "lucide-react";
import { useEyeCare, toggleEyeCare } from "@/lib/eyeCare";
import { useTx } from "@/lib/tx";
import { cn } from "@/lib/utils";

export function EyeCareToggle({ className }: { className?: string }) {
  const on = useEyeCare();
  const tx = useTx();
  return (
    <button
      type="button"
      onClick={toggleEyeCare}
      aria-pressed={on}
      title={on ? tx("护眼模式已开:作答舞台用浅色") : tx("护眼模式:作答舞台改成浅色")}
      className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors", on ? "border-[#E0741A]/60 bg-[#FFF3E0] text-[#8A4A1C]" : "border-border bg-background/70 text-muted-foreground hover:text-foreground", className)}
    >
      {on ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span>{tx("护眼")}</span>
    </button>
  );
}
