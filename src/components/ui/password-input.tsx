// 带「小眼睛」的密码框(2026-10-29 布施「设置密码时右边要有一个眼睛能看到密码,不然年纪大了总输入错」)。
// 同时关掉手机键盘的首字母大写 / 自动纠错 —— iPhone 上 prompt / 普通输入框会把 abc123 变成 Abc123,导致「重置后登录失败」。
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTx } from "@/lib/tx";

type Props = Omit<React.ComponentProps<"input">, "type"> & { defaultVisible?: boolean; wrapperClassName?: string };

export const PasswordInput = React.forwardRef<HTMLInputElement, Props>(({ className, wrapperClassName, defaultVisible = false, ...props }, ref) => {
  const [show, setShow] = React.useState(defaultVisible);
  const tx = useTx();
  return (
    <div className={cn("relative", wrapperClassName)}>
      <input
        ref={ref}
        {...props}
        type={show ? "text" : "password"}
        autoCapitalize="none" autoCorrect="off" spellCheck={false}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-11 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          show && "font-mono-tabular tracking-wide",
          className,
        )}
      />
      <button type="button" tabIndex={-1} onClick={() => setShow((v) => !v)}
        aria-label={show ? tx("隐藏密码") : tx("显示密码")} title={show ? tx("隐藏密码") : tx("显示密码")}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

/** 设密码时去掉首尾空格(中文输入法常带进空格,学生登录时又没打 → 「密码错误」) */
export const cleanPassword = (s: string) => s.trim();
