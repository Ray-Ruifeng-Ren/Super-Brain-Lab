// 比赛系统通用界面零件:页框、卡片、按钮(答题界面直接用训练系统的 HomeworkRunner)
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Shell({ title, sub, children, wide, right }: { title: string; sub?: string; children: ReactNode; wide?: boolean; right?: ReactNode }) {
  return (
    <div className="relative min-h-screen text-[#2B1A08]">
      <div aria-hidden className="paper-bg pointer-events-none fixed inset-0 z-0" />
      <div className={cn("relative z-10 mx-auto px-4 pb-16 pt-5", wide ? "max-w-6xl" : "max-w-2xl")}>
        <header className="mb-5 flex items-center gap-3">
          <Link to="/contest" className="flex items-center gap-2">
            <img src="/logo-emblem.png?v=2" alt="" className="h-10 w-auto" />
            <img src="/logo-text.png?v=2" alt="珠象" className="h-10 w-auto" />
          </Link>
          <div className="ml-1 border-l border-[#d9c39b] pl-3">
            <h1 className="text-lg font-black leading-tight sm:text-xl">{title}</h1>
            {sub && <p className="text-xs text-[#7a6a52]">{sub}</p>}
          </div>
          <div className="ml-auto">{right}</div>
        </header>
        {children}
      </div>
    </div>
  );
}
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("rounded-2xl border border-[#e2cfa4] bg-[#fffdf7]/95 p-5 shadow-sm", className)}>{children}</div>
);
export const Btn = ({ children, onClick, disabled, tone = "gold", className, type }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: "gold" | "dark" | "ghost" | "red"; className?: string; type?: "submit" | "button" }) => (
  <button type={type ?? "button"} onClick={onClick} disabled={disabled}
    className={cn("rounded-full px-5 py-2.5 text-sm font-bold transition disabled:opacity-40",
      tone === "gold" && "hp-leather hp-leather-on", tone === "dark" && "hp-leather", tone === "red" && "bg-[#9e2a2b] text-white hover:brightness-110",
      tone === "ghost" && "border border-[#d9c39b] bg-white/80 text-[#7a5520] hover:bg-white", className)}>{children}</button>
);
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block"><span className="mb-1 block text-sm font-bold text-[#5c4a30]">{label}</span>{children}</label>
);
export const inputCls = "w-full rounded-xl border border-[#d9c39b] bg-white px-3 py-2.5 text-base outline-none focus:border-[#9c7a2e]";
export const Err = ({ msg }: { msg?: string | null }) => (msg ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p> : null);
