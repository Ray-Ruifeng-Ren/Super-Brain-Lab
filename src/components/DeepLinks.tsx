// App 壳深链接:superbrainlab://<path>(如 superbrainlab:///play/flashmath)→ 在 App 内跳到对应页面。
// 用途:作业/活动链接直接拉起 App 里的页面;也让模拟器能用 `xcrun simctl openurl` 打开任意页截图。网页版不做任何事。
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IS_NATIVE } from "@/lib/appEnv";

export function DeepLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!IS_NATIVE) return;
    // 测试/截图用:构建时 VITE_APP_START=/play/flashmath 可让 App 启动后直接进该页(正式包不设)
    const start = import.meta.env.VITE_APP_START as string | undefined;
    if (start && start.startsWith("/") && start !== "/") navigate(start);
    let remove: (() => void) | undefined;
    import("@capacitor/app").then(({ App }) => {
      const toPath = (url: string) => {
        try {
          const u = new URL(url);
          // superbrainlab:///play/x 与 https://superbrainlab.org/play/x 都支持
          return (u.pathname || "/") + u.search;
        } catch { return null; }
      };
      App.addListener("appUrlOpen", ({ url }) => { const p = toPath(url); if (p) navigate(p); }).then((h) => { remove = () => h.remove(); });
      App.getLaunchUrl().then((r) => { const p = r?.url ? toPath(r.url) : null; if (p && p !== "/") navigate(p); }).catch(() => {});
    }).catch(() => {});
    return () => remove?.();
  }, [navigate]);
  return null;
}
