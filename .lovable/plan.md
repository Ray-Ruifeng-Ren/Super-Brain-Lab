
# 闪电心算 · 练习记录 & 错题本

先在「闪电心算」落地，跑通后再推广到其他项目（障碍闪电心算等结构相似的游戏可复用同一套表）。

---

## 一、数据层（Lovable Cloud）

新增一张表 `practice_attempts`，记录每一次单题作答：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | 当前登录用户 |
| game | text | 如 `flashmath` / `gauntlet` |
| mode | text | 题目配置串（笔数x位数-速度+减号），便于复练相同档位 |
| terms | int[] | 题面数字 |
| signs | text[] | `+` / `-` |
| answer | int | 正确答案 |
| user_answer | int \| null | 用户填的答案（超时为 null） |
| correct | bool | |
| used_ms | int | 答题用时 |
| created_at | timestamptz default now() | |

RLS：用户只能 select/insert 自己的行；service_role 全权。配套 GRANT。

> 不动 `scores` 表，原有排行榜逻辑保持不变。

---

## 二、写入时机

在 `FlashMathGame.tsx` 提交答案的位置追加一次 `insert`（与现在写 `scores` 的位置并列）。失败静默（不阻塞游戏）。

---

## 三、UI（在 /play/flashmath 页面底部新增一块「训练日志」区域）

为了"简洁"，把两个板块合到一个卡片里，用 Tabs 切换：

```text
┌─ 训练日志 ──────────────────────────┐
│ [ 练习记录 ] [ 错题本 ]             │
│─────────────────────────────────────│
│ Tab 1: 练习记录                     │
│   ┌───────────┐  今日 18 题         │
│   │  日历     │  ✓ 14   ✗ 4        │
│   │ (有点的日 │  正确率 78%         │
│   │  期高亮)  │  本周 92 题         │
│   └───────────┘  累计 514 题        │
│                                     │
│ Tab 2: 错题本                       │
│   [ 只练错题 ] 开关 → 启用后开始游戏 │
│   会从错题池抽题                    │
│   ─────                             │
│   错题列表（最近 50 条，可翻页）：   │
│   • 3+7-2 = 8   你答: 9   2小时前   │
│   • 25+18 = 43  超时              │
│   ...                               │
└─────────────────────────────────────┘
```

技术点：
- 日历用现有 shadcn `Calendar`，通过 `modifiers` 给"有练习的日子"加圆点 marker
- 统计用一次 `select created_at, correct` 然后前端 groupBy 日期（数据量不大）
- 错题列表：`select * where correct = false order by created_at desc limit 50`
- "只练错题"用 localStorage 标记 `flashmath:practice-mistakes-only=true`；游戏开始时若开启，则用错题池里的 `terms/signs` 直接喂给 `Stage`，跳过随机生成

---

## 四、文件改动

- 新建 migration：建表 + GRANT + RLS
- 新建 `src/lib/practiceLog.ts`：封装写入、读取、按日聚合、错题查询
- 新建 `src/components/PracticeLog.tsx`：上述 Tabs 卡片（日历 + 错题本）
- 改 `src/components/games/FlashMathGame.tsx`：
  - 答题处写入 `practice_attempts`
  - 支持 `mistakePool` props，从错题复练
- 改 `src/pages/Play.tsx`：在 flashmath 路由下渲染 `<PracticeLog game="flashmath" />`

---

## 五、范围说明

- 本轮**只接入闪电心算**。如果效果 OK，下一轮把同一个 `<PracticeLog game="..." />` 挂到障碍闪电心算等游戏（数据已通用，只需要在对应游戏里加一次 insert）。
- 错题"复练"先做最简单版本：从最近 N 道错题里随机抽 `count` 道，凑够当前配置的笔数，不重新生成新题。

---

确认这个方向就开干。
