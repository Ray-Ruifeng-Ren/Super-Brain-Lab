// 扫码看答案(2026-10-25):打印试题右上角二维码 → /key/<id>(或 /key#<编码>)。不用登录,教练和学生都能看。
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { answerGroups, loadPaperKey, type PaperKey } from "@/lib/paper";
import { cn } from "@/lib/utils";

const AnswerKey = () => {
  const { id } = useParams();
  const [key, setKey] = useState<(PaperKey & { createdAt?: string }) | null | undefined>(undefined);
  const [showExpr, setShowExpr] = useState(false);
  useEffect(() => { let on = true; void loadPaperKey(id, window.location.hash).then((k) => on && setKey(k)); return () => { on = false; }; }, [id]);

  return (
    <div className="min-h-screen bg-[#f6efe2] px-4 py-6 text-[#2b2116]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 text-xs tracking-[0.2em] text-[#8a6d45]">珠象 · 答案</div>
        {key === undefined && <div className="py-20 text-center text-sm text-[#8a6d45]">加载中…</div>}
        {key === null && <div className="py-20 text-center text-sm text-[#8a6d45]">没找到这份试题的答案,链接可能不完整。</div>}
        {key && (
          <>
            <h1 className="text-2xl font-black">{key.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8a6d45]">
              {key.label && <span>{key.label}</span>}
              {key.createdAt && <span>{new Date(key.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 出题</span>}
              <span>共 {key.answers.length} 题</span>
              {key.exprs.length > 0 && (
                <button onClick={() => setShowExpr((v) => !v)} className="rounded-full border border-[#c9ad7f] px-2.5 py-0.5 text-[#6b4f2a]">{showExpr ? "只看答案" : "显示算式"}</button>
              )}
            </div>
            {answerGroups(key.answers.length, key.labels, key.kind).map((g, gi, all) => {
              const cell = (i: number) => (
                <div key={i} className={cn("flex items-baseline gap-2 rounded-lg border border-[#e2d2b3] bg-white/70 px-3 py-2", g.vertical && "mb-1.5 break-inside-avoid")}>
                  <span className="w-12 shrink-0 text-xs text-[#8a6d45]">{key.labels?.[i] ?? (key.kind === "addsub" ? `(${i + 1})` : `${i + 1}.`)}</span>
                  {showExpr && key.exprs[i] && <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#6b5a44]">{key.exprs[i]} =</span>}
                  <span className="ml-auto whitespace-nowrap font-mono text-lg font-bold tabular-nums">{key.answers[i]}</span>
                </div>
              );
              return (
                <section key={gi} className="mt-4">
                  {all.length > 1 && <h2 className="mb-1.5 text-sm font-bold text-[#6b4f2a]">{g.title}</h2>}
                  {g.vertical
                    // 乘除:和试卷一样竖着排(浏览器分栏自动从上到下、再到下一栏);世界比赛 120 题卷电脑上 4 栏(试卷 4 栏 × 30 行);省纸的 70、80 题试卷仍是 2 栏
                    ? <div className={cn("gap-1.5", showExpr ? "columns-1 sm:columns-2" : g.idx.length > 80 ? "columns-2 sm:columns-4" : g.idx.length <= 12 ? "columns-1 sm:w-1/2" : "columns-2")}>{g.idx.map(cell)}</div>
                    : <div className={showExpr ? "grid grid-cols-1 gap-1.5 sm:grid-cols-2" : "grid grid-cols-2 gap-1.5 sm:grid-cols-4"}>{g.idx.map(cell)}</div>}
                </section>
              );
            })}
            <p className="mt-6 text-center text-[11px] text-[#a08a68]">余数题写作「商……余数」;小数题按保留位数四舍五入</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AnswerKey;
