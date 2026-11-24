// 珠象官网页框(2026-11-05 第五版:用户「一定是学院风,哈利波特魔法学院的感觉;比例再小一点;自己思考,不是回退」):
// 羊皮纸底 + 雕版罗盘纹 + 金线;罗马碑刻体 Cinzel 小标 + 宋体标题;产品视频做成「会动的画像」(金框 + 铜铭牌);
// 六大系统用学院旗(与主站一致);体验 AI 放在墨褐皮面舞台里。字号克制:H1 40、H2 26、正文 15。
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

// 官网中英文(2026-11-12 用户「/home 右上角增加一个中英文切换」):与产品共用同一个语言状态(切了官网,进平台也是同一语言)
export function useL() {
  const { lang } = useI18n();
  return function L<T>(zh: T, en: T): T { return lang === "en" ? en : zh; };
}
/** 右上角「中 / EN」:学院风的小金字按钮 */
export function SiteLangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const b = (on: boolean) => cn("px-2 py-0.5 text-[12px] transition-colors", on ? "text-[var(--accent)] font-bold" : "text-[var(--muted)] hover:text-[var(--ink)]");
  return (
    <div className={cn("flex items-center rounded-full border border-[var(--line-strong)] px-1", className)} role="group" aria-label="Language">
      <button onClick={() => setLang("zh")} className={b(lang === "zh")} aria-pressed={lang === "zh"}>中</button>
      <span className="text-[10px] text-[var(--line-strong)]">|</span>
      <button onClick={() => setLang("en")} className={cn(b(lang === "en"), "cinzel !tracking-[0.1em]")} aria-pressed={lang === "en"}>EN</button>
    </div>
  );
}

export const NAV = [
  { to: "/home", label: "首页", en: "Home", end: true },
  { to: "/overview", label: "系统", en: "Systems" },
  { to: "/home/pricing", label: "价格", en: "Pricing" },
  { to: "/home/about", label: "关于", en: "About" },
];

const ROSE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1200'%3E%3Cg fill='none' stroke='%237A5A2A' stroke-width='1.2'%3E%3Ccircle cx='600' cy='600' r='540'/%3E%3Ccircle cx='600' cy='600' r='500'/%3E%3Ccircle cx='600' cy='600' r='330'/%3E%3Ccircle cx='600' cy='600' r='160'/%3E%3Cpath d='M60 600h1080M600 60v1080M218 218l764 764M982 218L218 982'/%3E%3Cpath d='M600 400l28 172 172 28-172 28-28 172-28-172-172-28 172-28z' fill='%237A5A2A' fill-opacity='.3'/%3E%3C/g%3E%3C/svg%3E\")";

const CSS = `
.zx{--bg:#F4EAD5;--surface:#FFFAEE;--panel:#FBF3E1;--ink:#2B1A08;--muted:#6B5A45;--line:rgba(122,90,42,.2);--line-strong:rgba(122,90,42,.45);--accent:#7A1F2B;--gold:#9C7A2E;--brass:#9C7A2E;
  color:var(--ink);font-family:'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif;font-size:15px;line-height:1.8;
  background:radial-gradient(120% 55% at 50% 0%,rgba(255,250,236,.9) 0%,rgba(244,234,213,0) 65%),linear-gradient(180deg,#F6EDD8 0%,#EFE2C6 55%,#E8D6B2 100%)}
.zx::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.35;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.38 0 0 0 0 0.25 0 0 0 .14 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
@font-face{font-family:Cinzel;font-style:normal;font-weight:400 900;font-display:swap;src:url('/fonts/cinzel-latin.woff2') format('woff2')}
.zx .serif{font-family:'Source Han Serif SC','Noto Serif SC','Songti SC','STSong',serif;font-weight:700;letter-spacing:.04em}
.zx .cinzel{font-family:Cinzel,'Trajan Pro',Georgia,serif;letter-spacing:.28em;text-transform:uppercase}
.zx .num{font-family:Cinzel,Georgia,serif;font-variant-numeric:lining-nums}
.zx .eyebrow{font-family:Cinzel,Georgia,serif;font-size:11.5px;letter-spacing:.3em;color:var(--gold)}
.zx .eyebrow b{color:var(--accent);font-weight:700;margin-right:.7em}
.zx .lnk{color:var(--accent);border-bottom:1px solid currentColor;padding-bottom:1px}
.zx .lnk:hover{opacity:.8}
.zx .btn{display:inline-flex;align-items:center;gap:.5em;border-radius:999px;padding:9px 22px;font-size:14px;font-weight:600;letter-spacing:.1em;color:#F3DCA0;background:linear-gradient(180deg,#86283A,#5A1520);border:1px solid #C9A24A;box-shadow:0 6px 16px rgba(90,21,32,.22),inset 0 1px 0 rgba(255,255,255,.15);transition:filter .2s}
.zx .btn:hover{filter:brightness(1.1)}
.zx .orn{display:flex;align-items:center;gap:14px;color:var(--gold)}
.zx .orn i{height:1px;flex:1;max-width:110px;background:linear-gradient(90deg,transparent,var(--gold))}
.zx .orn i:last-child{background:linear-gradient(90deg,var(--gold),transparent)}
.zx .card{position:relative;background:linear-gradient(180deg,#FFFAEE,#F8EEDA);border:1px solid var(--line-strong);border-radius:4px;box-shadow:0 10px 26px -14px rgba(90,60,20,.35)}
.zx .card::before{content:"";position:absolute;inset:4px;border:1px solid var(--line);pointer-events:none}
.zx .portrait{position:relative;padding:14px;background:linear-gradient(135deg,#D9B776,#9C7A2E 45%,#E8CC8A 70%,#8A6A22);border-radius:3px;box-shadow:0 26px 50px -18px rgba(60,36,12,.55),inset 0 0 0 1px rgba(255,255,255,.25)}
.zx .portrait::before{content:"";position:absolute;inset:6px;border:1px solid rgba(60,36,12,.45);pointer-events:none}
.zx .portrait video{position:relative;display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#1c1108;box-shadow:inset 0 0 0 1px rgba(0,0,0,.4)}
.zx .plaque{display:inline-block;margin-top:14px;padding:4px 16px;font-size:12px;letter-spacing:.2em;color:#3A2410;background:linear-gradient(180deg,#E8CC8A,#B8933F);border:1px solid #8A6A22;border-radius:2px;box-shadow:0 2px 4px rgba(60,36,12,.25)}
.zx .rose{position:absolute;pointer-events:none;opacity:.09;background-image:${ROSE};background-size:contain;background-repeat:no-repeat}
.zx .stage{--surface:#2E2219;--panel:#241A13;--ink:#F3E6CC;--muted:#B9A68C;--line:rgba(217,183,118,.18);--line-strong:rgba(217,183,118,.4);--accent:#D9B776;--bg:#1C130D;
  position:relative;color:var(--ink);background:radial-gradient(120% 100% at 30% 0%,#4A3016 0%,#2B1A08 55%,#1C1106 100%);border:1px solid #1C1106;border-radius:6px;box-shadow:0 30px 60px -20px rgba(43,26,8,.55)}
.zx .stage::before{content:"";position:absolute;inset:10px;border:1px solid rgba(217,183,118,.4);border-radius:3px;pointer-events:none}
.zx .stage .eyebrow{color:#C9A24A}
.zx .letter{position:relative;background:linear-gradient(180deg,#FFFBF0,#F6EAD0);border:1px solid var(--line-strong);border-radius:3px;box-shadow:0 30px 60px -24px rgba(90,60,20,.45),0 2px 0 #fff inset}
.zx .letter::before{content:"";position:absolute;inset:10px;border:1px solid var(--line-strong);pointer-events:none}
.zx .letter::after{content:"";position:absolute;inset:15px;border:1px solid var(--line);pointer-events:none}
.zx .seal{position:absolute;left:50%;top:-34px;width:68px;height:68px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle at 35% 30%,#A8323F,#7A1F2B 55%,#4E121B);box-shadow:0 6px 14px rgba(78,18,27,.4),inset 0 -3px 6px rgba(0,0,0,.25),inset 0 2px 3px rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;z-index:2}
.zx .seal::before{content:"";position:absolute;inset:6px;border-radius:50%;border:1.5px dashed rgba(243,220,160,.45)}
.zx .seal img{width:38px;height:38px;object-fit:contain;filter:sepia(1) saturate(2) hue-rotate(-10deg) brightness(1.15);opacity:.9}
@media (prefers-reduced-motion:no-preference){.zx .fade{animation:zxf .6s ease-out both}}
@keyframes zxf{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;

/** 「联系合作」:弹窗显示珠象首席教练微信二维码 */
export const openContact = () => window.dispatchEvent(new Event("zx:contact"));
function ContactModal() {
  const L = useL();
  const [show, setShow] = useState(false);
  useEffect(() => { const f = () => setShow(true); window.addEventListener("zx:contact", f); return () => window.removeEventListener("zx:contact", f); }, []);
  useEffect(() => { if (!show) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setShow(false); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [show]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2B1A08]/50 p-5" onClick={() => setShow(false)}>
      <div className="card fade w-full max-w-[330px] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setShow(false)} className="absolute right-3 top-3 z-10 text-[var(--muted)] hover:text-[var(--ink)]" aria-label="关闭"><X className="h-4 w-4" /></button>
        <p className="eyebrow relative">Contact</p>
        <h3 className="serif relative mt-2 text-[20px]">{L("扫码联系珠象首席教练", "Scan to reach our Head Coach")}</h3>
        <p className="relative mt-1 text-[13px] text-[var(--muted)]">{L("学校、机构、赛事合作,微信直接沟通", "Schools, centers and competitions — chat directly on WeChat")}</p>
        <div className="portrait mx-auto mt-6 w-48 !p-2"><img src="/site/wx-gzh.png" alt="珠象首席教练微信二维码" className="relative block w-full bg-white" /></div>
      </div>
    </div>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  // 2026-11-24 字体本地托管:Cinzel(可变字重,latin)放 public/fonts;Noto Serif SC 不再从 Google 取(国内被拦),标题走系统宋体(Songti / 思源宋体)
  return (
    <div className="zx relative min-h-screen [overflow-x:clip]">
      <style>{CSS}</style>
      <header className="relative z-20">
        <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-6">
          <Link to="/home" className="flex items-center gap-1"><img src="/logo-emblem.png?v=2" alt="" className="h-9 w-auto" /><img src="/logo-text.png?v=2" alt="珠象 ZHUXIANG" className="h-9 w-auto" /></Link>
          <nav className="hidden items-center gap-8 text-[14px] md:flex">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn("serif !font-semibold !tracking-[0.15em] transition-colors", isActive ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]")}>{L(n.label, n.en)}</NavLink>)}
            <button onClick={openContact} className="serif !font-semibold !tracking-[0.15em] text-[var(--muted)] hover:text-[var(--ink)]">{L("联系合作", "Contact")}</button>
            <Link to="/" className="btn !px-4 !py-1.5 !text-[13px]">{L("进入平台", "Open the Platform")}</Link>
            <SiteLangToggle />
          </nav>
          <div className="flex items-center gap-3 md:hidden">
            <SiteLangToggle />
            <button className="text-[var(--accent)]" onClick={() => setOpen((x) => !x)} aria-label={L("菜单", "Menu")}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        <div className="mx-auto h-px max-w-[1040px] bg-[linear-gradient(90deg,transparent,var(--line-strong),transparent)]" />
        {open && (
          <div className="px-6 pb-4 md:hidden">
            {NAV.map((n) => <Link key={n.to} to={n.to} className="serif block border-b border-[var(--line)] py-3">{L(n.label, n.en)}</Link>)}
            <button onClick={() => { setOpen(false); openContact(); }} className="serif block w-full border-b border-[var(--line)] py-3 text-left">{L("联系合作", "Contact")}</button>
            <Link to="/" className="btn mt-4 w-full justify-center">{L("进入平台", "Open the Platform")}</Link>
          </div>
        )}
      </header>
      <main className="relative z-10">{children}</main>
      <ContactModal />
      <footer className="relative z-10 mt-28">
        <div className="mx-auto h-px max-w-[1040px] bg-[linear-gradient(90deg,transparent,var(--line-strong),transparent)]" />
        <div className="mx-auto flex max-w-[1040px] flex-col items-center gap-3 px-6 py-10 text-center text-[13px] text-[var(--muted)]">
          <img src="/logo-emblem.png?v=2" alt="" className="h-10 w-auto opacity-90" />
          <p className="cinzel text-[11px] text-[var(--gold)]">Zhuxiang Academy of Mental Abacus</p>
          <p className="flex flex-wrap justify-center gap-6">
            <Link to="/overview" className="hover:text-[var(--ink)]">{L("系统", "Systems")}</Link><Link to="/home/pricing" className="hover:text-[var(--ink)]">{L("价格", "Pricing")}</Link><Link to="/home/about" className="hover:text-[var(--ink)]">{L("关于", "About")}</Link>
            <a href="/download/" className="hover:text-[var(--ink)]">{L("安卓 Pad 下载", "Android tablet app")}</a><button onClick={openContact} className="hover:text-[var(--ink)]">{L("联系合作", "Contact")}</button>
          </p>
          <p className="text-[12px]">© 2026 珠象 ZHUXIANG · superbrainlab.org</p>
        </div>
      </footer>
    </div>
  );
}

/** 板块开头:Cinzel 小标 + 宋体标题 + 花饰线(默认居中) */
export function SecHead({ no, kicker, title, sub, className, left }: { no?: string; kicker: string; title: ReactNode; sub?: ReactNode; className?: string; left?: boolean }) {
  return (
    <div className={cn(!left && "text-center", className)}>
      <p className="eyebrow">{no && <b>{no}</b>}{kicker}</p>
      <h2 className="serif mt-3 text-[24px] leading-[1.35] sm:text-[27px]">{title}</h2>
      <div className={cn("orn mt-4", left ? "justify-start" : "justify-center")}>{!left && <i />}<span className="text-[12px]">❦</span><i /></div>
      {sub && <p className={cn("mt-4 max-w-[34em] text-[15px] text-[var(--muted)]", !left && "mx-auto")}>{sub}</p>}
    </div>
  );
}

/** 会动的画像:产品实机视频 + 铜铭牌 */
export const Figure = ({ name, label, cap }: { name: string; label: string; cap: string }) => (
  <figure className="text-center">
    <div className="portrait"><video src={`/site/${name}.mp4`} poster={`/site/${name}.jpg`} autoPlay muted loop playsInline preload="metadata" aria-label={label} /></div>
    <figcaption className="plaque">{cap}</figcaption>
  </figure>
);
