// 英文词典分册(coach 区域,2026-10-27 全站英文补齐)。键 = 界面上的中文原文,值 = 英文;tx.ts 合并进 ZH_EN。
// 范围:教练端 /coach、学生作业 /homework、作答器 HomeworkRunner、参数编辑器 HwItemEditor、账号菜单 / 登录注册弹窗。
export const ZH_EN_COACH: Record<string, string> = {
  // ===== 通用 =====
  "加载中…": "Loading…", 保存: "Save", 取消: "Cancel", 删除: "Delete", 新建: "Create", 搜索: "Search", 改名: "Rename",
  收起: "Hide", 展开: "Show", 全选: "Select all", 今天: "Today", 日期: "Date", 标题: "Title", 完成: "done",
  学生: "Student", 班级: "Class", 教练: "Coach", 姓名: "Name", 登录名: "Login", 未分班: "Unassigned",

  // ===== 教练端:提示 =====
  加入失败: "Couldn't add", 新建班级失败: "Couldn't create class", 保存失败: "Couldn't save", 删除失败: "Couldn't delete",
  移动失败: "Couldn't move", 移出失败: "Couldn't remove", 加回失败: "Couldn't add back", "密码至少 6 位": "Password must be at least 6 characters",
  重置失败: "Reset failed", "把新密码告诉学生即可登录。": "Give the student the new password to log in.", 账号配额已用完: "No account seats left",
  添加失败: "Couldn't add", 请至少选一天: "Pick at least one day", 布置失败: "Couldn't assign", 撤回失败: "Couldn't revoke",
  "学生端刷新即看到新内容。": "Students see the update after refreshing.", 评价失败: "Couldn't send review", 评价已发送: "Review sent",
  "请先登录已开通教练权限的账号。": "Please log in with an account that has coach access.",
  已沿用: "Copied",

  // ===== 班级管理 =====
  我的班级: "My classes", "新班级名,如 周六上午班": "New class name, e.g. Sat AM",
  "近 7 天作业完成": "7-day completion", "点班级只看这个班的成员;分班后,布置作业可以按班一键勾选。": "Tap a class to see only its members. Once grouped, you can select a whole class when assigning.",
  班级成员: "Members", 看全部: "Show all", "还没有成员,在上方添加。": "No members yet. Add students below.",
  已有账号: "Existing account", 重置密码: "Reset password", 移出: "Remove", 移到班级: "Move to class", 已移出: "Removed", 加回班级: "Add back",
  添加学生: "Add students", "给学生建账号 · 或加入已有账号": "Create student accounts · or add existing ones",
  "添加成员(给学生建账号)": "Add member (create a student account)",
  "填姓名、登录名、密码并选班级;建好后把登录名和密码告诉学生,学生在首页登录框输入即可,登录后直接进作业页。":
    "Enter a name, login name and password, and pick a class. Then give the student the login name and password — they log in on the home page and land on their homework.",
  学生姓名: "Student's name", "登录名(字母/数字/下划线,3–20 位)": "Login name (letters/digits/underscore, 3–20)", "如 2024001": "e.g. 2024001",
  "密码(至少 6 位)": "Password (at least 6)", 学生用它登录: "Student logs in with this", "年龄(可选,等级鉴定分组用)": "Age (optional, for certification groups)", "如 8": "e.g. 8",
  "添加中…": "Adding…", 配额已满: "No seats left", 添加成员: "Add member", "学生忘了密码,在下方名单点「重置密码」即可。": "Forgot password? Use “Reset password” in the member list.",
  添加已有账号: "Add an existing account",
  "学生自己注册过、或之前从班里移出的账号,按昵称搜索后直接加入,不占建号配额,学生无需操作。":
    "For students who signed up themselves or were removed earlier: search by nickname and add them. Doesn't use a seat; nothing for the student to do.",
  输入昵称关键字: "Search nickname", 没有匹配的账号: "No matching accounts", 已在班里: "Already in class", 加入班级: "Add to class",

  // ===== 布置作业 =====
  给谁布置: "Assign to", "还没有学生,先到「班级管理」添加。": "No students yet. Add them under “Class” first.",
  "每个学生收到的是独立一份;想给不同学生不同内容,就分别布置。": "Each student gets their own copy. To give different students different work, assign separately.",
  作业日期: "Homework dates", 点击取消: "Click to remove", "全选 7 天": "All 7 days", 只选今天: "Today only", 指定日期: "Pick a date",
  "选任意一天(含 7 天以后)加入": "Add any day (including beyond 7 days)",
  "每一天都是独立一份同样内容的作业,学生当天才能开始做;一周一次课时一次布置好 7 天。": "Each day is a separate copy of the same homework; students can start it only on that day. For weekly classes, assign all 7 days at once.",
  作业标题: "Homework title", "给学生的话(可选)": "Note to students (optional)", "例:今天重点练退位减,错题一定要再做一遍。": "e.g. Focus on borrowing subtraction today; redo every mistake.",
  作业内容: "Homework items", 沿用最近布置过的作业内容: "Reuse a recent homework", "沿用最近作业…": "Reuse recent…", 添加项目: "Add item",
  "← 先在左边选学生": "← pick students first", "← 先选作业日期": "← pick dates first", "发布中…": "Publishing…", 发布作业: "Publish",

  // ===== 完成情况 =====
  "近 7 天": "7 days", "近 30 天": "30 days", 选某一天: "Pick a day", 全部班级: "All classes", 全部学生: "All students",
  "📊 总览表": "📊 Overview", "📋 逐份明细": "📋 Details",
  "还没布置过作业。": "No homework assigned yet.", "这个范围内没有作业,换个日期或学生试试。": "No homework in this range. Try another date or student.",
  "完成 · 正确率": "Done · Accuracy", 未做: "Missed",
  "格子:绿 = 完成且正确率 ≥80%,黄 = 完成但正确率低 / 做了一部分,红 = 过了日期没做;点格子看那一份的明细并写评价。最多显示最近 60 个作业日。":
    "Cells: green = done with ≥80% accuracy; yellow = low accuracy or partly done; red = missed after the due date. Click a cell for details and to leave a review. Shows up to the last 60 homework days.",
  正确率: "Accuracy", 用时: "Time", 直接编辑: "Edit", 撤回这一份: "Revoke this one", 给学生的话: "Note to students",
  "学生已做的项目按序号继续对应;删掉的项目其记录不再显示。": "Finished items stay matched by position; records of deleted items are hidden.",
  未开始: "Not started", 进行中: "In progress", 首做: "First try", 教练评价: "Coach review",
  "一句话评价,学生在作业页能看到": "A short comment — the student sees it on their homework page", 更新评价: "Update review", 发送评价: "Send review",

  // ===== 课堂演示:今日概况 + 选旗 =====
  今日作业: "Today's homework", 平均正确率: "Avg accuracy", "需要关注(未完成 / 正确率 < 80%)": "Needs attention (unfinished / accuracy < 80%)",
  看完成情况: "See progress", "全部完成且正确率都不错 👍": "All done with good accuracy 👍", 今天还没布置作业: "No homework assigned for today",
  闪电侠: "The Flash", 顺风耳: "Clairaudient", 千里眼: "Clairvoyant", 算盘侠: "Abacus Hero", 飞毛腿: "Swift Feet", 定海神针: "Unshakable",

  // ===== 参数编辑器:知识点(七关)/ 变式 / 口诀 =====
  直加直减: "Direct +/−", 满五加: "Five-complement +", 破五减: "Five-complement −", 进位加: "Carry +", 破五进位加: "Five & carry +", 退位减: "Borrow −", 退位满五减: "Borrow & five −",
  加1: "+1", 加2: "+2", 加3: "+3", 加4: "+4", 加6: "+6", 加7: "+7", 加8: "+8", 加9: "+9",
  减1: "−1", 减2: "−2", 减3: "−3", 减4: "−4", 减6: "−6", 减7: "−7", 减8: "−8", 减9: "−9",
  "8、7": "8, 7", "6、5": "6, 5", "4、3": "4, 3", "2、1": "2, 1",
  "珠够,直接拨/直接去": "Enough beads: just add / remove them directly",
  "下珠不够加,把5拨上来、去掉多余下珠(凑成5)": "Not enough lower beads: bring down the 5-bead and remove the extra lower beads (make 5)",
  "下珠不够减,把5拨走、还回若干下珠(拆开5)": "Not enough lower beads to subtract: lift the 5-bead and add back lower beads (break the 5)",
  "本档满十、补数能直接去(6+5、8+2 也算本关)": "The rod reaches ten and the complement can be removed directly (6+5, 8+2 count too)",
  "满十,且去补数时下珠不够、必须拆5(如 5+7、6+6)": "Reaches ten, and removing the complement needs breaking the 5 (e.g. 5+7, 6+6)",
  "本档不够减,退1还补数(12−5 还的正是5珠,也算本关)": "Not enough on the rod: borrow 1 and add back the complement (12−5 adds back the 5-bead; counts too)",
  "退1后还补数时下珠不够、要借5(如 12−6、12−7)": "After borrowing 1, adding back the complement needs the 5-bead (e.g. 12−6, 12−7)",

  // ===== 学生作业页 =====
  "云端暂存失败,已存在本机": "Cloud save failed; saved on this device", 成绩上传失败: "Couldn't upload results",
  "用教练给你的登录名和密码登录,作业就在这里;做完立刻看到对错,错题可反复练,教练会给评价。":
    "Log in with the login name and password from your coach. Your homework is here: see right/wrong instantly, redo mistakes as often as you like, and get your coach's review.",
  待做: "To do", 连续练: "Streak", "7天正确率": "7-day accuracy", "7天完成": "7-day done",
  "账号由教练创建并归班,无需自行加入": "Your coach created this account and class — nothing to join",
  "太棒了,作业都做完了 🎉": "Awesome, all homework done 🎉", "用教练给你的登录名登录后,作业会出现在这里。": "Log in with the login name from your coach and your homework will show up here.",
  自由练习: "Free practice", "不计入作业 · 想多练就点": "Not counted as homework · just for extra practice",
  后面几天: "Coming up", 到当天才能开始: "opens on its day", 已修改: "Edited", 当天开放: "Opens that day",
  "教练评价:": "Coach review:", "继续加油!": "Keep it up!",

  // ===== 作答器 =====
  做完至少一题才能暂存: "Answer at least one question to save", 暂存: "Save",
  "暂停/继续(空格)": "Pause/Resume (Space)", "显示答案(回车)": "Show answer (Enter)", "护眼:浅色舞台": "Eye-care: light stage",

  // ===== 账号菜单 =====
  两次输入不一致: "Passwords don't match", 修改失败: "Couldn't change password", 密码已修改: "Password changed", "下次登录请用新密码。": "Use the new password next time you log in.",
  玩家: "Player", 昵称已更新: "Nickname updated", 昵称: "Nickname", 未设置: "Not set",
  "设置一个新密码(至少 6 位),立即生效。": "Set a new password (at least 6 characters). Takes effect immediately.",
  新密码: "New password", 再输一遍: "Repeat password", "修改中…": "Saving…", 确认修改: "Change password",

  // ===== 登录 / 注册弹窗 =====
  "请输入手机号 / 邮箱 / 登录名": "Enter phone / email / login name", 请输入密码: "Enter your password",
  "请输入有效的手机号、邮箱或登录名": "Enter a valid phone number, email or login name", 欢迎回来: "Welcome back", 登录失败: "Login failed",
  请填写名字: "Please enter your name", "请填写年龄(3-99 周岁)": "Please enter your age (3–99)", 注册成功: "Signed up", "已自动登录。": "You're logged in.", 注册失败: "Sign-up failed",
  "请输入 11 位有效手机号": "Enter a valid 11-digit mobile number", "请输入 10 位有效号码": "Enter a valid 10-digit number", 邮箱格式不正确: "Invalid email address",
  "该手机号已注册,请直接登录。": "This phone number is already registered. Please log in.", "账号或密码错误。": "Wrong account or password.",
  "账号未激活(后台需关闭邮箱确认),请联系管理员。": "Account not activated (email confirmation must be turned off). Please contact the admin.",
  "操作过于频繁,请稍后再试。": "Too many attempts. Please try again later.", 操作失败: "Something went wrong",
  "注册成功,但无法自动登录(后台可能开启了邮箱确认,需关闭)。": "Signed up, but couldn't log in automatically (email confirmation may be on and needs to be turned off).",
  "网络连接不上服务器,请检查网络后重试(可换 Wi-Fi 或手机流量试试)。": "Cannot reach the server. Check your network and try again (try Wi-Fi or mobile data).", "返回课堂演示": "Back to classroom demo", "指法教学": "Fingering", "例题讲解": "Worked examples", "复制编辑": "Copy & edit", "复制为新作业": "Copy as new homework", "原作业不会改动。": "The original stays unchanged.", "原作业保持不变。": "The original is unchanged.", "发布失败": "Assign failed", "欢迎来到珠象": "Welcome to Zhuxiang", "登录后成绩将同步到云端排行榜。": "Log in to sync your scores to the cloud leaderboard.",
  注册: "Sign up", "手机号 / 邮箱 / 学生登录名": "Phone / email / student login", "手机号、邮箱,或教练给的登录名": "Phone, email, or the login name from your coach",
  密码: "Password", 输入密码: "Enter password", 名字: "Name", "你的名字(排行榜显示)": "Your name (shown on leaderboards)", 手机号: "Phone",
  "11 位手机号": "11-digit mobile number", "10 位号码": "10-digit number", "年龄(周岁)": "Age", "等级鉴定按年龄分组,如 8": "Used for certification age groups, e.g. 8",
  邮箱: "Email", 请填写你的邮箱: "Your email", "设置密码(至少 6 位)": "Password (at least 6)", 设定登录密码: "Choose a password", 注册并登录: "Sign up & log in",
  // 密码框小眼睛 / 重置密码弹窗(2026-10-29)
  显示密码: "Show password", 隐藏密码: "Hide password", 登录账号: "Login", "新密码(至少 6 位)": "New password (at least 6 characters)",
  首尾的空格会自动去掉: "Leading/trailing spaces will be removed", "重置中…": "Resetting…",
  "已重置。把下面的账号和密码原样告诉学生:": "Done. Give the student exactly this login and password:", 账号: "Account",
  "登录时注意大小写,前后不要带空格。": "Passwords are case-sensitive; no spaces before or after.", 已复制: "Copied", 复制: "Copy",
  // 海外手机号注册/登录(2026-10-29)
  "国家/地区": "Country/region", "其他(填区号)": "Other (enter code)", 区号: "Country code", "+区号": "+code", 手机号码: "Mobile number",
  海外手机号请在前面加区号: "Add the country code for non-China/US numbers", "例如 +44 7911123456、+852 61234567": "e.g. +44 7911123456 or +852 61234567",
  "手机号(海外加区号 +44…)、邮箱或登录名": "Phone (+country code outside CN/US), email, or login name",
  常用: "Common", "全部国家/地区": "All countries/regions",
  // 作答鼓励(2026-10-29)
  鼓励: "Cheers", 关掉鼓励语音: "Turn off encouragement voice", 打开鼓励语音: "Turn on encouragement voice",
  语音: "Voice", 特效: "Effects", 关掉答题特效: "Turn off answer effects", 打开答题特效: "Turn on answer effects",
  // 登录门槛(2026-11-01)
  登录后才能使用: "Please log in to continue", "练习成绩、错题和进度都会保存在你的账号里。": "Your scores, mistakes and progress are saved to your account.", 返回首页: "Back to home",
  // 完成情况加载(2026-11-02)
  "网络不稳定,有些成绩没有加载出来。这不代表学生没做,请点重试。": "Connection problem: some results didn't load. This doesn't mean students didn't do the work. Please retry.", 重试: "Retry", "正在加载学生的完成情况…": "Loading student progress…",
};

// 英文模式下的时长 / 日期格式(homework.ts 的 fmtDur 只出中文,这里补英文版)
export const fmtDurEn = (ms: number): string => (ms < 60000 ? `${(ms / 1000).toFixed(0)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);
export const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
