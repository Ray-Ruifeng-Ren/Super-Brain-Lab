import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { LanguageProvider } from "./lib/i18n";
import { IS_NATIVE } from "./lib/appEnv";
import { startVersionCheck } from "./lib/versionCheck";

// App 壳:根元素打 native 标记,CSS 据此让页面避开状态栏/Home 条(见 index.css「App 壳」段)
if (IS_NATIVE) document.documentElement.classList.add("native");
// 手机横屏标记(index.css 用 html.phone-landscape 压缩排版):用 screen 尺寸判断,不受 body zoom 影响(媒体查询会被 zoom 改掉视口尺寸而自我取消)
const markPhoneLandscape = () => {
  const phone = Math.min(screen.width, screen.height) <= 500;
  const on = phone && window.innerWidth > window.innerHeight;
  document.documentElement.classList.toggle("phone-landscape", on);
  // 手机横屏按 1100px 宽的版面排、整体缩小到屏幕宽度 → 列数/密度与网页一致(body zoom 在 WKWebView 不改布局,所以改 viewport)
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute("content", on ? "width=1100, viewport-fit=cover, user-scalable=no" : "width=device-width, initial-scale=1.0, viewport-fit=cover");
};
markPhoneLandscape(); window.addEventListener("resize", markPhoneLandscape);
if (import.meta.env.VITE_APP_DEBUG) { // 测试包:左上角打印屏幕/视口尺寸与 html class(排查横屏适配)
  const el = document.createElement("div"); el.style.cssText = "position:fixed;left:4px;top:4px;z-index:9999;background:#000c;color:#0f0;font:11px monospace;padding:2px 4px;pointer-events:none";
  const upd = () => { el.textContent = `screen ${screen.width}x${screen.height} inner ${innerWidth}x${innerHeight} cls=[${document.documentElement.className}] zoom=${getComputedStyle(document.body).zoom}`; };
  upd(); setInterval(upd, 1000); document.body.appendChild(el);
} window.addEventListener("orientationchange", () => setTimeout(markPhoneLandscape, 50));

// 题目数字字体提前加载:否则第一题出现时才去下载,会先用备用字体再换(家长反馈「每题开始字体一瞬间变化」)
document.fonts?.load("700 48px 'ZHKJ Number'").catch(() => {});
document.fonts?.load("700 48px 'Baloo 2'").catch(() => {});

startVersionCheck();

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>,
);
