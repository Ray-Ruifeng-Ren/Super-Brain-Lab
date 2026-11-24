// 当前登录账号是否教练(管理员在 /admin 授权;管理员本人天然是)。未登录 → false。
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isCoach } from "@/lib/coachAccess";

export function useCoachAccess(): { coach: boolean; checking: boolean } {
  const { user, loading } = useAuth();
  const [state, setState] = useState<{ id: string | null; coach: boolean; checking: boolean }>({ id: null, coach: false, checking: true });
  useEffect(() => {
    if (loading) return;
    const id = user?.id ?? null;
    if (!id) { setState({ id: null, coach: false, checking: false }); return; }
    let on = true;
    setState((s) => ({ ...s, id, checking: true }));
    isCoach(id).then((c) => { if (on) setState({ id, coach: c, checking: false }); });
    return () => { on = false; };
  }, [user?.id, loading]);
  return { coach: state.coach, checking: loading || state.checking };
}
