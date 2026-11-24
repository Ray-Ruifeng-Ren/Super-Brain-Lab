// 护眼模式 · 全局开关(2026-11-24 用户「护眼模式改成全局设置:外面的设置里放一个开关,所有项目统一生效」)
// 之前只有作业作答器(HomeworkRunner)自己有一个 hw:stageLight 开关,广场的闪/听/看、数珠互译都没有。
// 现在:一个 localStorage 键 + 订阅,所有深色舞台(作答器 / 闪电心算舞台)都读这一个值;首次读取沿用旧键的选择。
import { useSyncExternalStore } from "react";

const KEY = "ui:eyeCare";
const LEGACY_KEY = "hw:stageLight";
const listeners = new Set<() => void>();
let cached: boolean | null = null;

function read(): boolean {
  if (cached != null) return cached;
  try {
    const v = localStorage.getItem(KEY);
    if (v === "1" || v === "0") cached = v === "1";
    else cached = localStorage.getItem(LEGACY_KEY) === "1"; // 沿用旧的作答器设置
  } catch { cached = false; }
  return cached;
}
export function getEyeCare(): boolean { return read(); }
export function setEyeCare(on: boolean) {
  cached = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); localStorage.setItem(LEGACY_KEY, on ? "1" : "0"); } catch { /* noop */ }
  listeners.forEach((l) => l());
}
export const toggleEyeCare = () => setEyeCare(!read());
const subscribe = (l: () => void) => {
  listeners.add(l);
  // 另一个标签页改了也跟着变
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cached = null; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
};
/** 订阅全局护眼开关 */
export function useEyeCare(): boolean { return useSyncExternalStore(subscribe, read, () => false); }

/** 护眼(浅色)舞台背景;深色舞台背景由各处自带 */
export const EYE_CARE_STAGE_BG = "linear-gradient(180deg,#FBF5E6 0%,#EADCC0 100%)";
