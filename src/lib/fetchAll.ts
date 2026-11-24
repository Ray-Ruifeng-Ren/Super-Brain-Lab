// 翻页取全(2026-11-02 老师「学生做了作业,后台看不到」:一位教练 1022 份作业,只取最新 300 份 → 2260 条成绩看不到)。
// PostgREST 单次最多返回 1000 行,.limit(2000) 也只给 1000 且不报错。凡是「一个教练/全站的全部记录」都走这里,不要再写死 limit。
type PageResult = PromiseLike<{ data: unknown; error?: unknown }>;
const PAGE = 1000;
/** 重试后仍读失败时置 true:页面要明确提示老师,不能把缺了一块的数据当完整的显示 */
export const fetchHealth = { failed: false };

/** build(from, to) 里必须带稳定排序(.order("created_at").order("id")):同一批发布的记录时间戳相同,没有 id 兜底翻页会漏行 / 重行 */
export async function fetchAllRows<T>(build: (from: number, to: number) => PageResult, max = 100_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    let r = await build(from, from + PAGE - 1);
    for (let k = 1; r.error && k < 3; k++) { await new Promise((ok) => setTimeout(ok, 400 * k)); r = await build(from, from + PAGE - 1); } // 网络抖动重试,共 3 次
    if (r.error) { console.warn("fetchAllRows", r.error); fetchHealth.failed = true; break; }
    const rows = (r.data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** in(...) 列表分批(一批 100 个 id,URL 不超长),6 路并发;结果按批次顺序拼接 */
export async function forChunks<R>(ids: string[], run: (chunk: string[]) => Promise<R[]>, size = 100, parallel = 6): Promise<R[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  const results: R[][] = new Array(chunks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(parallel, chunks.length) }, async () => {
    while (next < chunks.length) { const i = next++; results[i] = await run(chunks[i]); }
  }));
  return results.flat();
}
