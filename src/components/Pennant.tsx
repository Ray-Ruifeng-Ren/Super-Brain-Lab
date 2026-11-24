// 锦旗 / 学院旗(2026-10-13 哈利波特风):挂杆 + 燕尾下摆 + 金线包边,hover 轻轻摆动。
// 用于首页顶部(锦标赛 / 教练端 / 我的作业)与教练端项目选择。
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function Pennant({ color, to, onClick, children, size = "md", className = "" }: {
  color: string; to?: string; onClick?: () => void; children: ReactNode; size?: "md" | "lg"; className?: string;
}) {
  const inner = (
    <div className={`pennant pennant-${size} ${className}`}>
      <div className="pennant-rod" />
      <div className="pennant-cloth" style={{ background: `linear-gradient(180deg, ${color} 0%, ${color} 70%, #000 190%)` }}>
        <div className="pennant-trim" />
        <div className="pennant-body">{children}</div>
      </div>
    </div>
  );
  if (to) return <Link to={to} className="block" aria-label="pennant">{inner}</Link>;
  return <button type="button" onClick={onClick} className="block">{inner}</button>;
}
