// 等级鉴定徽章小标 —— 戴在用户名旁(排行榜/鉴定馆)。级绿蓝、段橙、高段金(带国际称号)。
import { levelById, levelColor, levelName } from "@/lib/cert";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function BadgeChip({ id, small = false }: { id: string; small?: boolean }) {
  const { lang } = useI18n();
  const lv = levelById(id);
  if (!lv) return null;
  const en = lang === "en";
  const color = levelColor(lv);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 rounded-full align-middle font-bold text-white", small ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]")}
      style={{ background: `linear-gradient(180deg, ${color}, ${color}CC)` }}
      title={en ? `Flash Anzan Certification · ${levelName(lv, true)}` : `闪电心算等级鉴定 · ${lv.label}`}>
      ⚡{levelName(lv, en)}
    </span>
  );
}
