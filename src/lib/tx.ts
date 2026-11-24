// 轻量翻译(2026-10-13 用户「切换英文版之后全局英文」):新页面/控件的中文文案 → 英文词典,
// 组件里 const tx = useTx(); 包一下字符串即可;没收录的词原样返回(中文)。老页面的 i18n 仍走 DICT。
import { useI18n } from "@/lib/i18n";
import { ZH_EN_PLAY } from "@/lib/tx-play";
import { ZH_EN_COACH } from "@/lib/tx-coach";
import { ZH_EN_EXAM } from "@/lib/tx-exam";

export const ZH_EN: Record<string, string> = {
  // 配置卡片
  项目: "Project", 运算: "Operation", 位数: "Digits", 笔数: "Terms", 题型: "Type", 每笔: "Per term", 语速: "Speed", 间隔: "Gap",
  报加号: "Say “plus”", 报数位: "Number reading", 语言: "Language", 音色: "Voice", 限时: "Time limit", 场数: "Rounds", 题量: "Questions",
  计算方法: "Method", 心算: "Mental", 珠算: "Abacus beads", "每一笔显示珠码,脑中拨珠(心算导入)": "each term shown as beads; move them in your head", 显示数字: "show digits",
  障碍算: "Obstacle", 干扰程度: "Distraction", 干扰类型: "Distractor", 低: "Low", 中: "Mid", 高: "High", 数码: "Digits", 形状: "Shapes", 填充形状: "Filled shapes", "数字在干扰中闪现,盯住有效的那一笔": "Numbers flash among distractors; track the live one",
  护眼: "Light", 深色: "Dark", 错题再练: "Redo mistakes",
  心算马拉松: "Mental Marathon", 整题用时: "Time per problem", 加速: "Speed up", 一道题所有数字出完的总时间: "total time for all numbers of one problem", 后面每题快: "each next problem faster by", 位小数: " decimals",
  "看着数字滚过,心里连续算": "Watch the numbers scroll by and keep the running total", 答案: "Answer",
  知识点: "Skill stage", 变式: "Variant", 全部: "All", 每一笔的指法都受本关约束: "every term follows this stage's fingering",
  小数: "Decimals", "随机小数位,数值在 0.01–100 之间": "random decimal places, values 0.01–100", 点: "point",
  特定乘数: "Multiplier digits", 进位组合: "Carry pattern", 特定除数: "Divisor digits", 够除: "Divisible", "够除 = 整除;不够除 = 除不尽,答案四舍五入到保留位数": "Divisible = no remainder; not divisible = answer rounded to the kept places", 不限: "Any", "十位进·个位进": "tens carry · ones carry", "十位进·个位不进": "tens carry · ones none", "十位不进·个位进": "tens none · ones carry", 都不进: "no carry", "进位 = 积满十:67×2 十位 6×2=12 进、个位 7×2=14 进;34×2 都不进": "carry = digit product ≥ 10: 67×2 → 6×2=12 carry, 7×2=14 carry; 34×2 → none", 保留: "round to", 答案保留: "Round answer to", 出题系统: "Worksheet maker", 看整页: "Whole page", 放大: "Zoom in", 换一批题: "New set", 试题: "Questions", 页: "pages", 缩放: "scaled", 取消下载: "Cancel", 确认下载: "Download", 先预览再下载: "preview first", "Excel 含试题和答案两张表;右上角二维码扫码看答案": "Excel has a questions sheet and an answer sheet; scan the QR code for answers", 打印试题: "Print worksheet", 试题已生成: "Worksheet ready", 生成失败: "Failed to generate", 右上角二维码扫码看答案: "scan the QR code (top right) for answers", 余: "R", "除不尽:填「商 余 余数」,如 22÷8 → 2余6": "Not divisible: enter quotient R remainder, e.g. 22÷8 → 2R6", "够除 = 整除;不够除 = 除不尽:无小数时答「商……余数」,有小数时答案四舍五入到保留位数": "Divisible = no remainder; not divisible: without decimals answer quotient R remainder, with decimals round to the kept places", "被除数、除数都是小数;商的位数含小数位(商4位·保留2位 → 12.34)": "Dividend and divisor are decimals; quotient digits include decimals (4 digits, 2 places → 12.34)", "随机小数位,数值在 0.01–100;答案四舍五入到保留位数": "random decimal places, values 0.01–100; answer rounded",
  乘数只用选中的数字: "Multiplier uses only these digits", "不选 = 随机": "none = random", "十位积 + 个位积 是否进位": "tens product + ones product carry?", "仅 2位×1位 可选": "only for 2×1 digits", 除数只用选中的数字: "Divisor uses only these digits", 两者均可: "Either", 不够除: "Not divisible",
  方向: "Direction", 呈现: "Display", 字号: "Font size", 音源: "Audio source", 报数: "Reading", 加号: "plus", 数位: "units",
  位: "digits", 笔: "terms", 秒: "s", 档: "level", 题: "q", 场: "rounds", 毫秒: "ms",
  最小: "min", 最大: "max", 被乘数: "multiplicand", 乘数: "multiplier", 除数: "divisor", 商: "quotient",
  纯加: "Add only", 加减混合: "Add & subtract", 加减: "Add/Sub", 乘法: "Multiply", 除法: "Divide",
  闪算: "Flash", 听算: "Listen", 看算: "Glance", 数珠互译: "Beads", 闪电心算: "Flash Math",
  "珠 → 数": "Beads → Number", "数 → 珠": "Number → Beads", 有: "On", 无: "Off", 整读带单位: "With units", 逐位读: "Digit by digit",
  中文: "Chinese", 女声: "Female", 男声: "Male", 童声: "Child", "C 普通话(推荐)": "C Mandarin (default)", "C 为母语普通话;A/B 为旧线路": "C = native Mandarin; A/B legacy", "D 豆包(推荐)": "D Doubao (default)", "E 豆包大词块(推荐)": "E Doubao whole-number (default)", "D 豆包": "D Doubao", "C 普通话": "C Mandarin", "D 为豆包 2.0;C 为 macOS 普通话;A/B 为旧线路": "D = Doubao 2.0; C = macOS Mandarin; A/B legacy",
  "0 = 不限时": "0 = no limit", "0 = 不限时;限时内竖式常驻,到点隐藏": "0 = no limit; column hides when time is up", "1 慢 · 5 正常 · 10 极快": "1 slow · 5 normal · 10 fastest",
  // 训练页
  开始挑战: "Start", 综合训练: "Training", "AI 陪练": "AI Coach", 只练错题: "Mistakes only", 训练配置: "Settings", 排行榜: "Ranks",
  "珠 → 数:看珠码报数字 · 数 → 珠:看数字拨珠码": "Beads→Number: read the beads · Number→Beads: set the beads",
  // 作答器
  退出: "Exit", 提交: "Submit", 清空: "Clear", 再听一遍: "Replay", 显示答案: "Show answer", "学生心算中…": "Students computing…", "算盘上是几?": "What number is this?",
  凭记忆填答案: "Answer from memory", "算出结果,填答案": "Compute and answer", 在算盘上拨出这个数: "Set this number on the beads", "当前拨出:": "Current: ", 确定: "OK",
  答对了: "Correct!", 答错了: "Not quite", 准备: "Ready", 开始: "Go", "请听题,用心算～": "Listen and compute", "准备中…": "Loading…",
  "看清算盘,记住数": "Memorize the beads", 已暂停: "Paused", 点击屏幕继续: "Tap to resume", 上一题: "Prev", 下一题: "Next", 时间到: "Time's up", "点屏幕或右侧「显示答案」揭晓": "Tap the screen or use “Show answer” on the right", "右侧「显示答案」或回车揭晓": "Use “Show answer” on the right or press Enter", 重播: "Replay", 暂停: "Pause", 继续: "Resume",
  本项完成: "Done", "错题重做": "Redo mistakes", "完成 · 交作业": "Finish & submit", "先交作业,稍后再练": "Submit now, practice later", 下一项: "Next", 广场: "Home", 已保存到: "Saved to", "交作业 · 回清单": "Submit & back to list", 课堂演示: "Classroom demo",
  "本轮成绩已记录;错题再做的每一轮也会记录,教练都看得到。": "This round is saved; every redo round is saved too and visible to your coach.",
  "词块语音库暂不可用,已用浏览器语音兜底": "Audio bank unavailable; using browser speech",
  // 教练端 / 作业
  小: "S", 大: "L", 教练端: "Coach Console", 珠象教练端: "Zhuxiang Coach", 班级管理: "Class", 布置作业: "Assign", 完成情况: "Progress", 开始演示: "Start demo", 选择演示项目: "Pick a project",
  "点一面旗,配置参数后开始课堂演示": "Pick a banner, set the parameters, then start", "下方换项目 · 演示中点屏幕暂停,右侧上下题": "Switch below · tap to pause · prev/next on the right",
  我的作业: "My Homework", 登录: "Log in", "登录 / 注册": "Log in / Sign up", 退出登录: "Log out", 修改密码: "Change password", 待完成: "To do", 已完成: "Completed", 我的教练: "My coach", "本账号不属于任何教练": "Not in any coach's class", 再练一遍: "Practice again",
};

// 分册词典(2026-10-27):练习页 / 教练与作业 / 出题系统 各一份,合并查找(分册优先)
const ALL_EN: Record<string, string> = { ...ZH_EN, ...ZH_EN_PLAY, ...ZH_EN_COACH, ...ZH_EN_EXAM };

export function useTx(): (s: string) => string {
  const { lang } = useI18n();
  return (s: string) => (lang === "en" ? (ALL_EN[s] ?? s) : s);
}
