// /contest 比赛系统首页:四个阶段 + 入口
import { Link } from "react-router-dom";
import { ClipboardList, Dumbbell, Trophy, Monitor, Tablet, Settings2 } from "lucide-react";
import { Shell, Card } from "./ui";

const STAGES = [
  { icon: ClipboardList, n: "① 报名", items: ["扫码报名(每场一个二维码)", "填写姓名 · 组别 · 项目 · 手机号", "自动生成考号 + 初始密码"] },
  { icon: Dumbbell, n: "② 赛前训练", items: ["平板登录,账号即手机号", "只显示自己报名的项目", "按组别出题,速度可调"] },
  { icon: Trophy, n: "③ 赛场比赛", items: ["后台切换场次,按考号入座", "统一开始:全部平板同时开始", "服务端统一计时,到点自动锁定"] },
  { icon: Monitor, n: "④ 出分交付", items: ["平板显示做题数 · 正确数", "大屏实时排名", "按组别 × 项目导出排名表"] },
];

export default function ContestHome() {
  return (
    <Shell title="珠象比赛系统" sub="后台统一控制:同组同项目所有平板同时开始、同时结束" wide>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/contest/me" className="group"><Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-md">
          <Tablet className="h-8 w-8 text-[#9c7a2e]" /><h2 className="mt-2 text-xl font-black">考生登录</h2>
          <p className="mt-1 text-sm text-[#7a6a52]">平板 / 手机:赛前训练、进入赛场</p></Card></Link>
        <Link to="/contest/admin" className="group"><Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-md">
          <Settings2 className="h-8 w-8 text-[#9c7a2e]" /><h2 className="mt-2 text-xl font-black">组织者后台</h2>
          <p className="mt-1 text-sm text-[#7a6a52]">建比赛、报名二维码、切换场次、统一开始 / 结束、导出成绩</p></Card></Link>
        <Card className="h-full bg-[#2B1A08]/95 text-[#F6E7C1]">
          <Monitor className="h-8 w-8 text-[#E8CC8A]" /><h2 className="mt-2 text-xl font-black text-[#FBF5E6]">大屏排名</h2>
          <p className="mt-1 text-sm text-[#D9C69E]">在后台打开「大屏」投到 LED 主控屏,实时显示本场排名</p></Card>
      </div>
      <h2 className="mb-3 mt-8 text-base font-black text-[#7a5520]">全流程</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        {STAGES.map(({ icon: I, n, items }) => (
          <Card key={n} className="p-4">
            <div className="flex items-center gap-2"><I className="h-5 w-5 text-[#9c7a2e]" /><b className="text-base">{n}</b></div>
            <ul className="mt-2 space-y-1.5 text-sm text-[#5c4a30]">{items.map((x) => <li key={x} className="flex gap-1.5"><span className="text-[#c9a24a]">·</span>{x}</li>)}</ul>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
