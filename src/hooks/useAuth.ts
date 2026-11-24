import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

export function useAuth(): AuthState & { refreshProfile: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
  });

  const loadProfile = async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("id,nickname,avatar_url")
      .eq("id", userId)
      .maybeSingle();
    return (data as Profile) ?? null;
  };

  useEffect(() => {
    // Listener FIRST, then getSession (Supabase auth pattern).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      // 2026-11-25 付海东 / 学生「登录加载等多个流程卡顿」「闪了一下又变成加载中」:之前要等 profiles 查询回来才结束 loading,
      // 国内到 Supabase 的链路一慢或一挂,整页就停在「加载中」。现在会话一确定就结束 loading,昵称等资料在后台补,拿不到也不挡路。
      if (session?.user) {
        setState((s) => ({ ...s, loading: false }));
        setTimeout(async () => {
          const profile = await loadProfile(session.user.id).catch(() => null);
          setState((s) => ({ ...s, profile }));
        }, 0);
      } else {
        setState((s) => ({ ...s, profile: null, loading: false }));
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        setState((s) => ({ ...s, session: data.session, user: data.session!.user, loading: false }));
        const profile = await loadProfile(data.session.user.id).catch(() => null);
        setState((s) => ({ ...s, profile }));
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    }).catch(() => setState((s) => ({ ...s, loading: false })));

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!state.user) return;
    const profile = await loadProfile(state.user.id);
    setState((s) => ({ ...s, profile }));
  };

  return { ...state, refreshProfile };
}
