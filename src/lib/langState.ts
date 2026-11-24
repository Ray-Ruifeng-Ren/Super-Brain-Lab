// 当前界面语言(非 React 代码用,如 itemLabel):LanguageProvider 每次渲染时同步。
// 组件里照旧用 useI18n();这里只给纯函数读,读到的值与界面一致(调用它的组件都订阅了语言上下文,切换时会重渲染)。
export type UiLang = "zh" | "en";
/** 没手动切换过语言时的默认值(2026-11-12 用户「非中国地区默认都是英文」):
 *  浏览器首选语言是中文、或时区在中国大陆 / 港澳台 → 中文;其他都是英文。手动切换过(localStorage.lang)以手动的为准。 */
const CN_TZ = new Set(["Asia/Shanghai", "Asia/Chongqing", "Asia/Harbin", "Asia/Urumqi", "Asia/Hong_Kong", "Asia/Macau", "Asia/Taipei", "PRC"]);
export function detectLang(): UiLang {
  try {
    const stored = window.localStorage.getItem("lang");
    if (stored === "en" || stored === "zh") return stored;
  } catch { /* noop */ }
  try {
    // 只看浏览器首选语言(列表里排后面的中文不算:海外华人电脑常带着中文,但首选是英文就该是英文)
    const primary = String(navigator.language || "").toLowerCase();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (primary.startsWith("zh") || CN_TZ.has(tz)) return "zh";
    return primary ? "en" : "zh";
  } catch { return "zh"; }
}
let cur: UiLang = typeof window !== "undefined" ? detectLang() : "zh";
export const getLang = (): UiLang => cur;
export const setCurrentLang = (l: UiLang) => { cur = l; };
