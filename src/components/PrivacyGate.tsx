// App 首次启动隐私同意弹窗(2026-11-08 上架必需:国内商店要求「首次启动先弹隐私政策,同意后才收集信息」)。
// 只在 App 内(IS_NATIVE)且 legal.LEGAL_READY 时出现;同意记在本机(privacy:agreed:<版本>);不同意 → 再确认一次 → 退出 App。
import { useState } from "react";
import { Link } from "react-router-dom";
import { IS_NATIVE } from "@/lib/appEnv";
import { LEGAL, LEGAL_READY } from "@/lib/legal";

const KEY = `privacy:agreed:${LEGAL.version}`;
const agreed = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

export function PrivacyGate() {
  const [show, setShow] = useState(() => IS_NATIVE && LEGAL_READY && !agreed());
  const [second, setSecond] = useState(false);
  if (!show) return null;
  const accept = () => { try { localStorage.setItem(KEY, "1"); } catch { /* noop */ } setShow(false); };
  const quit = () => { void import("@capacitor/app").then(({ App }) => App.exitApp()).catch(() => {}); };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-5">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 text-foreground shadow-2xl">
        <h2 className="text-center text-lg font-black">{second ? "温馨提示" : "欢迎使用珠象"}</h2>
        {second ? (
          <p className="mt-3 text-sm leading-relaxed text-foreground/85">需要同意《隐私政策》和《用户协议》后才能使用珠象。如果不同意,将退出应用。</p>
        ) : (
          <div className="mt-3 max-h-[46vh] space-y-2 overflow-y-auto text-sm leading-relaxed text-foreground/85">
            <p>在使用前,请您(未满 14 周岁请由监护人)仔细阅读<Link to="/privacy" className="text-primary underline">《隐私政策》</Link>和<Link to="/terms" className="text-primary underline">《用户协议》</Link>。我们会:</p>
            <p>• 收集账号(邮箱、昵称)和训练数据,用于记录进度、作业和排行榜;</p>
            <p>• 仅在您报名比赛时收集姓名、手机号、身份证号、照片,用于报名审核和身份核对;</p>
            <p>• 只申请网络权限,不收集通讯录、位置、设备标识,不投放广告;</p>
            <p>• 账号与训练数据存储在境外服务器(美国),传输全程加密;</p>
            <p>• 您可随时在「账号菜单 → 注销账号」删除账号和数据。</p>
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={second ? quit : () => setSecond(true)} className="h-11 rounded-full border border-border text-sm text-muted-foreground">{second ? "退出应用" : "不同意"}</button>
          <button onClick={accept} className="h-11 rounded-full bg-primary text-sm font-bold text-primary-foreground">同意并继续</button>
        </div>
      </div>
    </div>
  );
}
