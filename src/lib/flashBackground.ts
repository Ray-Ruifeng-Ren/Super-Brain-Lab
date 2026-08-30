// 闪电心算页面背景选择:用户可从项目里的多段视频中挑一个作为动态背景。
// 选择保存在本设备(localStorage),并通过自定义事件通知全局背景组件即时切换。

// hue:该背景对应的鼠标光标粒子色相(HSL 色相,大致贴合视频主色调)
// transform:视频取景(放大 + 右移),让角色清晰落在右侧空白区(面板在左侧 ~64%)
export interface BgOption { id: string; label: string; url: string; emoji: string; hue: number; transform?: string }

// public/ 下的中文文件名需 URL 编码后再作为路径
const pub = (name: string) => `/${encodeURIComponent(name)}`;
// 角色类视频统一取景:放大一点、往右挪一点,让角色露在右侧空白带里
const CHAR_FIT = "scale(1.4) translateX(18%)";

// "calm" = 安静默认:不放视频,练习页保持干净专注(专业感);热闹视频作为可选项。
export const CALM_BG = "calm";

export const FLASH_BG_OPTIONS: BgOption[] = [
  { id: "calm", label: "安静", url: CALM_BG, emoji: "🌙", hue: 38 },                  // 默认:无视频、极简
  { id: "spark", label: "火花", url: "/flash-bg.mp4", emoji: "🔥", hue: 34 },       // 暖金/橙(已预先右移取景)
  { id: "valley", label: "山谷", url: "/hero-cinematic.mp4", emoji: "🏞️", hue: 130 }, // 绿(风景,保持全景)
  { id: "cat", label: "喵喵", url: pub("喵喵.mp4"), emoji: "🐱", hue: 22, transform: CHAR_FIT },
  { id: "frog", label: "上岸蛙", url: pub("上岸蛙.mp4"), emoji: "🐸", hue: 110, transform: CHAR_FIT },
  { id: "rabbit", label: "春兔", url: pub("春兔.mp4"), emoji: "🐰", hue: 332, transform: CHAR_FIT },
  { id: "water", label: "水蓝蓝", url: pub("水蓝蓝.mp4"), emoji: "🌊", hue: 205, transform: CHAR_FIT },
  { id: "shark", label: "彩蝶鲨", url: pub("彩蝶鲨.mp4"), emoji: "🦈", hue: 186, transform: CHAR_FIT },
  { id: "mecha", label: "机甲小子", url: pub("机甲小子.mp4"), emoji: "🤖", hue: 214, transform: CHAR_FIT },
  { id: "dimo", label: "迪莫", url: pub("迪莫.mp4"), emoji: "🐲", hue: 192, transform: CHAR_FIT },
  { id: "abu", label: "阿布", url: pub("阿布.mp4"), emoji: "✨", hue: 280, transform: CHAR_FIT },
];

export const DEFAULT_FLASH_HUE = 38; // 默认暖金

/** 当前所选背景对应的光标粒子色相(用于让鼠标光效随背景变调)。 */
export function getFlashBgHue(): number {
  const url = getFlashBg();
  return FLASH_BG_OPTIONS.find((o) => o.url === url)?.hue ?? DEFAULT_FLASH_HUE;
}

/** 当前所选背景的视频取景 transform(放大+右移,让角色清晰);无则 undefined。 */
export function getFlashBgTransform(): string | undefined {
  const url = getFlashBg();
  return FLASH_BG_OPTIONS.find((o) => o.url === url)?.transform;
}

export const DEFAULT_FLASH_BG = CALM_BG; // 默认安静(无视频)
const KEY = "flash:bg";
export const FLASH_BG_EVENT = "flashbg:change";

export function getFlashBg(): string {
  if (typeof window === "undefined") return DEFAULT_FLASH_BG;
  try {
    const v = window.localStorage.getItem(KEY);
    // 仅接受已知选项,避免旧数据/无效路径
    if (v && FLASH_BG_OPTIONS.some((o) => o.url === v)) return v;
  } catch { /* noop */ }
  return DEFAULT_FLASH_BG;
}

export function setFlashBg(url: string): void {
  try { window.localStorage.setItem(KEY, url); } catch { /* noop */ }
  try { window.dispatchEvent(new CustomEvent(FLASH_BG_EVENT, { detail: url })); } catch { /* noop */ }
}
