import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { EyeCareToggle } from "@/components/EyeCareToggle";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { ProjectTiles } from "@/components/ProjectTiles";
import { Pennant } from "@/components/Pennant";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import { useAuth } from "@/hooks/useAuth";
import { IS_NATIVE } from "@/lib/appEnv";

const Index = () => {
  const { t, lang } = useI18n();
  const { coach } = useCoachAccess(); // 教练端入口只给管理员授权过的账号看
  const { user } = useAuth();
  const navigate = useNavigate();
  // 教练建的学生账号(user_metadata.managed)登录后直达作业页;点「广场」回来带 sbl_stay_home 则停留
  useEffect(() => {
    if (!user?.user_metadata?.managed) return;
    let stay = false;
    try { stay = sessionStorage.getItem("sbl_stay_home") === "1"; } catch { /* noop */ }
    if (!stay) navigate("/homework", { replace: true });
  }, [user, navigate]);
  // 教练账号登录后直接进教练端(2026-10-12);从教练端点「广场」回来时带 sbl_stay_home 标记,不再弹回
  useEffect(() => {
    if (!coach) return;
    let stay = false;
    try { stay = sessionStorage.getItem("sbl_stay_home") === "1"; } catch { /* noop */ }
    if (!stay) navigate("/coach", { replace: true });
  }, [coach, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      {/* 纸质背景(2026-10-13 用户:背景换个别的):盖在全局视频之上 */}
      <div aria-hidden className="home-bg pointer-events-none fixed inset-0 z-0" />
      {/* Nav */}
      <header className="relative z-30">
        <div className="container flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            {/* 2026-11-02 产品更名:Super Brain Lab → 珠象(新名未注册,不再标 ®);同日换上金象 logo */}
            {/* 2026-11-02 用户「页头直接用整张横版logo」:金象 + 珠象 ZHUXIANG + 印章(brand/final/logo-v3-lockup-transparent.png) */}
            {/* 同日「图标和文字等高」:横版拆成金象徽标 + 「珠象 ZHUXIANG」字标,两张图同高并排 */}
            <img src="/logo-emblem.png?v=2" alt="" className="h-12 w-auto object-contain" />
            <img src="/logo-text.png?v=2" alt="珠象 ZHUXIANG" className="h-12 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-3">
            <EyeCareToggle />
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* HERO + MODULES — fit in one viewport */}
      <main className="container relative z-10 flex min-h-[calc(100vh-80px)] flex-col justify-center px-6 pb-10">

        {/* 顶部锦旗(2026-10-13 哈利波特风):锦标赛 + 身份入口(教练端 / 我的作业) */}
        <div className="pennant-row animate-fade-rise-d2 mb-6">
          <Pennant color="#7A1F2B" to="/cert">
            <div className="text-3xl">🏆</div>
            <div className="mt-1 font-display text-xl font-bold tracking-[0.15em]">{lang === "en" ? "Tournament" : "等级鉴定 · 锦标赛"}</div>
            <div className="mt-1 text-[11px] opacity-85">{lang === "en" ? "Kyu 20 → Dan 20 · Guinness-eligible" : "二十级 → 二十段 · 可申请吉尼斯"}</div>
          </Pennant>
          {user && (coach ? (
            <Pennant color="#1F3A5F" to="/coach">
              <div className="text-3xl">🎓</div>
              <div className="mt-1 font-display text-xl font-bold tracking-[0.15em]">{lang === "en" ? "Zhuxiang Coach" : "珠象教练端"}</div>
              <div className="mt-1 text-[11px] opacity-85">{lang === "en" ? "Demo · class · homework" : "课堂演示 · 班级 · 作业"}</div>
            </Pennant>
          ) : (
            <Pennant color="#2E5A3C" to="/homework">
              <div className="text-3xl">📚</div>
              <div className="mt-1 font-display text-xl font-bold tracking-[0.15em]">{lang === "en" ? "My Homework" : "我的作业"}</div>
              <div className="mt-1 text-[11px] opacity-85">{lang === "en" ? "Assignments · redo · reviews" : "作业 · 错题重做 · 评价"}</div>
            </Pennant>
          ))}
          {/* 2026-11-01 用户「出题系统的板块去掉,单独的链接保留」:站内入口都撤了,只能直接打开 superbrainlab.org/exam */}
        </div>

        {/* 主项入口(2026-10-13 可爱风):闪算 / 听算 / 看算 / 数珠互译 + 脑力游戏 */}
        <section id="modules" className="relative pb-4">
          <ProjectTiles />
        </section>
      </main>
      {/* 2026-11-03 用户「放到网页端右下角一个不显眼的位置,点击可以下载」:安卓 Pad 安装包固定下载页(App 里不显示) */}
      {!IS_NATIVE && (
        <a href="/download/" className="fixed bottom-2 right-3 z-20 text-[11px] text-[#8a6d45]/70 underline-offset-2 hover:text-[#6B5A45] hover:underline">
          {lang === "en" ? "Android tablet app" : "安卓 Pad 版下载"}
        </a>
      )}
    </div>
  );
};

export default Index;
