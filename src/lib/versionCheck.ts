// 自动更新:每 5 分钟 + 页面回到前台时拉 /version.json,构建号变了且当前没有作答器/演示在进行(页面上没有 .hw-stage),就刷新。
// 2026-10-17 付海东的标签页开了一天没刷新,测到的是旧逻辑。
import { siteUrl } from "@/lib/appEnv";
const CURRENT = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "";
let pending = false;
async function check() {
  if (!CURRENT) return;
  try {
    const r = await fetch(siteUrl(`/version.json?t=${Date.now()}`), { cache: "no-store" });
    if (!r.ok) return;
    const { build } = await r.json();
    if (build && build !== CURRENT) pending = true;
  } catch { /* 离线等情况忽略 */ }
  if (pending && !document.querySelector(".hw-stage, .flash-stage")) location.reload();
}
export function startVersionCheck() {
  if (import.meta.env.DEV) return;
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  setTimeout(check, 60 * 1000);
}
