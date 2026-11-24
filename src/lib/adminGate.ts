// 管理页共用的前置口令门(/admin、/bill 同一个口令;输过一次,本标签页内两个页面都不用再输)。
// 只是软门禁:口令在前端代码里,真正的权限校验在服务端(admin 角色)。
export const ADMIN_PW = "314159265358979";
const KEY = "sbl_admin_gate";
export const gateOpen = (): boolean => { try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; } };
export const openGate = (pw: string): boolean => {
  if (pw !== ADMIN_PW) return false;
  try { sessionStorage.setItem(KEY, "1"); } catch { /* noop */ }
  return true;
};
