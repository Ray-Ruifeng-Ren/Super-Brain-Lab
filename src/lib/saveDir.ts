// 下载免弹窗(2026-10-27 付海东视频:每次点下载都弹 Windows「另存为」选文件夹,问能不能点了直接下载)。
// 「另存为」是浏览器设置「下载前询问保存位置」打开导致的,网页关不掉;但电脑版 Edge / Chrome 支持
// File System Access:用户第一次选一个文件夹(默认「下载」)授权后,之后每次直接把 PDF / Excel 写进这个文件夹,不再弹窗。
// 文件夹句柄存在 IndexedDB(浏览器重启后还记得;Chrome 可能每次重新打开网站时问一次「允许编辑文件」)。
// Safari / 火狐 / 手机 / App 不支持 → 返回 null,照旧走浏览器下载。

type Perm = "granted" | "denied" | "prompt";
interface DirHandle {
  name: string;
  queryPermission(o: { mode: "readwrite" }): Promise<Perm>;
  requestPermission(o: { mode: "readwrite" }): Promise<Perm>;
  getFileHandle(name: string, o: { create: boolean }): Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;
  entries?(): AsyncIterableIterator<[string, { kind: "file" | "directory"; getFile?(): Promise<File> }]>;
  removeEntry?(name: string): Promise<void>;
}
type Picker = (o: { id?: string; mode?: "readwrite"; startIn?: string }) => Promise<DirHandle>;

const DECLINED = "sbl:saveDir:declined";
let cached: DirHandle | null | undefined; // undefined = 还没从 IndexedDB 读过

export function canPickDir(): boolean {
  if (typeof window === "undefined" || !("showDirectoryPicker" in window)) return false;
  if ((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) return false;
  return !/Mobi|Android|iPad|iPhone/i.test(navigator.userAgent);
}

function idb(): Promise<IDBDatabase> {
  return new Promise((ok, bad) => {
    const r = indexedDB.open("sbl-save", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
}
async function idbGet(): Promise<DirHandle | null> {
  try {
    const db = await idb();
    return await new Promise((ok) => { const q = db.transaction("kv").objectStore("kv").get("dir"); q.onsuccess = () => ok((q.result as DirHandle) ?? null); q.onerror = () => ok(null); });
  } catch { return null; }
}
async function idbSet(h: DirHandle | null): Promise<void> {
  try {
    const db = await idb();
    await new Promise<void>((ok) => { const tx = db.transaction("kv", "readwrite"); const st = tx.objectStore("kv"); if (h) st.put(h, "dir"); else st.delete("dir"); tx.oncomplete = () => ok(); tx.onerror = () => ok(); });
  } catch { /* 记不住就下次再选 */ }
}
// 页面加载时先把句柄读进内存:点击下载时少一次异步,请求权限还在用户点击的有效期内
if (canPickDir()) void idbGet().then((h) => { if (cached === undefined) cached = h; });

/** 当前保存文件夹名(没有 = null) */
export async function savedDirName(): Promise<string | null> {
  if (!canPickDir()) return null;
  if (cached === undefined) cached = await idbGet();
  return cached?.name ?? null;
}

/** 点击下载时**最先**调用(要在用户点击的手势里):拿到可写的文件夹;
 *  第一次(或 pick=true「更改」)弹一次文件夹选择;用户取消 / 不支持 / 没授权 → null(走浏览器下载) */
export async function prepareSaveDir(pick = false): Promise<DirHandle | null> {
  if (!canPickDir()) return null;
  if (cached === undefined) cached = await idbGet();
  if (!pick && cached) {
    try {
      if ((await cached.queryPermission({ mode: "readwrite" })) === "granted") return cached;
      if ((await cached.requestPermission({ mode: "readwrite" })) === "granted") return cached;
    } catch { /* 文件夹被删 / 浏览器拒绝 → 走下载 */ }
    return null;
  }
  if (!pick) { try { if (localStorage.getItem(DECLINED) === "1") return null; } catch { /* noop */ } }
  try {
    const h = await (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker({ id: "sbl-papers", mode: "readwrite", startIn: "downloads" });
    cached = h; await idbSet(h);
    try { localStorage.removeItem(DECLINED); } catch { /* noop */ }
    return h;
  } catch {
    // 第一次弹出时点了取消:记下来,以后不再主动弹,照旧浏览器下载(预览底部「保存到…」可以再选)
    if (!pick) { try { localStorage.setItem(DECLINED, "1"); } catch { /* noop */ } }
    return null;
  }
}

/** 写进文件夹;同名文件覆盖(文件名带时间到分钟,一般不会重名) */
export async function writeToDir(dir: DirHandle, blob: Blob, filename: string): Promise<void> {
  const fh = await dir.getFileHandle(filename.replace(/[\\/:*?"<>|]/g, "_"), { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  void cleanupBrowserTemp(dir, blob.size);
}

// 2026-11-04 付海东「下载下来之后怎么多了一个文件」:Windows 上 Chrome / Edge 直接写文件夹时先写一个 GUID 名的临时文件
// (3d396442-eed7-44db-8314-399f2f396bad.tmp 这种)再改名,部分电脑会把临时文件留在文件夹里。
// 写完后只清掉同时满足以下条件的:名字是 GUID(.tmp / .crswap / 无扩展名)、2 分钟内产生、大小和刚写的文件完全一样 —— 即本次保存的残留副本;别的文件一律不碰。
const GUID_TMP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.tmp|\.crswap)?$/i;
async function cleanupBrowserTemp(dir: DirHandle, size: number): Promise<void> {
  if (!dir.entries || !dir.removeEntry) return;
  try {
    await new Promise((r) => setTimeout(r, 1500)); // 等浏览器改名 / 杀毒扫描结束
    const now = Date.now();
    for await (const [name, h] of dir.entries()) {
      if (h.kind !== "file" || !GUID_TMP.test(name) || !h.getFile) continue;
      const f = await h.getFile();
      if (f.size === size && now - f.lastModified < 120_000) await dir.removeEntry(name).catch(() => {});
    }
  } catch { /* 没权限 / 不支持:不影响保存 */ }
}

export type { DirHandle };
