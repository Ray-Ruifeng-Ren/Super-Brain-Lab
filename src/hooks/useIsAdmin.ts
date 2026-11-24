import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Whether the current signed-in user has the 'admin' role.
 * Reads from public.user_roles (RLS: users can only read their own rows).
 */
export function useIsAdmin(): { isAdmin: boolean; checking: boolean } {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) {
        setIsAdmin(!!data);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isAdmin, checking: loading || checking };
}
