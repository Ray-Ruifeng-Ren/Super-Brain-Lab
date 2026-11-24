// 仅开发环境(import.meta.env.DEV):不登录也能打开「打印试题」预览,用来调版式。生产构建不包含此路由。
import { useState } from "react";
import { PaperPreview } from "@/components/PaperPreview";
import { normalizeItem } from "@/lib/homework";

const SAMPLES = {
  mul: normalizeItem({ project: "glance", op: "mul", mulA: 2, mulB: 3, n: 60 }),
  div: normalizeItem({ project: "glance", op: "div", divD: 1, divQ: 2, divEnough: "no", n: 30 }),
  addsub: normalizeItem({ project: "glance", op: "addsub", digits: 3, digitsMax: 3, count: 10, includeSub: true, n: 16 }),
};
export default function DevPaper() {
  const [k, setK] = useState<keyof typeof SAMPLES>("mul");
  const [open, setOpen] = useState(true);
  return (
    <div className="p-6">
      {(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((x) => <button key={x} onClick={() => { setK(x); setOpen(true); }} className="mr-2 rounded border px-3 py-1">{x}</button>)}
      <PaperPreview item={SAMPLES[k]} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
