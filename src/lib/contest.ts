// 比赛系统前端接口(/contest):所有请求 POST 到 netlify/functions/contest(业务见 _contest-core.mjs)。
import { siteUrl } from "@/lib/appEnv";
import { genProblems, itemLabel, normalizeItem, type HwItem, type HwProject, type HwProblem } from "@/lib/homework";
import { supabase } from "@/integrations/supabase/client";

// 出题 / 呈现全部沿用训练系统:每个组别 × 项目的设置 = 教练布置作业用的 HwItem(题量 = item.n)+ 比赛限时分钟
export interface Group { id: string; name: string }
export interface Ev { id: string; project: HwProject; name: string }
/** item = 第 1 段难度(也是呈现设置:字体、显示方式、音色等);more = 后续难度段(2026-11-08 用户「同个项目里组合不同难度」);
 *  tiers = 慢 / 中 / 快 三档速度(2026-11-08「管理员设各档每笔间隔,考生在屏幕上自己选」):闪算 / 障碍算 / 马拉松 = 每笔毫秒,听算 = 语速档 1–10 */
export interface Cfg { item: HwItem; minutes: number; more?: HwItem[]; tiers?: number[] }
export interface Contest { id: string; title: string; venue?: string; date?: string; regDeadline?: string | null; groups: Group[]; events: Ev[]; cfg: Record<string, Record<string, Cfg>> }
export interface Reg { phone: string; name: string; group: string; events: string[]; examNo: string; school?: string; idNo?: string; age?: number; thumb?: string; hasPhoto?: boolean; at: number }
export interface State { status: "idle" | "ready" | "running" | "ended"; group?: string; event?: string; sid?: string; startAt?: number; endAt?: number }
export type Problem = HwProblem;
export interface RankRow { examNo: string; name: string; answered: number; correct: number; lastAt: number; joined: boolean; rank: number; school?: string; idNo?: string; age?: number }
export interface LiveRec { k: number; orig: number; phase: "play" | "answer"; at: number; typed: number; tier: number; lastOk?: { ok: boolean; at: number; n: number } }
export interface Ranking { sid: string; group: string; event: string; startAt?: number; endAt?: number; status: string; rows: RankRow[] }

export const STATUS_NAME: Record<State["status"], string> = { idle: "未开始", ready: "候场中", running: "比赛中", ended: "已结束" };

const DEV_ADMIN = import.meta.env.DEV && new URLSearchParams(location.search).get("preview") === "1";
export async function authToken(): Promise<string | null> {
  if (DEV_ADMIN) return "dev";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function api<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}, asOrganizer = false): Promise<T> {
  const payload: Record<string, unknown> = { action, ...body };
  if (asOrganizer) payload.authToken = await authToken();
  const r = await fetch(siteUrl("/.netlify/functions/contest"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({ error: "网络出错" }));
  if (!r.ok) throw new Error(j.error || "出错了");
  return j as T;
}

// 考生登录令牌(平板上记住)
const TK = "contest:token";
export const getToken = () => { try { return localStorage.getItem(TK); } catch { return null; } };
export const setToken = (t: string | null) => { try { if (t) localStorage.setItem(TK, t); else localStorage.removeItem(TK); } catch { /* noop */ } };

/** 服务器时间:每次轮询用响应里的 now 校正本机钟差(各平板以服务器时间统一开始 / 结束) */
let skew = 0;
export const syncClock = (serverNow: number, sentAt: number) => { const rtt = Date.now() - sentAt; skew = serverNow + rtt / 2 - Date.now(); };
export const serverNow = () => Date.now() + skew;

export const fmtClock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
/** 这个组别 × 项目的设置(没设过就按项目默认,和教练布置作业的默认一样) */
export const cfgOf = (c: Contest, g: string, e: string): Cfg => {
  const ev = c.events.find((x) => x.id === e);
  return normCfg(c.cfg?.[g]?.[e], ev?.project);
};
/** 服务器存的原始设置 → 补齐默认值(平板轮询拿到的 cfg 也走这里) */
export const normCfg = (raw: Partial<Cfg> | null | undefined, evProject?: HwProject): Cfg => {
  const project = evProject ?? raw?.item?.project ?? "flash";
  const more = (raw?.more ?? []).map((m) => normalizeItem({ ...m, project }));
  const tiers = raw?.tiers?.length === 3 && raw.tiers.every((v) => Number.isFinite(v) && v > 0) ? raw.tiers : undefined;
  return { item: normalizeItem({ ...(raw?.item ?? {}), project }), minutes: raw?.minutes ?? 5, ...(more.length ? { more } : {}), ...(tiers ? { tiers } : {}) };
};

// ===== 难度段 =====
/** 本项目的全部难度段(按顺序出题;呈现设置以第 1 段为准) */
export const segmentsOf = (c: Cfg): HwItem[] => [c.item, ...(c.more ?? [])];

// ===== 速度三档 =====
export const TIER_NAMES = ["慢", "中", "快"] as const;
export const DEFAULT_TIER = 1;
export type TierKind = "ms" | "listen";
export const tierKind = (p: HwProject): TierKind | null => (p === "flash" || p === "obstacle" || p === "scroll" ? "ms" : p === "listen" ? "listen" : null);
const r50 = (x: number) => Math.round(x / 50) * 50;
/** 没设过就按第 1 段的速度当「中」,慢 ×1.4、快 ×0.7(听算 ±2 档) */
export function defaultTiers(it: HwItem): number[] | null {
  const k = tierKind(it.project); if (!k) return null;
  if (k === "listen") return [Math.max(1, it.listenSpeed - 2), it.listenSpeed, Math.min(10, it.listenSpeed + 2)];
  const b = it.project === "scroll" ? r50((it.scrollSec * 1000) / Math.max(1, it.count)) : it.speedMs;
  return [r50(b * 1.4), b, Math.max(100, r50(b * 0.7))];
}
export const tiersOf = (c: Cfg): number[] | null => (tierKind(c.item.project) ? c.tiers ?? defaultTiers(c.item) : null);
export const tierText = (c: Cfg, t: number): string => {
  const v = tiersOf(c)?.[t]; if (v == null) return "";
  return tierKind(c.item.project) === "listen" ? `语速 ${v} 档` : `每笔 ${(v / 1000).toFixed(2).replace(/0$/, "")} 秒`;
};
/** 作答器用的设置:呈现取第 1 段;任一段带小数就给小数点键;再套上考生选的速度档(比赛中不再逐题加速) */
export function runItem(c: Cfg, tier = DEFAULT_TIER): HwItem {
  const segs = segmentsOf(c);
  const base: HwItem = { ...c.item, decimals: segs.some((s) => s.decimals) };
  const v = tiersOf(c)?.[tier];
  if (v == null) return base;
  if (base.project === "listen") return { ...base, listenSpeed: v };
  if (base.project === "scroll") return { ...base, scrollTermMs: v, scrollAccel: false };
  return { ...base, speedMs: v, scrollAccel: false };
}

/** 限时内最快档大约能做多少题(出题要够,做完了还没到点就只能干等) */
export function estimateCount(c: Cfg): number {
  const it = c.item, fast = tiersOf(c)?.[2];
  const per = it.project === "flash" || it.project === "obstacle" || it.project === "scroll" ? ((fast ?? it.speedMs) * it.count) / 1000 + 1.5
    : it.project === "listen" ? it.count * 0.45 + 1.5 : 2.5;
  return Math.min(400, Math.ceil((c.minutes * 60) / Math.max(1, per)) + 10);
}
/** 一场的题:各难度段依次出(每段按自己的题量),不够限时做的再用最后一段补足 */
export function contestProblems(c: Cfg): HwProblem[] {
  const segs = segmentsOf(c);
  const out = segs.flatMap((s, i) => genProblems(s, s.n).map((p) => ({ ...p, seg: i })));
  const need = estimateCount(c), last = segs[segs.length - 1];
  if (out.length < need) out.push(...genProblems(last, need - out.length).map((p) => ({ ...p, seg: segs.length - 1 })));
  return out.slice(0, 450);
}

export const cfgText = (c?: Cfg) => {
  if (!c) return "";
  const segs = segmentsOf(c), t = tiersOf(c);
  const body = segs.length > 1 ? segs.map((s, i) => `第${i + 1}段 ${itemLabel(s)}`).join(" → ") : itemLabel(c.item);
  return `${body} · 限时 ${c.minutes} 分钟${t ? " · 速度可选 慢/中/快" : ""}`;
};

// ===== 报名身份信息(2026-11-08 用户「要填写身份证号、照片和年龄」)=====
const W = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2], CK = "10X98765432";
/** 18 位居民身份证号校验(GB 11643 校验码 + 出生日期合法) */
export function idValid(id: string): boolean {
  const s = id.toUpperCase();
  if (!/^\d{17}[\dX]$/.test(s)) return false;
  const sum = W.reduce((a, w, i) => a + w * Number(s[i]), 0);
  if (CK[sum % 11] !== s[17]) return false;
  const y = +s.slice(6, 10), m = +s.slice(10, 12), d = +s.slice(12, 14), dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && dt.getTime() <= Date.now() && y >= 1900;
}
/** 周岁(按身份证出生日期) */
export function ageFromId(id: string, at = new Date()): number | null {
  if (!idValid(id)) return null;
  const y = +id.slice(6, 10), m = +id.slice(10, 12), d = +id.slice(12, 14);
  return at.getFullYear() - y - (at.getMonth() + 1 < m || (at.getMonth() + 1 === m && at.getDate() < d) ? 1 : 0);
}
export const maskId = (id?: string) => (id && id.length === 18 ? `${id.slice(0, 6)}********${id.slice(14)}` : id ?? "");
/** 照片压成 JPEG dataURL(长边 px 像素),报名表上传前在手机上压,省流量也省存储 */
export async function shrinkPhoto(file: File, px: number, q = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, px / Math.max(img.width, img.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", q);
  } finally { URL.revokeObjectURL(url); }
}
