// App 壳(Capacitor)运行环境:网页版所有接口/语音库都用相对路径,打进 iOS/Android 壳后页面从 capacitor://localhost 起,
// 相对路径会指向包内(词块库 230MB 不随包分发),所以原生壳里把它们指到线上站点。网页版不受影响(ORIGIN 为空)。
// 不 import @capacitor/core:原生壳会把 window.Capacitor 注进来,网页版没有。
declare global {
  interface Window { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }
}

export const IS_NATIVE: boolean = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() === true;
export const NATIVE_PLATFORM: string = (typeof window !== "undefined" && window.Capacitor?.getPlatform?.()) || "web";
/** 原生壳里 = 线上站点源(可用 VITE_APP_ORIGIN 覆盖,如指向预览站);网页版 = "" */
export const ORIGIN: string = IS_NATIVE ? ((import.meta.env.VITE_APP_ORIGIN as string | undefined) || "https://superbrainlab.org") : "";
/** 把站内相对路径(/.netlify/functions/x、/tts-bank6/…)变成壳里可用的绝对地址 */
export const siteUrl = (path: string): string => (ORIGIN && path.startsWith("/") ? ORIGIN + path : path);

/** 触屏设备(平板/手机):作答框不弹系统键盘(页面自带数字键盘;2026-10-17 布施「每次题目开始都要手动隐藏系统键盘,否则数字很小」);
 *  电脑/实体键盘照常。inputMode="none" 仍可聚焦、有光标,只是不唤起软键盘。 */
export const IS_TOUCH: boolean = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
export const softKey = (mode: "numeric" | "decimal" | "text"): "none" | "numeric" | "decimal" | "text" => (IS_TOUCH ? "none" : mode);
