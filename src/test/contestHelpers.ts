// 比赛测试用:训练系统同款出题(homework.genProblems)
import { genProblems as gen, normalizeItem, DEFAULT_ITEM, type HwItem } from "@/lib/homework";
export const newItemForTest = (): HwItem => normalizeItem({ ...DEFAULT_ITEM, project: "flash", n: 30, count: 5, digits: 2, digitsMax: 2, includeSub: true });
export const genProblems = (it: HwItem, n: number) => gen(it, n);
