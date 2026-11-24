// 关于珠象(2026-11-08 上架用):版本号、APP 备案号、隐私政策 / 用户协议 / 注销账号入口(国内商店要求 App 内能看到备案号和政策)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IS_NATIVE } from "@/lib/appEnv";
import { LEGAL } from "@/lib/legal";

export default function AboutApp() {
  const [ver, setVer] = useState("");
  useEffect(() => {
    if (IS_NATIVE) import("@capacitor/app").then(({ App }) => App.getInfo()).then((i) => setVer(`${i.version} (${i.build})`)).catch(() => {});
    else fetch("/version.json").then((r) => r.json()).then((j) => setVer(`web ${j.build}`)).catch(() => {});
  }, []);
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-6 py-12 text-center text-foreground">
      <img src="/logo-emblem.png?v=2" alt="" className="h-20" />
      <h1 className="mt-3 text-3xl font-black">珠象</h1>
      <p className="mt-1 text-sm text-muted-foreground">珠心算智能训练平台 · 以珠为象,以象为算</p>
      {ver && <p className="mt-4 font-mono text-xs text-muted-foreground">版本 {ver}</p>}
      <div className="mt-8 w-full max-w-sm divide-y divide-border rounded-2xl border border-border text-left text-sm">
        <Link to="/privacy" className="flex justify-between px-4 py-3"><span>隐私政策</span><span className="text-muted-foreground">›</span></Link>
        <Link to="/terms" className="flex justify-between px-4 py-3"><span>用户协议</span><span className="text-muted-foreground">›</span></Link>
        <Link to="/account/delete" className="flex justify-between px-4 py-3"><span>注销账号</span><span className="text-muted-foreground">›</span></Link>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">{LEGAL.operator}<br />APP 备案号:{LEGAL.icp}</p>
      <Link to="/" className="mt-6 text-sm text-primary underline">返回首页</Link>
    </div>
  );
}
