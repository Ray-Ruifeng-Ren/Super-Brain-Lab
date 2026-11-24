// 教练端 /coach(2026-10-11):建学生账号并分班(2026-10-12 班级码已废止)→ 给每个学生单独布置作业(闪/听/看/数珠互译 × 加减乘除 × 题量)
// → 看完成情况(逐题对错、错题重做轮次、用时)并评价 → 课堂演示(暂停/揭晓/上下题)。原站首页默认学生端。
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Play, Users, ClipboardList, BarChart3, Presentation, Printer } from "lucide-react";
import { TeachSetup, TeachStage } from "@/components/FingerTeach";
import { AccountMenu } from "@/components/AccountMenu";
import { AuthDialog } from "@/components/AuthDialog";
import { HwItemEditor, newItem } from "@/components/HwItemEditor";
import { HomeworkRunner, NumScaleRow } from "@/components/HomeworkRunner";
import { PaperPreview } from "@/components/PaperPreview";
import { useAuth } from "@/hooks/useAuth";
import { PROJECT_LABEL, type HwProject, todayKey as hwTodayKey, dayKeyOf, answerText } from "@/lib/homework";
import { Pennant } from "@/components/Pennant";
import { useTx } from "@/lib/tx";
import { useI18n } from "@/lib/i18n";
import { fmtDurEn, WD_EN, MON_EN } from "@/lib/tx-coach";
import { Emblem } from "@/components/ProjectTiles";
import { useCoachAccess } from "@/hooks/useCoachAccess";
import { createStudent, getGroups, getMembers, linkExistingStudent, newGroupId, removeMember, resetStudentPassword, restoreMember, saveGroup, searchProfiles, updateMember, type Group, type MemberInfo } from "@/lib/classManage";
import { getMySeats } from "@/lib/coachAccess";
import { toast } from "@/hooks/use-toast";
import {
  assignHomework, batchKey, fmtDate, fmtDur, genProblems, getCoachAssignments, getMyStudents, getReviews, getSubmissions,
  editAssignments, itemLabel, normalizeItem, problemExpr, reviewHomework, revokeAssignments, summarize, PROJECT_EMOJI,
  type HwAssignment, type HwItem, type HwReview, type HwSubmission, type Student,
} from "@/lib/homework";
import { cn } from "@/lib/utils";
import { IS_NATIVE } from "@/lib/appEnv";
import { fetchHealth } from "@/lib/fetchAll";
import { PasswordInput } from "@/components/ui/password-input";
import { ResetPasswordDialog } from "@/components/ResetPasswordDialog";

type Tab = "students" | "assign" | "progress" | "demo" | "teach";

/** DEV 预览用的模拟数据 */
function devMock() {
  const now = Date.now(), iso = (d: number) => new Date(now - d * 86400000).toISOString();
  const groups: Group[] = [{ id: "g1", name: "周六上午班", createdAt: iso(30) }, { id: "g2", name: "周日下午班", createdAt: iso(30) }];
  const names = ["王小明", "李思思", "张一诺", "陈子轩", "刘可欣", "赵天宇", "孙悦", "周子涵"];
  const students: Student[] = names.map((n, i) => ({ id: `s${i}`, nickname: n, joinedAt: iso(20 - i) }));
  const members = new Map<string, MemberInfo>(students.map((st, i) => [st.id, { studentId: st.id, name: st.nickname, loginName: `stu${i + 1}`, groupId: i < 5 ? "g1" : "g2", updatedAt: iso(10) }]));
  const items = [normalizeItem({ project: "flash", n: 15 }), normalizeItem({ project: "glance", n: 20 }), normalizeItem({ project: "listen", n: 10 })];
  const assignments: HwAssignment[] = [];
  const subs: HwSubmission[] = [];
  for (let d = 0; d < 6; d++) for (const st of students) {
    const id = `a${d}-${st.id}`;
    const date = new Date(now - d * 86400000);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    assignments.push({ id, coachId: "c", studentId: st.id, title: `${date.getMonth() + 1}月${date.getDate()}日作业`, note: d === 0 ? "注意看清减号" : "", items, createdAt: iso(d), date: key, studentNick: st.nickname });
    items.forEach((it, k) => {
      if ((Number(st.id.slice(1)) + d + k) % 4 === 0) return; // 部分没做
      const total = it.n, correct = Math.max(0, total - ((Number(st.id.slice(1)) * 3 + d + k) % 5));
      const results = Array.from({ length: total }, (_, q) => ({ terms: [12, 34], signs: ["+", "+"] as ("+" | "-")[], answer: 46, given: q < correct ? 46 : 45, correct: q < correct, ms: 3000 + q * 100 }));
      subs.push({ id: `${id}-${k}`, assignId: id, studentId: st.id, itemIdx: k, results, correct, total, ms: results.reduce((x, r) => x + r.ms, 0), retry: false, createdAt: iso(d) });
    });
  }
  return { groups, students, members, assignments, subs };
}

const Coach = () => {
  const navigate = useNavigate();
  const tx = useTx();
  const { lang } = useI18n();
  const en = lang === "en";
  const T = (zh: string, enS: string) => (en ? enS : zh);
  const ppl = (n: number) => (en ? `${n} student${n === 1 ? "" : "s"}` : `${n} 人`);
  const dur = (ms: number) => (en ? fmtDurEn(ms) : fmtDur(ms));
  const { user, profile, loading } = useAuth();
  const { coach, checking } = useCoachAccess();
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("demo");

  const [students, setStudents] = useState<Student[]>([]);
  const [members, setMembers] = useState<Map<string, MemberInfo>>(new Map());
  const [groups, setGroups] = useState<Group[]>([]);
  const [seats, setSeats] = useState<number>(10); // 账号配额(默认 10,管理员付费后追加)
  const used = [...members.values()].filter((m) => !m.linked).length; // 教练建过的账号数(关联的已有账号不占配额;移出不退席位)
  const removedList = [...members.values()].filter((m) => m.removed);
  const seatsLeft = Math.max(0, seats - used);
  const displayName = (s: Student) => members.get(s.id)?.name || s.nickname;
  const groupOf = (id: string) => members.get(id)?.groupId ?? "";
  const groupName = (gid: string) => groups.find((g) => g.id === gid)?.name ?? tx("未分班");
  const studentsIn = (gid: string) => students.filter((s) => groupOf(s.id) === gid);
  const [assignments, setAssignments] = useState<HwAssignment[]>([]);
  const [subs, setSubs] = useState<HwSubmission[]>([]);
  const [reviews, setReviews] = useState<HwReview[]>([]);
  const [busy, setBusy] = useState(false);

  const [dataState, setDataState] = useState<"loading" | "ok" | "partial">("loading");
  const [teachProblems, setTeachProblems] = useState<string[] | null>(null); // 指法教学:讲解中的题目 // 完成情况的数据是否完整到位
  const reload = useCallback(async () => {
    // DEV 专用:/coach?preview=1 免登录预览,填一份模拟班级数据(学生/分班/作业/提交),方便检查各页版面(生产构建剔除)
    if (!user && import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1") {
      const m = devMock(); setStudents(m.students); setMembers(m.members); setGroups(m.groups); setAssignments(m.assignments); setSubs(m.subs); setReviews([]); setDataState("ok"); return;
    }
    if (!user) return;
    // 2026-11-02:作业和成绩一起到手再显示。之前先显示作业、后到成绩,中间这一两秒全班都是「未做」,老师会以为学生没做
    fetchHealth.failed = false;
    try {
      const [st, as, mb, q, gs] = await Promise.all([getMyStudents(), getCoachAssignments(), getMembers(), getMySeats(user.id), getGroups()]);
      const ids = as.map((a) => a.id);
      const [s, r] = await Promise.all([getSubmissions(ids), getReviews(ids)]);
      setStudents(st); setAssignments(as); setMembers(mb); setSeats(q); setGroups(gs); setSubs(s); setReviews(r);
      setDataState(fetchHealth.failed ? "partial" : "ok");
    } catch { setDataState("partial"); }
  }, [user]);
  useEffect(() => { void reload(); }, [reload]);

  // ===== 班级管理:添加成员(教练直接建账号) / 改名 =====
  const [nm, setNm] = useState({ name: "", loginName: "", password: "", age: "", groupId: "" });
  const [editingMember, setEditingMember] = useState<{ id: string; name: string } | null>(null);
  // 添加已有账号(2026-10-13):按昵称搜索 → 选班 → 加入
  const [linkQ, setLinkQ] = useState("");
  const [linkGroup, setLinkGroup] = useState("");
  const [linkResults, setLinkResults] = useState<{ id: string; nickname: string }[] | null>(null);
  const searchLink = async () => {
    const q = linkQ.trim();
    if (!q) { setLinkResults(null); return; }
    setLinkResults(await searchProfiles(q));
  };
  const linkStudent = async (r: { id: string; nickname: string }) => {
    if (busy) return;
    setBusy(true);
    const res = await linkExistingStudent({ studentId: r.id, name: r.nickname, groupId: linkGroup });
    setBusy(false);
    if (!res.ok) { toast({ variant: "destructive", title: tx("加入失败"), description: res.error }); return; }
    toast({ title: T(`已把「${r.nickname}」加入班级`, `Added “${r.nickname}” to the class`) });
    setLinkResults((rs) => (rs ?? []).filter((x) => x.id !== r.id));
    await reload();
  };
  const [newGroupName, setNewGroupName] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null); // 班级管理:只看某个班(null = 全部)
  const [addOpenRaw, setAddOpen] = useState<boolean | null>(null);
  const addOpen = addOpenRaw ?? students.length === 0; // 还没学生时默认展开
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const addGroup = async () => {
    const name = newGroupName.trim();
    if (!name || busy) return;
    setBusy(true);
    const r = await saveGroup(newGroupId(), name);
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("新建班级失败"), description: r.error }); return; }
    setNewGroupName("");
    await reload();
  };
  const renameGroup = async () => {
    if (!renaming || busy) return;
    setBusy(true);
    const r = await saveGroup(renaming.id, renaming.name);
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("保存失败"), description: r.error }); return; }
    setRenaming(null);
    await reload();
  };
  const deleteGroup = async (g: Group) => {
    if (busy) return;
    const n = studentsIn(g.id).length;
    if (!window.confirm(T(`删除班级「${g.name}」?${n ? `其中 ${n} 名成员会变成未分班。` : ""}`, `Delete class “${g.name}”?${n ? ` Its ${n} member(s) will become unassigned.` : ""}`))) return;
    setBusy(true);
    const r = await saveGroup(g.id, "");
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("删除失败"), description: r.error }); return; }
    await reload();
  };
  const moveMember = async (s: Student, groupId: string) => {
    if (busy) return;
    setBusy(true);
    const r = await updateMember({ studentId: s.id, name: displayName(s), loginName: members.get(s.id)?.loginName ?? "", groupId, linked: members.get(s.id)?.linked });
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("移动失败"), description: r.error }); return; }
    await reload();
  };
  // 忘记密码(家长反馈):教练直接给学生设新密码(服务端需 service_role,未配置会提示)
  // 移出班级 / 加回(2026-10-14 付海东「添加错的学生无法删除」)
  const removeStudent = async (s: Student) => {
    if (busy) return;
    if (!window.confirm(T(`把「${displayName(s)}」移出班级?\n学生账号和已做的作业记录都保留,只是不再在你的名单里、也收不到你的新作业;可在「已移出」里加回。`, `Remove “${displayName(s)}” from the class?\nThe account and finished homework are kept; they just leave your roster and won't get your new homework. You can add them back under “Removed”.`))) return;
    setBusy(true);
    const m = members.get(s.id) ?? { studentId: s.id, name: displayName(s), loginName: "", groupId: "", updatedAt: "" };
    const r = await removeMember(m);
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("移出失败"), description: r.error }); return; }
    toast({ title: T(`已把「${displayName(s)}」移出班级`, `Removed “${displayName(s)}” from the class`) });
    await reload();
  };
  const restoreStudent = async (m: MemberInfo) => {
    if (busy) return;
    setBusy(true);
    const r = await restoreMember(m);
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("加回失败"), description: r.error }); return; }
    await reload();
  };
  // 重置密码:弹窗(明文可见、去空格、成功后显示账号+新密码),替代浏览器 prompt(2026-10-29 重置后登录失败)
  const [resetFor, setResetFor] = useState<{ id: string; name: string; loginId?: string } | null>(null);
  const resetPw = (s: Student) => setResetFor({ id: s.id, name: displayName(s), loginId: members.get(s.id)?.loginName || undefined });
  const addMember = async () => {
    if (busy) return;
    if (seatsLeft <= 0) { toast({ variant: "destructive", title: tx("账号配额已用完"), description: T(`默认 ${seats} 个,需要更多请联系管理员开通(付费)。`, `The default is ${seats}. Contact the admin to add more (paid).`) }); return; }
    setBusy(true);
    const r = await createStudent({ loginName: nm.loginName, name: nm.name, password: nm.password.trim(), age: Number(nm.age) || undefined, groupId: nm.groupId });
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("添加失败"), description: r.error }); return; }
    toast({ title: T(`已添加 ${nm.name}`, `Added ${nm.name}`), description: T(`登录名 ${nm.loginName.trim().toLowerCase()},把登录名和密码告诉学生即可。`, `Login name ${nm.loginName.trim().toLowerCase()}. Give the student the login name and password.`) });
    setNm({ name: "", loginName: "", password: "", age: "", groupId: nm.groupId });
    await reload();
  };
  const saveMember = async () => {
    if (!editingMember || busy) return;
    const s = students.find((x) => x.id === editingMember.id);
    setBusy(true);
    const r = await updateMember({ studentId: editingMember.id, name: editingMember.name, loginName: members.get(editingMember.id)?.loginName ?? "", groupId: groupOf(editingMember.id), linked: members.get(editingMember.id)?.linked });
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("保存失败"), description: r.error }); return; }
    toast({ title: T(`已更新:${s?.nickname ?? ""} → ${editingMember.name}`, `Updated: ${s?.nickname ?? ""} → ${editingMember.name}`) });
    setEditingMember(null);
    await reload();
  };

  // ===== 布置作业 =====
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState(() => { const d = new Date(); return `${d.getMonth() + 1}月${d.getDate()}日作业`; });
  const [note, setNote] = useState("");
  const [items, setItems] = useState<HwItem[]>([newItem()]);
  const [editing, setEditing] = useState(0);
  const toggleStudent = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // 作业日期(2026-10-14 付海东):默认今天,可多选未来 7 天内的日子,每天每人各一份
  const next7 = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return dayKeyOf(d); }), []);
  const [dates, setDates] = useState<Set<string>>(() => new Set([hwTodayKey()]));
  const dateChip = (k: string) => { const [y, mo, d] = k.split("-").map(Number); const dt = new Date(y, mo - 1, d); const wd = "日一二三四五六"[dt.getDay()]; const i = next7.indexOf(k); return en ? `${i === 0 ? "Today" : i === 1 ? "Tomorrow" : WD_EN[dt.getDay()]} ${mo}/${d}` : `${i === 0 ? "今天" : i === 1 ? "明天" : `周${wd}`} ${mo}/${d}`; };
  const publish = async () => {
    if (busy) return;
    if (!dates.size) { toast({ variant: "destructive", title: tx("请至少选一天") }); return; }
    setBusy(true);
    const r = await assignHomework([...selected], title, note, items, [...dates]);
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("布置失败"), description: r.error }); return; }
    toast({ title: T(`已布置 ${r.count} 份(${selected.size} 人 × ${dates.size} 天)`, `Assigned ${r.count} (${selected.size} students × ${dates.size} days)`), description: items.map(itemLabel).join(" / ") });
    setSelected(new Set());
    setDates(new Set([hwTodayKey()]));
    await reload();
    setTab("progress");
  };

  // ===== 课堂演示 =====
  const [demoItem, setDemoItem] = useState<HwItem>(() => { try { return newItem({ n: 10, ...JSON.parse(localStorage.getItem("coach:demoItem") || "{}") }); } catch { return newItem({ n: 10 }); } });
  useEffect(() => { try { localStorage.setItem("coach:demoItem", JSON.stringify(demoItem)); } catch { /* noop */ } }, [demoItem]);
  const [demo, setDemo] = useState<{ item: HwItem; problems: ReturnType<typeof genProblems> } | null>(null);
  // 底部四个大按钮选项目(闪/听/看/数珠互译),上方直接展开该项目的配置(不再选「项目」)
  const PROJECT_BTNS: { id: HwProject; emoji: string }[] = [{ id: "flash", emoji: "⚡" }, { id: "listen", emoji: "🔊" }, { id: "glance", emoji: "👀" }, { id: "bead", emoji: "🧮" }, { id: "scroll", emoji: "🏃" }, { id: "obstacle", emoji: "🌪️" }];
  const [projectPicked, setProjectPicked] = useState(false); // 进来先选项目(2026-10-13):四个大按钮,选完才进配置
  const pickProject = (pj: HwProject) => { setDemoItem((it) => newItem({ ...it, project: pj, op: pj === "flash" ? "addsub" : it.op })); setProjectPicked(true); setTab("demo"); };
  const startDemo = () => setDemo({ item: demoItem, problems: genProblems(demoItem) });
  // 打印试题(2026-10-25):先出 A4 预览(题量/字号可改、实时更新),确认后才生成 Excel
  const [paperOpen, setPaperOpen] = useState(false);

  // ===== 完成情况 =====
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<Record<string, { stars: number; comment: string }>>({});
  const latestReview = useMemo(() => {
    const m = new Map<string, HwReview>();
    for (const r of reviews) m.set(r.assignId, r); // 升序,后者覆盖 = 最新
    return m;
  }, [reviews]);
  const active = useMemo(() => assignments.filter((a) => !a.revoked), [assignments]);
  /** 最近布置过的不同作业内容(最多 5 套,按布置时间倒序),布置作业时一键沿用 */
  const recentSets = useMemo(() => {
    const seen = new Set<string>(), out: { title: string; note: string; items: HwItem[] }[] = [];
    for (const a of [...active].sort((x, y) => y.createdAt.localeCompare(x.createdAt))) {
      const k = JSON.stringify(a.items);
      if (seen.has(k)) continue;
      seen.add(k); out.push({ title: a.title, note: a.note, items: a.items });
      if (out.length >= 5) break;
    }
    return out;
  }, [active]);
  /** 班级近 7 天(含今天)作业完成率,班级管理左栏显示 */
  const groupRate = (gid: string) => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    const since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, today = hwTodayKey();
    const as = active.filter((a) => groupOf(a.studentId) === gid && a.date >= since && a.date <= today);
    if (!as.length) return "—";
    return `${Math.round((as.filter((a) => summarize(a, subs).status === "done").length / as.length) * 100)}%`;
  };
  const revokedList = useMemo(() => assignments.filter((a) => a.revoked), [assignments]);
  const [showRevoked, setShowRevoked] = useState(false);
  // 完成情况筛选(2026-10-14 用户「过去布置的作业一览无余,要按日期选」):日期范围 + 学生
  const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const todayKey = dayKey(new Date().toISOString());
  const [pgRange, setPgRange] = useState<"today" | "7d" | "30d" | "all" | "day">("7d");
  const [pgDay, setPgDay] = useState(todayKey);
  const [pgStudent, setPgStudent] = useState("");
  const [pgGroup, setPgGroup] = useState<string | null>(null); // 完成情况按班筛(null = 全部;"" = 未分班)
  const visible = useMemo(() => {
    const now = Date.now();
    return [...active].sort((a, b) => (a.date === b.date ? 0 : a.date > b.date ? -1 : 1)).filter((a) => {
      if (pgStudent && a.studentId !== pgStudent) return false;
      if (pgGroup != null && groupOf(a.studentId) !== pgGroup) return false;
      const t = new Date(a.date + "T12:00:00").getTime(); // 按「作业日期」筛(未来几天的也能看到)
      if (pgRange === "today") return a.date === todayKey;
      if (pgRange === "day") return a.date === pgDay;
      if (pgRange === "7d") return Math.abs(now - t) <= 7 * 86400e3;
      if (pgRange === "30d") return Math.abs(now - t) <= 30 * 86400e3;
      return true;
    });
  }, [active, pgRange, pgDay, pgStudent, pgGroup, todayKey, members]); // eslint-disable-line react-hooks/exhaustive-deps
  /** 某天(当前筛选下)的汇总:完成份数、平均正确率 —— 每天标题上一眼看全班情况 */
  const daySummary = (dk: string) => {
    const list = visible.filter((x) => x.date === dk);
    const pgs = list.map((a) => summarize(a, subs));
    const done = pgs.filter((p) => p.status === "done").length;
    const ans = pgs.reduce((n, p) => n + p.answered, 0), cor = pgs.reduce((n, p) => n + p.correct, 0);
    return en
      ? `${list.length} assigned · ${done}/${list.length} done${ans ? ` · avg accuracy ${Math.round((cor / ans) * 100)}%` : ""}`
      : `${list.length} 份 · 完成 ${done}/${list.length}${ans ? ` · 平均正确率 ${Math.round((cor / ans) * 100)}%` : ""}`;
  };
  // 总览表(2026-10-26 角色走查:学生多、天数多时逐份列表太长):行=学生、列=作业日期,格子=状态+正确率,点格子跳到那一份明细
  const [pgView, setPgView] = useState<"grid" | "list">(() => { try { return localStorage.getItem("coach:pgView") === "list" ? "list" : "grid"; } catch { return "grid"; } });
  const backFilters = useRef<{ range: typeof pgRange; day: string; student: string } | null>(null); // 从总览点进明细前的筛选,回总览时还原
  const switchView = (v: "grid" | "list") => {
    setPgView(v); try { localStorage.setItem("coach:pgView", v); } catch { /* noop */ }
    if (v === "grid" && backFilters.current) { const b = backFilters.current; setPgRange(b.range); setPgDay(b.day); setPgStudent(b.student); backFilters.current = null; }
  };
  const grid = useMemo(() => {
    // 2026-11-02:从 14 放宽到 60 个作业日。一次布置 7 天时 14 列里一半是未来的,选「近 30 天 / 全部」也只看得到上一周
    const days = [...new Set(visible.map((a) => a.date))].sort().slice(-60);
    const rows = new Map<string, Map<string, HwAssignment[]>>();
    for (const a of visible) {
      if (!days.includes(a.date)) continue;
      const r = rows.get(a.studentId) ?? new Map<string, HwAssignment[]>();
      r.set(a.date, [...(r.get(a.date) ?? []), a]);
      rows.set(a.studentId, r);
    }
    const order = students.filter((st) => rows.has(st.id));
    for (const id of rows.keys()) if (!order.some((st) => st.id === id)) order.push({ id, nickname: visible.find((a) => a.studentId === id)?.studentNick ?? tx("学生"), joinedAt: "" });
    return { days, rows, order };
  }, [visible, students]); // eslint-disable-line react-hooks/exhaustive-deps
  const openOne = (a: HwAssignment) => { backFilters.current = { range: pgRange, day: pgDay, student: pgStudent }; switchView("list"); setPgStudent(a.studentId); setPgRange("day"); setPgDay(a.date); setExpanded(a.id); };
  const dayLabel = (k: string) => { const [y, m, d] = k.split("-").map(Number); const wd = "日一二三四五六"[new Date(y, m - 1, d).getDay()]; return en ? `${WD_EN[new Date(y, m - 1, d).getDay()]}, ${MON_EN[m - 1]} ${d}${k === todayKey ? " · Today" : ""}` : `${m}月${d}日 周${wd}${k === todayKey ? " · 今天" : ""}`; };
  const batchOf = (a: HwAssignment) => active.filter((x) => batchKey(x) === batchKey(a));
  // 撤回(布置错了):单份或同一次发布的整批;表不可删改,追加撤回记录,学生端立即消失
  const revoke = async (list: HwAssignment[]) => {
    if (busy || !list.length) return;
    const who = list.length === 1 ? list[0].studentNick : T(`${list.length} 名学生`, `${list.length} students`);
    if (!window.confirm(T(`撤回「${list[0].title}」(${who})?撤回后学生端不再显示,已做的记录保留但不计。`, `Revoke “${list[0].title}” (${who})? It will disappear for students; any work done is kept but not counted.`))) return;
    setBusy(true);
    const r = await revokeAssignments(list.map((a) => a.id));
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("撤回失败"), description: r.error }); return; }
    toast({ title: T(`已撤回 ${list.length} 份`, `Revoked ${list.length}`) });
    setExpanded(null);
    await reload();
  };
  // 直接编辑:原地改标题/说明/项目 → 追加新版本(表不可改),可同步到同批学生
  // 2026-11-02 用户「编辑的时候支持复制编辑,复制编辑可以选择作业日期」:copy=true 时同一个编辑器,保存 = 另发一份新作业(原作业不动)
  const [editingAssign, setEditingAssign] = useState<{ id: string; title: string; note: string; items: HwItem[]; cur: number; copy?: boolean; date?: string } | null>(null);
  const openEdit = (a: HwAssignment) => setEditingAssign({ id: a.id, title: a.title, note: a.note, items: a.items.map((x) => ({ ...x })), cur: 0 });
  const openCopy = (a: HwAssignment) => setEditingAssign({ id: a.id, title: a.title, note: a.note, items: a.items.map((x) => newItem({ ...x })), cur: 0, copy: true, date: hwTodayKey() });
  const saveCopy = async (a: HwAssignment, toBatch: boolean) => {
    if (!editingAssign?.copy || busy) return;
    const ids = [...new Set((toBatch ? batchOf(a) : [a]).map((x) => x.studentId))];
    setBusy(true);
    const r = await assignHomework(ids, editingAssign.title, editingAssign.note, editingAssign.items, [editingAssign.date || hwTodayKey()]);
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("发布失败"), description: r.error }); return; }
    toast({ title: T(`已复制发布 ${r.count} 份(${editingAssign.date})`, `Copied & assigned ${r.count} (${editingAssign.date})`), description: tx("原作业保持不变。") });
    setEditingAssign(null);
    await reload();
  };
  const saveEdit = async (a: HwAssignment, toBatch: boolean) => {
    if (!editingAssign || busy) return;
    const targets = toBatch ? batchOf(a) : [a];
    setBusy(true);
    const r = await editAssignments(targets.map((x) => x.id), editingAssign.title, editingAssign.note, editingAssign.items);
    setBusy(false);
    if (!r.ok) { toast({ variant: "destructive", title: tx("保存失败"), description: r.error }); return; }
    toast({ title: T(`已保存修改(${targets.length} 份)`, `Changes saved (${targets.length})`), description: tx("学生端刷新即看到新内容。") });
    setEditingAssign(null);
    await reload();
  };
  const sendReview = async (a: HwAssignment) => {
    const d = reviewDraft[a.id] ?? { stars: 5, comment: "" };
    const r = await reviewHomework(a.id, d.stars, d.comment);
    if (!r.ok) { toast({ variant: "destructive", title: tx("评价失败"), description: r.error }); return; }
    toast({ title: tx("评价已发送"), description: `${a.studentNick} · ${a.title}` });
    setReviews(await getReviews(assignments.map((x) => x.id)));
  };

  if (loading || (user && checking)) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{tx("加载中…")}</div>;
  // 教练端只对管理员授权过的账号开放(2026-10-12):未登录 → 登录;已登录未授权 → 提示找管理员
  // DEV 专用:/coach?preview=1 免登录看界面(生产构建剔除)
  const devPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  if ((!user || !coach) && !devPreview) {
    return (
      <div className="relative min-h-screen text-foreground">
        <header className="safe-t sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="container flex items-center justify-between py-3">
            <button onClick={() => { try { sessionStorage.setItem("sbl_stay_home", "1"); } catch { /* noop */ } navigate("/"); }} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> {tx("广场")}</button>
            <AccountMenu />
          </div>
        </header>
        <main className="container relative z-10 max-w-md py-16">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="text-5xl">🎓</div>
            <h1 className="mt-3 text-xl font-black">{tx("珠象教练端")}</h1>
            {!user ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">{tx("请先登录已开通教练权限的账号。")}</p>
                <button onClick={() => setAuthOpen(true)} className="mt-5 rounded-full bg-foreground px-8 py-2.5 text-sm font-bold text-background">{tx("登录")}</button>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{T(`当前账号(${profile?.nickname || user.email})尚未开通教练权限,请联系管理员开通。`, `This account (${profile?.nickname || user.email}) doesn't have coach access yet. Please ask the admin to enable it.`)}</p>
            )}
          </div>
        </main>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-foreground">
      <div aria-hidden className="paper-bg pointer-events-none fixed inset-0 z-0" />
      <header className="sticky top-0 z-30 border-b border-[#B8925A]/40 bg-[#FBF5E6]/85 backdrop-blur">
        <div className="container flex items-center justify-between py-3">
          <button onClick={() => { try { sessionStorage.setItem("sbl_stay_home", "1"); } catch { /* noop */ } navigate("/"); }} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <img src="/logo-emblem.png?v=2" alt="珠象" className="mr-1 h-7 w-auto" />
            <ArrowLeft className="h-3.5 w-3.5" /> {tx("广场")} <span className="mx-1 text-muted-foreground/60">/</span> <span className="text-foreground">{tx("珠象教练端")}</span>
          </button>
          <AccountMenu />
        </div>
      </header>

      <main className={cn("container relative z-10 max-w-6xl py-4", tab === "demo" && projectPicked ? "pb-32" : "pb-10")}>
        {!(tab === "demo" && projectPicked) && (
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h1 className="hp-title text-3xl font-black">🎓 {tx("珠象教练端")}</h1>
              <p className="text-xs text-muted-foreground">{profile?.nickname || user?.email} · {T(`${students.length} 名学生 · ${assignments.length} 份作业`, `${students.length} students · ${assignments.length} assignments`)}</p>
            </div>
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-2">
          {([["demo", "课堂演示", Presentation], ["students", "班级管理", Users], ["assign", "布置作业", ClipboardList], ["progress", "完成情况", BarChart3]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={cn("hp-leather flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 sm:text-base", (tab === id || (id === "demo" && tab === "teach")) && "hp-leather-on")}>
              <Icon className="h-4 w-4" /> {tx(label)}
            </button>
          ))}
        </div>
        {(
          <>
            {/* ===== 学生 ===== */}
            {tab === "students" && (
              <div className="grid gap-4 md:grid-cols-[280px_1fr]">
                {/* 班级列表 */}
                <div className="hp-card p-4">
                  <div className="mb-2 flex items-baseline justify-between"><h2 className="font-bold">{tx("我的班级")}</h2><span className="text-xs text-muted-foreground">{T(`${groups.length} 个`, `${groups.length}`)}</span></div>
                  <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void addGroup(); }}>
                    <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} maxLength={20} placeholder={tx("新班级名,如 周六上午班")} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
                    <button type="submit" disabled={busy || !newGroupName.trim()} className="rounded-full bg-foreground px-4 text-xs font-bold text-background disabled:opacity-40">{tx("新建")}</button>
                  </form>
                  <ul className="space-y-1.5">
                    {groups.map((g) => (
                      <li key={g.id} className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm", groupFilter === g.id ? "border-primary bg-primary/5" : "border-border")}>
                        {renaming?.id === g.id ? (
                          <>
                            <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: g.id, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && renameGroup()} maxLength={20} className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
                            <button onClick={renameGroup} className="text-xs font-bold text-primary">{tx("保存")}</button>
                            <button onClick={() => setRenaming(null)} className="text-xs text-muted-foreground">{tx("取消")}</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setGroupFilter((f) => (f === g.id ? null : g.id))} className={cn("min-w-0 flex-1 text-left", groupFilter === g.id && "text-primary")}>
                              <span className="font-medium">{g.name}</span> <span className="text-xs text-muted-foreground">{ppl(studentsIn(g.id).length)}</span>
                              <span className="block text-[11px] text-muted-foreground">{tx("近 7 天作业完成")} {groupRate(g.id)}</span>
                            </button>
                            <span className="flex gap-2 text-xs">
                              <button onClick={() => setRenaming({ id: g.id, name: g.name })} className="text-muted-foreground hover:text-foreground">{tx("改名")}</button>
                              <button onClick={() => deleteGroup(g)} className="text-muted-foreground hover:text-red-500">{tx("删除")}</button>
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                    <li><button onClick={() => setGroupFilter((f) => (f === "" ? null : ""))} className={cn("flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground", groupFilter === "" ? "border-primary text-primary" : "border-border")}>{tx("未分班")} <span className="text-xs">{ppl(studentsIn("").length)}</span></button></li>
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground">{tx("点班级只看这个班的成员;分班后,布置作业可以按班一键勾选。")}</p>
                </div>

                <div className="space-y-4">
                  {/* 成员列表(按班) */}
                  <div className="hp-card p-4">
                    <div className="mb-2 flex items-baseline justify-between">
                      <h2 className="font-bold">{tx("班级成员")}{groupFilter != null && <span className="ml-2 text-sm font-medium text-primary">· {groupName(groupFilter)}</span>}</h2>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">{groupFilter != null && <button onClick={() => setGroupFilter(null)} className="underline-offset-2 hover:underline">{tx("看全部")}</button>}{ppl(students.length)}</span>
                    </div>
                    {students.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">{tx("还没有成员,在上方添加。")}</p>
                    ) : (
                      [...groups.map((g) => ({ id: g.id, name: g.name })), { id: "", name: tx("未分班") }].filter((g) => groupFilter == null || g.id === groupFilter).map((g) => {
                        const list = studentsIn(g.id);
                        if (!list.length) return null;
                        return (
                          <div key={g.id || "none"} className="mb-3">
                            <div className="mb-1 text-xs font-bold text-muted-foreground">{g.name} · {ppl(list.length)}</div>
                            <ul className="divide-y divide-border rounded-lg border border-border">
                              {list.map((s) => {
                                const mine = active.filter((a) => a.studentId === s.id);
                                const done = mine.filter((a) => summarize(a, subs).status === "done").length;
                                const m = members.get(s.id);
                                const ed = editingMember?.id === s.id;
                                return (
                                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                                    <span className="flex items-center gap-2">
                                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-bold">{displayName(s).charAt(0)}</span>
                                      {ed ? (
                                        <>
                                          <input autoFocus value={editingMember.name} onChange={(e) => setEditingMember({ id: s.id, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveMember()} maxLength={24} className="h-8 w-32 rounded-md border border-input bg-background px-2 text-sm" />
                                          <button onClick={saveMember} className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">{tx("保存")}</button>
                                          <button onClick={() => setEditingMember(null)} className="text-xs text-muted-foreground">{tx("取消")}</button>
                                        </>
                                      ) : (
                                        <>
                                          <span className="font-medium">{displayName(s)}</span>
                                          {m?.loginName && <span className="rounded bg-muted px-1.5 py-0.5 font-mono-tabular text-[11px] text-muted-foreground">{tx("登录名")} {m.loginName}</span>}
                                          {m?.linked && <span className="rounded bg-sky-400/20 px-1.5 py-0.5 text-[11px] text-sky-700">{tx("已有账号")}</span>}
                                          <button onClick={() => setEditingMember({ id: s.id, name: displayName(s) })} className="text-xs text-muted-foreground underline-offset-2 hover:underline">{tx("改名")}</button>
                                          <button onClick={() => resetPw(s)} className="text-xs text-muted-foreground underline-offset-2 hover:underline">{tx("重置密码")}</button>
                                          <button onClick={() => removeStudent(s)} className="text-xs text-muted-foreground underline-offset-2 hover:text-red-600 hover:underline">{tx("移出")}</button>
                                        </>
                                      )}
                                    </span>
                                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <select value={groupOf(s.id)} onChange={(e) => moveMember(s, e.target.value)} disabled={busy} className="h-7 w-28 rounded-md border border-input bg-background px-1.5 text-xs" title={tx("移到班级")}>
                                        <option value="">{tx("未分班")}</option>
                                        {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                                      </select>
                                      <span className="w-[5.5rem] text-right">{T(`作业 ${done}/${mine.length} 完成`, `${done}/${mine.length} done`)}</span>
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })
                    )}
                    {removedList.length > 0 && (
                      <div className="mt-3 border-t border-dashed border-border pt-2">
                        <div className="mb-1 text-xs font-bold text-muted-foreground">{tx("已移出")} · {ppl(removedList.length)}</div>
                        <ul className="space-y-1">
                          {removedList.map((m) => (
                            <li key={m.studentId} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">
                              <span className="line-through">{m.name || m.studentId.slice(0, 8)}</span>
                              <button onClick={() => restoreStudent(m)} disabled={busy} className="text-xs underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40">{tx("加回班级")}</button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {/* 2026-10-26 教练最常用的是看名单:成员列表放最上面;加人收进「＋ 添加学生」(还没学生时默认展开) */}
                  <div className="hp-card p-3">
                    <button onClick={() => setAddOpen(!addOpen)} className="flex w-full items-center justify-between text-left">
                      <span className="font-bold">＋ {tx("添加学生")} <span className="ml-1 text-xs font-normal text-muted-foreground">{tx("给学生建账号 · 或加入已有账号")}</span></span>
                      <span className="text-xs text-muted-foreground">{addOpen ? tx("收起") : tx("展开")}</span>
                    </button>
                  </div>
                  {addOpen && (<>
                  {/* 添加成员 */}
                  <div className="hp-card p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-bold">{tx("添加成员(给学生建账号)")}</h2>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", seatsLeft > 0 ? "bg-emerald-400/20 text-emerald-700" : "bg-red-400/20 text-red-700")}>{seats >= 9999 ? T(`已建 ${used} 个账号`, `${used} accounts created`) : T(`账号 ${used} / ${seats}`, `Accounts ${used} / ${seats}`)}</span>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">{tx("填姓名、登录名、密码并选班级;建好后把登录名和密码告诉学生,学生在首页登录框输入即可,登录后直接进作业页。")}</p>
                    {seatsLeft <= 0 && <p className="mb-3 rounded-md border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs">{T(`账号配额(${seats} 个)已用完。需要更多账号请联系管理员开通(付费),开通后这里自动解锁。`, `All ${seats} account seats are used. Contact the admin to add more (paid); this unlocks automatically once added.`)}</p>}
                    <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void addMember(); }}>
                      <label className="text-xs"><span className="font-semibold text-muted-foreground">{tx("姓名")}</span>
                        <input value={nm.name} onChange={(e) => setNm({ ...nm, name: e.target.value })} maxLength={24} placeholder={tx("学生姓名")} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></label>
                      <label className="text-xs"><span className="font-semibold text-muted-foreground">{tx("班级")}</span>
                        <select value={nm.groupId} onChange={(e) => setNm({ ...nm, groupId: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                          <option value="">{tx("未分班")}</option>
                          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select></label>
                      <label className="text-xs"><span className="font-semibold text-muted-foreground">{tx("登录名(字母/数字/下划线,3–20 位)")}</span>
                        <input value={nm.loginName} onChange={(e) => setNm({ ...nm, loginName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} maxLength={20} placeholder={tx("如 2024001")} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono-tabular text-sm" /></label>
                      <label className="text-xs"><span className="font-semibold text-muted-foreground">{tx("密码(至少 6 位)")}</span>
                        <PasswordInput defaultVisible wrapperClassName="mt-1" value={nm.password} onChange={(e) => setNm({ ...nm, password: e.target.value })} maxLength={72} placeholder={tx("学生用它登录")} autoComplete="new-password" className="h-9 font-mono-tabular text-sm" /></label>
                      <label className="text-xs"><span className="font-semibold text-muted-foreground">{tx("年龄(可选,等级鉴定分组用)")}</span>
                        <input value={nm.age} onChange={(e) => setNm({ ...nm, age: e.target.value.replace(/\D/g, "") })} maxLength={2} placeholder={tx("如 8")} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></label>
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <button type="submit" disabled={busy || seatsLeft <= 0 || !nm.name.trim() || nm.loginName.length < 3 || nm.password.trim().length < 6} className="rounded-full bg-foreground px-6 py-2 text-sm font-bold text-background disabled:opacity-40">{busy ? tx("添加中…") : seatsLeft <= 0 ? tx("配额已满") : tx("添加成员")}</button>
                        <span className="text-[11px] text-muted-foreground">{tx("学生忘了密码,在下方名单点「重置密码」即可。")}</span>
                      </div>
                    </form>
                  </div>

                  {/* 添加已有账号 */}
                  <div className="hp-card p-4">
                    <h2 className="font-bold">{tx("添加已有账号")}</h2>
                    <p className="mb-3 text-xs text-muted-foreground">{tx("学生自己注册过、或之前从班里移出的账号,按昵称搜索后直接加入,不占建号配额,学生无需操作。")}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={linkQ} onChange={(e) => setLinkQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchLink()} placeholder={tx("输入昵称关键字")} maxLength={24} className="h-9 flex-1 min-w-[160px] rounded-md border border-input bg-background px-3 text-sm" />
                      <select value={linkGroup} onChange={(e) => setLinkGroup(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                        <option value="">{tx("未分班")}</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <button onClick={() => void searchLink()} className="rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background">{tx("搜索")}</button>
                    </div>
                    {linkResults && (
                      <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                        {linkResults.length === 0 && <li className="px-3 py-3 text-center text-xs text-muted-foreground">{tx("没有匹配的账号")}</li>}
                        {linkResults.map((r) => {
                          const already = students.some((s) => s.id === r.id);
                          return (
                            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                              <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-bold">{r.nickname.charAt(0)}</span><span className="font-medium">{r.nickname}</span><span className="font-mono-tabular text-[10px] text-muted-foreground">{r.id.slice(0, 8)}</span></span>
                              {already ? <span className="text-xs text-muted-foreground">{tx("已在班里")}</span> : <button onClick={() => void linkStudent(r)} disabled={busy} className="rounded-full border border-foreground/30 px-3 py-1 text-xs font-bold hover:bg-foreground hover:text-background disabled:opacity-40">{tx("加入班级")}</button>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  </>)}
                </div>
              </div>
            )}

            {/* ===== 布置作业 ===== */}
            {tab === "assign" && (
              <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                <div className="space-y-3">
                  <div className="hp-card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="font-bold">{tx("给谁布置")}</h2>
                      <div className="flex gap-2 text-xs">
                        <button onClick={() => setSelected(new Set(students.map((s) => s.id)))} className="text-primary">{tx("全选")}</button>
                        <button onClick={() => setSelected(new Set())} className="text-muted-foreground">{tx("清空")}</button>
                      </div>
                    </div>
                    {students.length === 0 ? <p className="text-xs text-muted-foreground">{tx("还没有学生,先到「班级管理」添加。")}</p> : (
                      <div className="space-y-2">
                        {[...groups.map((g) => ({ id: g.id, name: g.name })), { id: "", name: tx("未分班") }].map((g) => {
                          const list = studentsIn(g.id);
                          if (!list.length) return null;
                          const allOn = list.every((s) => selected.has(s.id));
                          return (
                            <div key={g.id || "none"}>
                              <button onClick={() => setSelected((sel) => { const n = new Set(sel); list.forEach((s) => (allOn ? n.delete(s.id) : n.add(s.id))); return n; })}
                                className={cn("mb-1 rounded-md px-2 py-0.5 text-xs font-bold", allOn ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}>
                                {allOn ? "✓ " : ""}{g.name} · {ppl(list.length)}{allOn ? "" : T(" · 全选本班", " · select all")}
                              </button>
                              <div className="flex flex-wrap gap-1.5">
                                {list.map((s) => (
                                  <button key={s.id} onClick={() => toggleStudent(s.id)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", selected.has(s.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{displayName(s)}</button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">{tx("每个学生收到的是独立一份;想给不同学生不同内容,就分别布置。")}</p>
                  </div>
                  <div className="hp-card p-4">
                    <div className="mb-2 flex items-baseline justify-between"><h2 className="font-bold">{tx("作业日期")}</h2><span className="text-xs text-muted-foreground">{T(`已选 ${dates.size} 天`, `${dates.size} day${dates.size === 1 ? "" : "s"} selected`)}</span></div>
                    <div className="flex flex-wrap gap-1.5">
                      {next7.map((k) => (
                        <button key={k} onClick={() => setDates((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                          className={cn("rounded-full border px-3 py-1 text-xs font-medium", dates.has(k) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{dates.has(k) ? "✓ " : ""}{dateChip(k)}</button>
                      ))}
                    </div>
                    {[...dates].filter((k) => !next7.includes(k)).sort().length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[...dates].filter((k) => !next7.includes(k)).sort().map((k) => (
                          <button key={k} onClick={() => setDates((s) => { const n = new Set(s); n.delete(k); return n; })} className="rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary" title={tx("点击取消")}>✓ {k.slice(5).replace("-", "/")} ×</button>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                      <button onClick={() => setDates(new Set(next7))} className="text-primary">{tx("全选 7 天")}</button>
                      <button onClick={() => setDates(new Set([hwTodayKey()]))} className="text-muted-foreground">{tx("只选今天")}</button>
                      <label className="flex items-center gap-1 text-muted-foreground">{tx("指定日期")}
                        <input type="date" min={hwTodayKey()} onChange={(e) => { const k = e.target.value; if (k) { setDates((s) => new Set(s).add(k)); e.target.value = ""; } }} className="h-7 rounded-md border border-input bg-background px-2 text-xs" title={tx("选任意一天(含 7 天以后)加入")} />
                      </label>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{tx("每一天都是独立一份同样内容的作业,学生当天才能开始做;一周一次课时一次布置好 7 天。")}</p>
                  </div>
                  <div className="hp-card p-4">
                    <label className="text-xs font-semibold text-muted-foreground">{tx("作业标题")}</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                    <label className="mt-3 block text-xs font-semibold text-muted-foreground">{tx("给学生的话(可选)")}</label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={3} placeholder={tx("例:今天重点练退位减,错题一定要再做一遍。")} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="hp-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-bold">{tx("作业内容")}</h2>
                    <span className="flex items-center gap-2">
                      {/* 2026-10-26 教练天天布置相近的作业:一键沿用最近布置过的内容(项目 + 备注),再微调 */}
                      {recentSets.length > 0 && (
                        <select value="" onChange={(e) => { const r = recentSets[Number(e.target.value)]; if (!r) return; setItems(r.items.map((it) => newItem({ ...it }))); setEditing(0); if (r.note) setNote(r.note); toast({ title: tx("已沿用"), description: T(`${r.title} 的 ${r.items.length} 个项目,可以再改`, `${r.items.length} item(s) from “${r.title}” — edit as needed`) }); }}
                          className="h-8 max-w-[220px] rounded-full border border-border bg-background px-3 text-xs font-medium" title={tx("沿用最近布置过的作业内容")}>
                          <option value="">📋 {tx("沿用最近作业…")}</option>
                          {recentSets.map((r, i) => <option key={i} value={i}>{r.title} · {r.items.map((it) => itemLabel(it)).join(" + ").slice(0, 40)}</option>)}
                        </select>
                      )}
                      <button onClick={() => { setItems((xs) => [...xs, newItem({ project: "listen" })]); setEditing(items.length); }} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted"><Plus className="h-3.5 w-3.5" /> {tx("添加项目")}</button>
                    </span>
                  </div>
                  <ol className="mb-3 space-y-1.5">
                    {items.map((it, i) => (
                      <li key={i} className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm", editing === i ? "border-primary bg-primary/5" : "border-border")}>
                        <button onClick={() => setEditing(i)} className="flex-1 text-left"><span className="mr-2 font-mono-tabular text-xs text-muted-foreground">{i + 1}</span>{PROJECT_EMOJI[it.project]} {itemLabel(it)}</button>
                        {items.length > 1 && <button onClick={() => { setItems((xs) => xs.filter((_, j) => j !== i)); setEditing(0); }} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </li>
                    ))}
                  </ol>
                  {items[editing] && (
                    <div className="rounded-xl border border-dashed border-border p-3">
                      <div className="mb-2 text-xs font-semibold text-muted-foreground">{T(`编辑第 ${editing + 1} 项`, `Editing item ${editing + 1}`)}</div>
                      <HwItemEditor value={items[editing]} onChange={(it) => setItems((xs) => xs.map((x, j) => (j === editing ? it : x)))} />
                    </div>
                  )}
                  {/* 发布条吸底(2026-10-26 走查:编辑器很长,原来要滚到底才找得到「发布作业」) */}
                  <div className="safe-b sticky bottom-0 z-10 -mx-4 -mb-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-[#B8925A]/40 bg-[#FBF5E6]/95 px-4 py-3 backdrop-blur">
                    <span className="text-xs text-muted-foreground">{T(`共 ${items.length} 项 · ${items.reduce((s, x) => s + x.n, 0)} 题 · 发给 ${selected.size} 人 × ${dates.size} 天 = ${selected.size * dates.size} 份`, `${items.length} item${items.length === 1 ? "" : "s"} · ${items.reduce((s, x) => s + x.n, 0)} q · ${selected.size} students × ${dates.size} days = ${selected.size * dates.size}`)}{!selected.size ? <b className="ml-2 text-amber-700">{tx("← 先在左边选学生")}</b> : !dates.size ? <b className="ml-2 text-amber-700">{tx("← 先选作业日期")}</b> : null}</span>
                    <button onClick={publish} disabled={busy || !selected.size || !items.length || !dates.size} className="rounded-full bg-foreground px-6 py-2 text-sm font-bold text-background disabled:opacity-40">{busy ? tx("发布中…") : tx("发布作业")}</button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== 完成情况 ===== */}
            {tab === "progress" && (
              <div className="space-y-2">
              {/* 今日概况(2026-10-26 放在课堂演示首页;2026-11-02 用户「这个放到完成情况里面」→ 移到完成情况顶部) */}
              {active.length > 0 && (() => {
                const td = active.filter((a) => a.date === todayKey);
                const pgs = td.map((a) => ({ a, pg: summarize(a, subs) }));
                const done = pgs.filter((x) => x.pg.status === "done").length;
                const ans = pgs.reduce((n, x) => n + x.pg.answered, 0), cor = pgs.reduce((n, x) => n + x.pg.correct, 0);
                const attention = pgs.filter((x) => x.pg.status !== "done" || (x.pg.answered > 0 && x.pg.correct / x.pg.answered < 0.8)).slice(0, 8);
                return (
                  <div className="mb-2 w-full">
                    <div className="hp-card grid gap-3 p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_2fr]">
                      <div><div className="text-xs text-muted-foreground">{tx("今日作业")}</div><div className="text-2xl font-black">{td.length} <span className="text-sm font-medium text-muted-foreground">{T("份", "")}</span></div></div>
                      <div><div className="text-xs text-muted-foreground">{tx("已完成")}</div><div className="text-2xl font-black text-emerald-700">{done}<span className="text-sm font-medium text-muted-foreground"> / {td.length}</span></div></div>
                      <div><div className="text-xs text-muted-foreground">{tx("平均正确率")}</div><div className="text-2xl font-black">{ans ? `${Math.round((cor / ans) * 100)}%` : "—"}</div></div>
                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between text-xs text-muted-foreground"><span>{tx("需要关注(未完成 / 正确率 < 80%)")}</span></div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {attention.length ? attention.map(({ a, pg }) => (
                            <span key={a.id} className={cn("rounded-full px-2 py-0.5 text-xs font-bold", pg.status !== "done" ? "bg-amber-400/20 text-amber-800" : "bg-red-400/15 text-red-700")}>
                              {a.studentNick}{pg.status !== "done" ? ` ${pg.doneCount}/${pg.total}${T("项", "")}` : ` ${Math.round((pg.correct / pg.answered) * 100)}%`}
                            </span>
                          )) : <span className="text-xs text-emerald-700">{td.length ? tx("全部完成且正确率都不错 👍") : tx("今天还没布置作业")}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
                {active.length > 0 && (
                  <div className="hp-card mb-2 flex flex-wrap items-center gap-2 px-4 py-3 text-xs">
                    <span className="font-bold">{tx("日期")}</span>
                    {([["today", "今天"], ["7d", "近 7 天"], ["30d", "近 30 天"], ["all", "全部"]] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setPgRange(v)} className={cn("rounded-full border px-3 py-1 font-medium", pgRange === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{tx(l)}</button>
                    ))}
                    <input type="date" value={pgDay} onChange={(e) => { if (e.target.value) { setPgDay(e.target.value); setPgRange("day"); } }}
                      className={cn("h-7 rounded-md border bg-background px-2", pgRange === "day" ? "border-primary text-primary" : "border-input")} title={tx("选某一天")} />
                    {groups.length > 0 && (<>
                      <span className="ml-3 font-bold">{tx("班级")}</span>
                      <select value={pgGroup ?? "*"} onChange={(e) => { setPgGroup(e.target.value === "*" ? null : e.target.value); setPgStudent(""); }} className="h-7 rounded-md border border-input bg-background px-2">
                        <option value="*">{tx("全部班级")}</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        <option value="">{tx("未分班")}</option>
                      </select>
                    </>)}
                    <span className="ml-3 font-bold">{tx("学生")}</span>
                    <select value={pgStudent} onChange={(e) => setPgStudent(e.target.value)} className="h-7 rounded-md border border-input bg-background px-2">
                      <option value="">{tx("全部学生")}</option>
                      {students.filter((st) => pgGroup == null || groupOf(st.id) === pgGroup).map((st) => <option key={st.id} value={st.id}>{displayName(st)}</option>)}
                    </select>
                    <span className="ml-auto flex items-center gap-2 text-muted-foreground">
                      {visible.length} / {active.length}{T(" 份", "")}
                      <span className="inline-flex overflow-hidden rounded-full border border-border">
                        {([["grid", "📊 总览表"], ["list", "📋 逐份明细"]] as const).map(([v, l]) => (
                          <button key={v} onClick={() => switchView(v)} className={cn("px-3 py-1 font-medium", pgView === v ? "bg-primary/15 text-primary" : "hover:text-foreground")}>{tx(l)}</button>
                        ))}
                      </span>
                    </span>
                  </div>
                )}
                {dataState === "partial" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    <span>⚠️ {tx("网络不稳定,有些成绩没有加载出来。这不代表学生没做,请点重试。")}</span>
                    <button onClick={() => { setDataState("loading"); void reload(); }} className="rounded-full bg-red-600 px-4 py-1 text-xs font-bold text-white">{tx("重试")}</button>
                  </div>
                )}
                {dataState === "loading" && <p className="py-10 text-center text-sm text-muted-foreground">{tx("正在加载学生的完成情况…")}</p>}
                {dataState !== "loading" && active.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{tx("还没布置过作业。")}</p>}
                {active.length > 0 && visible.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{tx("这个范围内没有作业,换个日期或学生试试。")}</p>}
                {pgView === "grid" && visible.length > 0 && (
                  <div ref={(el) => { if (el && el.dataset.days !== grid.days.join()) { el.dataset.days = grid.days.join(); const th = el.querySelector<HTMLElement>("th[data-today]"); el.scrollLeft = th ? th.offsetLeft + th.offsetWidth - el.clientWidth + 90 : el.scrollWidth; } }} className="hp-card overflow-x-auto p-3">
                    <table className="w-full border-separate border-spacing-1 text-xs">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-card px-2 text-left font-bold">{tx("学生")}</th>
                          {grid.days.map((d) => {
                            const list = visible.filter((x) => x.date === d);
                            const done = list.filter((x) => summarize(x, subs).status === "done").length;
                            const [, m, dd] = d.split("-").map(Number);
                            return <th key={d} data-today={d === todayKey ? "1" : undefined} className={cn("min-w-[64px] px-1 font-medium", d === todayKey ? "text-primary" : "text-muted-foreground")}>
                              <div>{d === todayKey ? tx("今天") : `${m}/${dd}`}{d > todayKey ? T(" ·未到", " · soon") : ""}</div>
                              <div className="text-[10px] font-normal">{done}/{list.length} {tx("完成")}</div>
                            </th>;
                          })}
                          <th className="min-w-[90px] px-1 text-right font-bold">{tx("完成 · 正确率")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grid.order.map((st) => {
                          const r = grid.rows.get(st.id)!;
                          const all = [...r.values()].flat().filter((a) => a.date <= todayKey);
                          const pgs = all.map((a) => summarize(a, subs));
                          const dn = pgs.filter((p) => p.status === "done").length;
                          const ans = pgs.reduce((n, p) => n + p.answered, 0), cor = pgs.reduce((n, p) => n + p.correct, 0);
                          const rate = ans ? Math.round((cor / ans) * 100) : null;
                          return (
                            <tr key={st.id}>
                              <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1 font-bold">{displayName(st)}</td>
                              {grid.days.map((d) => {
                                const list = r.get(d) ?? [];
                                if (!list.length) return <td key={d} className="rounded-md bg-muted/30 text-center text-muted-foreground/50">·</td>;
                                return (
                                  <td key={d} className="p-0">
                                    <div className="flex flex-col gap-0.5">
                                      {list.map((a) => {
                                        const pg = summarize(a, subs);
                                        const future = a.date > todayKey;
                                        const ok = pg.answered ? pg.correct / pg.answered : null;
                                        return (
                                          <button key={a.id} onClick={() => openOne(a)} title={`${a.title} · ${pg.doneCount}/${pg.total}${T(" 项", " items")}`}
                                            className={cn("w-full rounded-md px-1 py-1.5 text-center font-mono-tabular font-bold transition hover:ring-2 hover:ring-primary/40",
                                              future ? "bg-muted/50 text-muted-foreground/70" : pg.status === "done" ? (ok != null && ok < 0.8 ? "bg-amber-400/25 text-amber-800" : "bg-emerald-400/25 text-emerald-800") : pg.status === "doing" ? "bg-amber-400/15 text-amber-700" : a.date < todayKey ? "bg-red-400/15 text-red-700" : "bg-muted text-muted-foreground")}>
                                            {future ? T("未到", "Soon") : pg.status === "todo" ? (a.date < todayKey ? tx("未做") : T("未开始", "To do")) : `${ok != null ? Math.round(ok * 100) + "%" : "✓"}${pg.status === "doing" ? ` ${pg.doneCount}/${pg.total}` : ""}`}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="whitespace-nowrap px-1 text-right font-mono-tabular">
                                <b>{dn}/{all.length}</b>{rate != null && <span className={cn("ml-1.5", rate >= 80 ? "text-emerald-600" : "text-amber-600")}>{rate}%</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[11px] text-muted-foreground">{tx("格子:绿 = 完成且正确率 ≥80%,黄 = 完成但正确率低 / 做了一部分,红 = 过了日期没做;点格子看那一份的明细并写评价。最多显示最近 60 个作业日。")}</p>
                  </div>
                )}
                {pgView === "list" && visible.map((a, vi) => {
                  const pg = summarize(a, subs);
                  const rv = latestReview.get(a.id);
                  const open = expanded === a.id;
                  const draft = reviewDraft[a.id] ?? { stars: 5, comment: "" };
                  const dk = a.date;
                  const newDay = vi === 0 || visible[vi - 1].date !== dk;
                  return (
                    <Fragment key={a.id}>
                    {newDay && <div className="pt-3 text-xs font-bold text-muted-foreground">📅 {dayLabel(dk)}{dk > todayKey ? T(" · 未到", " · upcoming") : ""} · {daySummary(dk)}</div>}
                    <div className="hp-card">
                      <button onClick={() => setExpanded(open ? null : a.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-left">
                        <StatusChip status={pg.status} />
                        <span className="font-bold">{a.studentNick}</span>
                        <span className="text-sm text-muted-foreground">{a.title}</span>
                        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                          {pg.answered > 0 && <span>{tx("正确率")} <b className={cn(pg.correct / pg.answered >= 0.8 ? "text-emerald-600" : "text-amber-600")}>{Math.round((pg.correct / pg.answered) * 100)}%</b> ({pg.correct}/{pg.answered})</span>}
                          {pg.ms > 0 && <span>{tx("用时")} {dur(pg.ms)}</span>}
                          {rv && <span className="text-amber-500">{"★".repeat(rv.stars)}</span>}
                          <span>{fmtDate(a.createdAt)}</span>
                        </span>
                      </button>
                      {open && (
                        <div className="border-t border-border px-4 py-3">
                          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                            <button onClick={() => (editingAssign?.id === a.id ? setEditingAssign(null) : openEdit(a))} className={cn("rounded-full border px-3 py-1 font-medium", editingAssign?.id === a.id && !editingAssign.copy ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>✏️ {tx("直接编辑")}</button>
                            <button onClick={() => (editingAssign?.id === a.id && editingAssign.copy ? setEditingAssign(null) : openCopy(a))} className={cn("rounded-full border px-3 py-1 font-medium", editingAssign?.id === a.id && editingAssign.copy ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>📋 {tx("复制编辑")}</button>
                            <button onClick={() => revoke([a])} className="rounded-full border border-red-300 px-3 py-1 font-medium text-red-600 hover:bg-red-50">{tx("撤回这一份")}</button>
                            {batchOf(a).length > 1 && (
                              <button onClick={() => revoke(batchOf(a))} className="rounded-full border border-red-300 px-3 py-1 font-medium text-red-600 hover:bg-red-50">{T(`撤回同批 ${batchOf(a).length} 份`, `Revoke whole batch (${batchOf(a).length})`)}</button>
                            )}
                            {a.editedAt && <span className="text-muted-foreground">{T(`已于 ${fmtDate(a.editedAt)} 修改`, `Edited ${fmtDate(a.editedAt)}`)}</span>}
                          </div>
                          {editingAssign?.id === a.id && (
                            <div className="mb-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
                              {editingAssign.copy && (
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                  <span className="rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary">📋 {tx("复制为新作业")}</span>
                                  <label className="flex items-center gap-1.5"><span className="font-semibold text-muted-foreground">{tx("作业日期")}</span>
                                    <input type="date" value={editingAssign.date} onChange={(e) => e.target.value && setEditingAssign({ ...editingAssign, date: e.target.value })} className="h-8 rounded-md border border-input bg-background px-2 text-sm" /></label>
                                  <span className="text-muted-foreground">{tx("原作业不会改动。")}</span>
                                </div>
                              )}
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="text-xs"><span className="font-semibold text-muted-foreground">{tx("标题")}</span>
                                  <input value={editingAssign.title} onChange={(e) => setEditingAssign({ ...editingAssign, title: e.target.value })} maxLength={30} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm" /></label>
                                <label className="text-xs"><span className="font-semibold text-muted-foreground">{tx("给学生的话")}</span>
                                  <input value={editingAssign.note} onChange={(e) => setEditingAssign({ ...editingAssign, note: e.target.value })} maxLength={200} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm" /></label>
                              </div>
                              <ol className="my-2 space-y-1">
                                {editingAssign.items.map((it, i) => (
                                  <li key={i} className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm", editingAssign.cur === i ? "border-primary bg-background" : "border-border bg-background/60")}>
                                    <button onClick={() => setEditingAssign({ ...editingAssign, cur: i })} className="flex-1 text-left"><span className="mr-2 font-mono-tabular text-xs text-muted-foreground">{i + 1}</span>{PROJECT_EMOJI[it.project]} {itemLabel(it)}</button>
                                    {editingAssign.items.length > 1 && <button onClick={() => setEditingAssign({ ...editingAssign, items: editingAssign.items.filter((_, j) => j !== i), cur: 0 })} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                                  </li>
                                ))}
                              </ol>
                              <button onClick={() => setEditingAssign({ ...editingAssign, items: [...editingAssign.items, newItem({ project: "listen" })], cur: editingAssign.items.length })} className="mb-2 flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted"><Plus className="h-3.5 w-3.5" /> {tx("添加项目")}</button>
                              {editingAssign.items[editingAssign.cur] && (
                                <div className="rounded-lg border border-dashed border-border bg-background p-3">
                                  <HwItemEditor value={editingAssign.items[editingAssign.cur]} onChange={(it) => setEditingAssign({ ...editingAssign, items: editingAssign.items.map((x, j) => (j === editingAssign.cur ? it : x)) })} />
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {editingAssign.copy ? (<>
                                <button onClick={() => saveCopy(a, false)} disabled={busy} className="rounded-full bg-foreground px-5 py-1.5 text-xs font-bold text-background disabled:opacity-40">{T(`发布给 ${a.studentNick}`, `Assign to ${a.studentNick}`)}</button>
                                {batchOf(a).length > 1 && <button onClick={() => saveCopy(a, true)} disabled={busy} className="rounded-full bg-foreground px-5 py-1.5 text-xs font-bold text-background disabled:opacity-40">{T(`发布给同批 ${new Set(batchOf(a).map((x) => x.studentId)).size} 位学生`, `Assign to whole batch (${new Set(batchOf(a).map((x) => x.studentId)).size})`)}</button>}
                                <button onClick={() => setEditingAssign(null)} className="text-xs text-muted-foreground hover:underline">{tx("取消")}</button>
                                </>) : (<>
                                <button onClick={() => saveEdit(a, false)} disabled={busy} className="rounded-full bg-foreground px-5 py-1.5 text-xs font-bold text-background disabled:opacity-40">{T(`保存(仅 ${a.studentNick})`, `Save (${a.studentNick} only)`)}</button>
                                {batchOf(a).length > 1 && <button onClick={() => saveEdit(a, true)} disabled={busy} className="rounded-full bg-foreground px-5 py-1.5 text-xs font-bold text-background disabled:opacity-40">{T(`保存并同步同批 ${batchOf(a).length} 份`, `Save & sync batch (${batchOf(a).length})`)}</button>}
                                <button onClick={() => setEditingAssign(null)} className="text-xs text-muted-foreground hover:underline">{tx("取消")}</button>
                                <span className="text-[11px] text-muted-foreground">{tx("学生已做的项目按序号继续对应;删掉的项目其记录不再显示。")}</span>
                                </>)}
                              </div>
                            </div>
                          )}
                          {a.note && <p className="mb-2 rounded-md bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">📝 {a.note}</p>}
                          <div className="space-y-3">
                            {a.items.map((it, i) => {
                              const ip = pg.items[i];
                              return (
                                <div key={i}>
                                  <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="font-semibold">{i + 1}. {PROJECT_EMOJI[it.project]} {itemLabel(it)}</span>
                                    {!ip.first ? <span className="text-xs text-muted-foreground">{tx("未开始")}</span> : (
                                      <span className="text-xs text-muted-foreground">
                                        {tx("首做")} <b className={ip.first.correct === ip.first.total ? "text-emerald-600" : "text-amber-600"}>{ip.first.correct}/{ip.first.total}</b> · {dur(ip.first.ms)}
                                        {ip.retries.length > 0 && <> · {T(`错题重做 ${ip.retries.length} 轮`, `redo ×${ip.retries.length}`)}{ip.finalAllCorrect ? T(" → 已全对 ✓", " → all correct ✓") : ""}</>}
                                      </span>
                                    )}
                                  </div>
                                  {ip.first && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {ip.first.results.map((r, k) => (
                                        <span key={k} title={`${problemExpr(r)} = ${answerText(r.answer, r.rem)}`} className={cn("rounded border px-1.5 py-0.5 font-mono-tabular text-[11px]", r.correct ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-700" : "border-red-400/50 bg-red-400/10 text-red-700")}>
                                          {r.correct ? "✓" : `${r.given == null ? "—" : answerText(r.given, r.givenRem)}≠${answerText(r.answer, r.rem)}`}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {ip.retries.map((rt, k) => (
                                    <div key={rt.id} className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                                      <span>{T(`重做${k + 1}:`, `Redo ${k + 1}:`)}</span>
                                      {rt.results.map((r, j) => <span key={j} className={cn("rounded border px-1 py-px font-mono-tabular", r.correct ? "border-emerald-400/40 text-emerald-700" : "border-red-400/40 text-red-700")}>{r.correct ? "✓" : `${r.given == null ? "—" : answerText(r.given, r.givenRem)}≠${answerText(r.answer, r.rem)}`}</span>)}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
                            <div className="mb-1.5 text-xs font-semibold">{tx("教练评价")}{rv && <span className="ml-2 font-normal text-muted-foreground">({T("已评", "reviewed")} {fmtDate(rv.createdAt)}{T(":", ": ")}{"★".repeat(rv.stars)} {rv.comment})</span>}</div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => <button key={s} onClick={() => setReviewDraft((d) => ({ ...d, [a.id]: { ...draft, stars: s } }))} className={cn("text-xl", s <= draft.stars ? "text-amber-500" : "text-muted-foreground/40")}>★</button>)}
                              </span>
                              <input value={draft.comment} onChange={(e) => setReviewDraft((d) => ({ ...d, [a.id]: { ...draft, comment: e.target.value } }))} maxLength={120} placeholder={tx("一句话评价,学生在作业页能看到")} className="h-8 min-w-[200px] flex-1 rounded-md border border-input bg-background px-2 text-sm" />
                              <button onClick={() => sendReview(a)} className="rounded-full bg-foreground px-4 py-1.5 text-xs font-bold text-background">{rv ? tx("更新评价") : tx("发送评价")}</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    </Fragment>
                  );
                })}
                {revokedList.length > 0 && (
                  <div className="pt-2">
                    <button onClick={() => setShowRevoked((v) => !v)} className="text-xs text-muted-foreground underline-offset-2 hover:underline">{T(`已撤回 ${revokedList.length} 份`, `${revokedList.length} revoked`)} · {showRevoked ? tx("收起") : tx("展开")}</button>
                    {showRevoked && revokedList.map((a) => (
                      <div key={a.id} className="mt-1 flex flex-wrap items-center gap-x-3 rounded-xl border border-dashed border-border px-4 py-2 text-sm text-muted-foreground line-through">
                        <span>{a.studentNick}</span><span>{a.title}</span><span className="ml-auto text-xs no-underline">{fmtDate(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== 课堂演示:底部选项目,这里配参数 ===== */}
            {/* ===== 指法教学 · 例题讲解(2026-11-02):老师自己输入例题 → 讲解模式(语音 + 算盘拨珠 + 手指动画) ===== */}
            {tab === "teach" && (
              <div>
              <button onClick={() => setTab("demo")} className="mb-3 text-sm font-bold text-[#6B5A45] hover:underline">← {tx("返回课堂演示")}</button>
              <div className="mx-auto max-w-3xl">
                <div className="hp-card p-4">
                  <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
                    <h2 className="text-lg font-black text-[#c0392b]">☰ {tx("例题讲解")}</h2>
                    <span className="text-sm text-muted-foreground">{tx("为学员讲解指定加减算题目的拨珠指法")}</span>
                  </div>
                  <TeachSetup onStart={(ps) => setTeachProblems(ps)} />
                </div>
              </div>
              </div>
            )}
            {teachProblems && <TeachStage problems={teachProblems} onClose={() => setTeachProblems(null)} onEdit={() => setTeachProblems(null)} />}

            {tab === "demo" && !projectPicked && (
              <div className="flex min-h-[60vh] flex-col items-center justify-center">
                {/* Pad App 里去掉标题行,两排旗一屏放下(2026-11-05 用户 Pad 录屏;网页不动) */}
                {!IS_NATIVE && <h2 className="hp-title mb-1 text-3xl font-black">{tx("选择演示项目")}</h2>}
                {!IS_NATIVE && <p className="mb-8 text-sm text-[#6B5A45]">{tx("点一面旗,配置参数后开始课堂演示")}</p>}
                {/* 2026-11-02 用户「其他地方的排版也注意,比如教练端课堂演示」:7 面旗宽屏一行;放不下时排成 4 + 3 两行,不再剩一面孤零零在第二行 */}
                <div className="coach-pennant-wrap">
                <div className="coach-pennants">
                  {([["flash", "#7A1F2B", "闪电侠"], ["listen", "#1F3A5F", "顺风耳"], ["glance", "#2E5A3C", "千里眼"], ["bead", "#4A2A5A", "算盘侠"]] as const).map(([id, color, hero]) => (
                    <Pennant key={id} color={color} size="lg" onClick={() => pickProject(id)}>
                      <Emblem id={id} emoji="🏃" />
                      <div className="mt-1 font-display text-xl font-bold tracking-[0.2em]">{tx(PROJECT_LABEL[id])}</div>
                      <div className="mt-0.5 text-[11px] tracking-[0.3em] opacity-85">{tx(hero)}</div>
                    </Pennant>
                  ))}
                </div>
                <div className="coach-pennants">
                  {([["scroll", "#8A5A1E", "飞毛腿"], ["obstacle", "#2F4A3B", "定海神针"]] as const).map(([id, color, hero]) => (
                    <Pennant key={id} color={color} size="lg" onClick={() => pickProject(id)}>
                      <Emblem id={id} emoji={id === "obstacle" ? "🌪️" : "🏃"} />
                      <div className="mt-1 font-display text-xl font-bold tracking-[0.2em]">{tx(PROJECT_LABEL[id])}</div>
                      <div className="mt-0.5 text-[11px] tracking-[0.3em] opacity-85">{tx(hero)}</div>
                    </Pennant>
                  ))}
                  {/* 2026-11-02 用户「指法教学放到课堂演示里面」:原独立 tab 改为课堂演示里的一面旗 */}
                  <Pennant color="#6B3A1E" size="lg" onClick={() => setTab("teach")}>
                    <Emblem id="teach" emoji="✋" />
                    <div className="mt-1 font-display text-xl font-bold tracking-[0.2em]">{tx("指法教学")}</div>
                    <div className="mt-0.5 text-[11px] tracking-[0.3em] opacity-85">{tx("例题讲解")}</div>
                  </Pennant>
                </div>
                </div>
              </div>
            )}
            {tab === "demo" && projectPicked && (
              <div className="hw-lg hw-compact hp-card p-4 md:p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="hp-title text-2xl font-black">{PROJECT_EMOJI[demoItem.project]} {tx(PROJECT_LABEL[demoItem.project])}</h2>
                  <span className="text-xs text-muted-foreground">{tx("下方换项目 · 演示中点屏幕暂停,右侧上下题")}</span>
                </div>
                <HwItemEditor value={demoItem} onChange={setDemoItem} hideProject />
                {/* 课堂演示字号也统一在配置里调(2026-11-03) */}
                {["flash", "glance", "scroll", "obstacle"].includes(demoItem.project) && <NumScaleRow className="mt-3 rounded-2xl border border-border bg-background/60 px-4 py-3" />}
                {/* 开始按钮:网页吸底(2026-10-13 用户:一屏放不下、得滑动才看到开始);
                    Pad App 内随页面滑动、不放「打印试题」(2026-11-05 用户 Pad 录屏:吸底挡内容;只改 Pad,网页不动) */}
                <div className={cn("mt-3 pt-1", !IS_NATIVE && "sticky bottom-[5.25rem]")}>
                  <button onClick={startDemo} className="hp-leather hp-leather-on flex w-full items-center justify-center gap-2 rounded-full py-3 text-lg font-black shadow-xl transition-transform hover:scale-[1.01]"><Play className="h-6 w-6" /> {tx("开始演示")}</button>
                  {!IS_NATIVE && demoItem.project !== "bead" && (
                    <button onClick={() => setPaperOpen(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#b08a52] bg-[#fbf5ea]/95 py-2.5 text-base font-black text-[#6b4a1f] shadow-md transition-transform hover:scale-[1.01] disabled:opacity-60">
                      <Printer className="h-5 w-5" /> {tx("打印试题")}
                      <span className="text-xs font-normal opacity-70">· {tx("先预览再下载")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 底部四个大按钮:闪算 / 听算 / 看算 / 数珠互译(参考助教软件的底栏交互) */}
      {tab === "demo" && projectPicked && <nav className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-[#B8925A]/40 bg-[#FBF5E6]/90 backdrop-blur">
        <div className="proj-nav container grid max-w-5xl grid-cols-6 gap-2 py-2">
          {PROJECT_BTNS.map((pb) => {
            const on = tab === "demo" && demoItem.project === pb.id;
            return (
              <button key={pb.id} onClick={() => pickProject(pb.id)}
                className={cn("hp-leather flex items-center justify-center gap-1.5 rounded-2xl py-2 text-sm font-black transition-transform hover:-translate-y-0.5 sm:py-3 sm:text-lg", on && "hp-leather-on")}>
                <span className="text-xl">{pb.emoji}</span>{tx(PROJECT_LABEL[pb.id])}
              </button>
            );
          })}
        </div>
      </nav>}

      <PaperPreview item={demoItem} open={paperOpen} onClose={() => setPaperOpen(false)} />
      {demo && <HomeworkRunner item={demo.item} problems={demo.problems} teach title={`${tx("课堂演示")} · ${itemLabel(demo.item)}`} onExit={() => setDemo(null)} />}
      <ResetPasswordDialog target={resetFor} onClose={() => setResetFor(null)} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
};

function StatusChip({ status }: { status: "todo" | "doing" | "done" }) {
  const tx = useTx();
  const m = { todo: ["未开始", "bg-muted text-muted-foreground"], doing: ["进行中", "bg-amber-400/20 text-amber-700"], done: ["已完成", "bg-emerald-400/20 text-emerald-700"] } as const;
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", m[status][1])}>{tx(m[status][0])}</span>;
}


export default Coach;
