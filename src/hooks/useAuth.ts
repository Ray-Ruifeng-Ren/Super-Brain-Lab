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
    // Listener FIRST, then getSession (per Lovable Cloud auth pattern).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      if (session?.user) {
        // Defer profile fetch to next tick to avoid deadlock.
        setTimeout(async () => {
          const profile = await loadProfile(session.user.id);
          setState((s) => ({ ...s, profile, loading: false }));
        }, 0);
      } else {
        setState((s) => ({ ...s, profile: null, loading: false }));
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const profile = await loadProfile(data.session.user.id);
        setState({
          session: data.session,
          user: data.session.user,
          profile,
          loading: false,
        });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!state.user) return;
    const profile = await loadProfile(state.user.id);
    setState((s) => ({ ...s, profile }));
  };

  return { ...state, refreshProfile };
}
