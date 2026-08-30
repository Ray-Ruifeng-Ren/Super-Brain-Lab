// 榜单纯逻辑(无副作用,便于单测):日期分组、连续天数、名次(支持并列)。

/** 把 ISO 时间转成本地「年-月-日」键。 */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const keyOfDate = (dt: Date) => `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;

/**
 * 连续练习天数:从今天(若今天没练则从昨天)往前数,直到断档。
 * today 可注入,便于测试;默认取当前时间。
 */
export function streakFromDays(days: Set<string>, today: Date = new Date()): number {
  const cur = new Date(today);
  cur.setHours(0, 0, 0, 0);
  if (!days.has(keyOfDate(cur))) cur.setDate(cur.getDate() - 1);
  let s = 0;
  while (days.has(keyOfDate(cur))) { s += 1; cur.setDate(cur.getDate() - 1); }
  return s;
}

/** 排序 + 截断 + 名次(并列同名次:1,2,2,4)。keyOf 相等即并列。 */
export function rankBy<T>(
  rows: T[],
  cmp: (a: T, b: T) => number,
  keyOf: (x: T) => number,
  limit: number,
): (T & { rank: number })[] {
  const sorted = [...rows].sort(cmp).slice(0, limit);
  let lastKey = NaN, lastRank = 0;
  return sorted.map((x, i) => {
    const k = keyOf(x);
    const rank = i > 0 && k === lastKey ? lastRank : i + 1;
    lastKey = k; lastRank = rank;
    return { ...x, rank };
  });
}
