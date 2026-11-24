import { DeepLinks } from "@/components/DeepLinks";
import { PrivacyGate } from "@/components/PrivacyGate";
import { RequireLogin } from "@/components/RequireLogin";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { setMasteryUser } from "@/lib/mistakeMastery";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import VideoBackdrop from "./components/hero/VideoBackdrop";
import Index from "./pages/Index.tsx";
import Play from "./pages/Play.tsx";
import Homework from "./pages/Homework.tsx";
import NotFound from "./pages/NotFound.tsx";
import { lazy, Suspense } from "react";
// 2026-11-24 首包瘦身(用户「网站整体打开变慢」):主包 1.7MB 里教练端 / 出题系统 / 后台 / 等级鉴定 / 游戏都是静态引入,学生打开广场也要下载。改为按需加载。
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Cert = lazy(() => import("./pages/Cert.tsx"));
const Coach = lazy(() => import("./pages/Coach.tsx"));
const Games = lazy(() => import("./pages/Games.tsx"));
const AnswerKey = lazy(() => import("./pages/AnswerKey.tsx"));
const ExamCenter = lazy(() => import("./pages/ExamCenter.tsx"));
const Overview = lazy(() => import("./pages/Overview.tsx"));
const Bill = lazy(() => import("./pages/Bill.tsx")); // 账单(2026-11-11),管理口令 + 管理员账号
const Feedback = lazy(() => import("./pages/Feedback.tsx")); // 用户反馈 / 开发闭环(2026-11-12),同一套口令 + 管理员账号,只做网页端
const SiteHome = lazy(() => import("./pages/site/Home.tsx"));
const SitePricing = lazy(() => import("./pages/site/Pricing.tsx"));
const SiteAbout = lazy(() => import("./pages/site/About.tsx"));
const ContestHome = lazy(() => import("./pages/contest/Home.tsx"));
const ContestJoin = lazy(() => import("./pages/contest/Join.tsx"));
const ContestMe = lazy(() => import("./pages/contest/Me.tsx"));
const ContestArena = lazy(() => import("./pages/contest/Arena.tsx"));
const ContestScreen = lazy(() => import("./pages/contest/Screen.tsx"));
const ContestAdmin = lazy(() => import("./pages/contest/Admin.tsx"));
const PrivacyPage = lazy(() => import("./pages/legal/LegalPage.tsx").then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("./pages/legal/LegalPage.tsx").then((m) => ({ default: m.TermsPage })));
const AboutApp = lazy(() => import("./pages/legal/AboutApp.tsx"));
const DeleteAccount = lazy(() => import("./pages/legal/DeleteAccount.tsx"));
const DevPaper = import.meta.env.DEV ? lazy(() => import("./pages/DevPaper.tsx")) : null;
const DevShots = import.meta.env.DEV ? lazy(() => import("./pages/DevShots.tsx")) : null; // 商店截图(仅开发)

const queryClient = new QueryClient();

const App = () => {
  // 错题掌握进度按账号隔离:登录态初始化及切换时更新当前用户
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMasteryUser(data.session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setMasteryUser(s?.user?.id));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Global cinematic background — same on every page, stays mounted across
            navigation (forward/back) so the video never restarts or flashes. */}
        <VideoBackdrop />
        <DeepLinks />
        <PrivacyGate />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/play/:gameId" element={<RequireLogin><Play /></RequireLogin>} />
          <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
          <Route path="/bill" element={<Suspense fallback={null}><Bill /></Suspense>} />
          <Route path="/feedback" element={<Suspense fallback={null}><Feedback /></Suspense>} />
          <Route path="/cert" element={<RequireLogin><Suspense fallback={null}><Cert /></Suspense></RequireLogin>} />
          <Route path="/coach" element={<Suspense fallback={null}><Coach /></Suspense>} />
          <Route path="/homework" element={<Homework />} />
          <Route path="/games" element={<RequireLogin><Suspense fallback={null}><Games /></Suspense></RequireLogin>} />
          <Route path="/exam" element={<RequireLogin><Suspense fallback={null}><ExamCenter /></Suspense></RequireLogin>} />
          <Route path="/key" element={<Suspense fallback={null}><AnswerKey /></Suspense>} />
          {/* 上架应用商店(2026-11-08):隐私政策 / 用户协议 / 关于 / 注销账号 */}
          <Route path="/privacy" element={<Suspense fallback={null}><PrivacyPage /></Suspense>} />
          <Route path="/terms" element={<Suspense fallback={null}><TermsPage /></Suspense>} />
          <Route path="/about-app" element={<Suspense fallback={null}><AboutApp /></Suspense>} />
          <Route path="/account/delete" element={<Suspense fallback={null}><DeleteAccount /></Suspense>} />
          {/* 珠象官网(2026-11-04):首页 / 系统总览 / 价格 / 关于;训练广场仍在 / */}
          <Route path="/home" element={<Suspense fallback={null}><SiteHome /></Suspense>} />
          <Route path="/home/pricing" element={<Suspense fallback={null}><SitePricing /></Suspense>} />
          <Route path="/home/about" element={<Suspense fallback={null}><SiteAbout /></Suspense>} />
          <Route path="/overview" element={<Suspense fallback={null}><Overview /></Suspense>} />
          {/* 比赛系统(2026-11-04):报名 → 赛前训练 → 赛场统一开始 / 结束 → 大屏排名 / 导出 */}
          <Route path="/contest" element={<Suspense fallback={null}><ContestHome /></Suspense>} />
          <Route path="/contest/join/:cid" element={<Suspense fallback={null}><ContestJoin /></Suspense>} />
          <Route path="/contest/me" element={<Suspense fallback={null}><ContestMe /></Suspense>} />
          <Route path="/contest/arena" element={<Suspense fallback={null}><ContestArena /></Suspense>} />
          <Route path="/contest/screen/:cid" element={<Suspense fallback={null}><ContestScreen /></Suspense>} />
          <Route path="/contest/admin" element={<Suspense fallback={null}><ContestAdmin /></Suspense>} />
          <Route path="/contest/admin/:cid" element={<Suspense fallback={null}><ContestAdmin /></Suspense>} />
          <Route path="/key/:id" element={<AnswerKey />} />
          {DevPaper && <Route path="/dev/paper" element={<Suspense fallback={null}><DevPaper /></Suspense>} />}
          {DevShots && <Route path="/dev/shots/:id" element={<Suspense fallback={null}><DevShots /></Suspense>} />}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
