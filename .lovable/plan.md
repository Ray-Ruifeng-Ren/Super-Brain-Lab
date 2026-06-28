
# Index 首页升级 · "Super Brain Lab" 高级感重塑

## 一、目标拆解

1. **背景**：去掉死板网格、升级散点动效，换成一个"会律动的大脑"作为视觉锚点。
2. **布局**：取消"次屏拼凑感"——首屏一次性呈现 7 个项目，去掉"专注/速算/记忆/量化"卖点段落。
3. **品牌叙事**：体现 Super Brain Lab 的"实验室 / 研究院"高级感，而不是产品官网堆叠。

---

## 二、视觉与背景方案

### 1. 律动大脑（核心视觉）
做法：使用 **Three.js + react-three-fiber** 渲染一个由发光节点 + 神经突触线条组成的 **半透明大脑点云**，居中靠右悬浮。
- 大脑由 ~2500 个粒子按"大脑剪影"分布（用一张大脑轮廓 mask 图采样坐标，或加载一个低面数 brain.glb 顶点）；
- 节点按 **正弦呼吸 + 柏林噪声漂移** 持续律动（≈ 0.6Hz，模拟脑电节律）；
- 鼠标靠近时，附近节点"突触放电"——沿邻近节点亮起一条传导光线，2s 后衰减；
- 全局色：深墨绿背景 (`hsl(160 30% 6%)`) + 主色翠绿光晕，配少量青色冷光高亮——契合现有 emerald 主题，且区别于常见 indigo/紫色 AI 风。

### 2. 替换网格
删除当前 40px × 40px 网格层。改为一层 **极淡的等高线/拓扑纹理**（SVG 噪声 + 1% 透明度径向遮罩），只在视觉边缘隐约出现，不抢主体。

### 3. 散点优化
保留 NeuralCanvas 作为大脑"外围漂浮粒子"，但：
- 降低数量到 40，提高单粒子尺寸 + 模糊；
- 移除当前线连（线连只留给中央大脑），让外围更像"灵感火花"而非"星空"；
- 加入 mouse parallax（背景跟随鼠标 ±8px 缓动）。

---

## 三、布局方案 · 一屏式 Lab Console

取消"首屏 + 次屏"双段结构，重新组织为 **单屏 Lab Dashboard 风格**（≥1280×800 一屏看完，更小屏纵向滚动短一段即可）。

```
┌─────────────────────────────────────────────────────────────────┐
│ 顶部公告条：速算冠军 × MIT · Super Brain Lab Research Consortium │
├─────────────────────────────────────────────────────────────────┤
│ Header: ◉ Super Brain Lab        [EN/中]  [Account]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [LAB · 02]                              ╭──────────────╮       │
│  Quantify                                │              │       │
│  the limits of                           │   律动大脑    │       │
│  human cognition.                        │   (3D 点云)  │       │
│                                          │              │       │
│  一句副标 · 实验室定位                    ╰──────────────╯       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ── MODULES · 07 ─────────────────────────────────  EST. 2026 ── │
│                                                                  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐              │
│  │ 01 │ │ 02 │ │ 03 │ │ 04 │ │ 05 │ │ 06 │ │ 07 │              │
│  │Flash│ │Gaunt│ │Schul│ │React│ │Nback│ │Card│ │Orbit│         │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 关键改动
- **Hero 高度**改为 `min(680px, 70vh)`，给下方 7 项目卡片留出同屏空间；
- **7 个项目卡**：横向 7 列（`lg:grid-cols-7`，中屏 `md:grid-cols-4`，小屏 2 列）。卡片极简化——只显示编号 / 名称 / 一行 tagline，hover 时展开描述、出现一条进度条状光线。第一个（Flash Math）默认作为 **Today's Pick** 高亮（边框 + 微光）；
- **删除 Values 区段**（专注/速算/记忆/量化 三栏） + **删除独立 Featured Card**——featured 状态合并到首张项目卡的"今日推荐"高亮里；
- 底部 footer 极简化为一行（保留版权 + 语言/账户已经在顶部）。

### 视觉细节（实验室质感）
- 模块标题用 `── MODULES · 07 ───────── EST. 2026 ──` 这种 **分隔尺线 + 等宽编号** 排版，类似建筑/实验室档案；
- 所有数字、tag 用 `font-mono-tabular`，全部大写 + 0.2em 字距；
- Hero 大标题改双行：`Quantify` + `the limits of human cognition.` —— 比当前 "Today's Pick / Flash Math" 更具品牌野心；
- 公告条加入小型 system status 风格 token：`◉ LIVE · CONSORTIUM 2026` 这种细节让它更像研究院公告而非营销 banner。

---

## 四、技术细节（给开发者看）

### 新增依赖
- `three@^0.160`
- `@react-three/fiber@^8.18`
- `@react-three/drei@^9.122`

（按平台 react-three-fiber 知识卡固定上述版本，兼容 React 18）

### 文件变更
- **新增** `src/components/hero/BrainField.tsx` —— R3F Canvas，包含：
  - `<Points>` 大脑点云 geometry（程序化生成：用球面 + 噪声压扁出脑半球，左右对称两瓣）；
  - `useFrame` 中按 `sin(t * 2π * 0.6)` 做整体呼吸缩放 ±3%；
  - 顶点 shader 加 fbm 漂移 + mouse uniform 做局部突触脉冲；
  - 自动检测 WebGL 失败 → 回退为现有 `NeuralCanvas`。
- **修改** `src/components/hero/NeuralCanvas.tsx` —— 减少粒子数、关闭线连、仅作为外围氛围层；新增 mouse parallax。
- **重写** `src/pages/Index.tsx`：
  - Hero 段落改为左字 + 右大脑，删除 Featured 卡；
  - 新增 `<ModulesGrid />` 7 列布局，把当前 featured + secondary 合并为单一数组；
  - 删除 `<Value />` 区段与底部多段 main；
  - Hero 高度收缩为 70vh。
- **新增 i18n key**（`src/lib/i18n.tsx`）：
  - `hero_h1_a = "Quantify"` / `量化`
  - `hero_h1_b = "the limits of human cognition."` / `人类认知的边界。`
  - `lab_tag = "LAB · 02"`
  - `modules_meta = "EST. 2026"`
  - 删除/废弃 `cloud_lb / voice / sci` 等 Values 文案的引用（保留 key 以防其他页用到）。

### 性能保险
- 大脑点云粒子数：桌面 2500、移动 800；
- R3F `dpr={[1, 1.5]}`、`frameloop="always"` 但 visibilitychange 暂停；
- 滚动 30% 后大脑 `opacity → 0.4` 并停止 raf（用 IntersectionObserver），避免下方阅读时持续耗电。

---

## 五、范围以外（不动）
- 配色 token、字体、shadcn 组件库、路由 — 全部沿用；
- `/play/*` 内部页面布局不动；
- AccountMenu / LanguageToggle / ScrambleText 复用。

---

## 六、交付节奏
一次性交付，无需分阶段。完成后我会用 Playwright 截图首屏，确认"大脑 + 7 卡单屏"实际效果再回报。

