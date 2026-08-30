// 闪电心算页面右上角「背景」按钮:弹出可选背景视频,点选即时切换(仅本设备生效)。
import { useState } from "react";
import { ImageIcon, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { FLASH_BG_OPTIONS, getFlashBg, setFlashBg } from "@/lib/flashBackground";
import { cn } from "@/lib/utils";

export function BackgroundPicker() {
  const [cur, setCur] = useState<string>(getFlashBg);
  const choose = (url: string) => { setFlashBg(url); setCur(url); };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="选择背景"
          aria-label="选择背景"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">选择背景</div>
        <div className="grid grid-cols-2 gap-1.5">
          {FLASH_BG_OPTIONS.map((o) => {
            const active = cur === o.url;
            return (
              <button
                key={o.id}
                onClick={() => choose(o.url)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors",
                  active ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-muted",
                )}
              >
                <span className="text-sm leading-none">{o.emoji}</span>
                <span className="truncate">{o.label}</span>
                {active && <Check className="ml-auto h-3 w-3 shrink-0" />}
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">部分视频较大,首次加载稍等片刻;设置仅在本设备生效。</p>
      </PopoverContent>
    </Popover>
  );
}
