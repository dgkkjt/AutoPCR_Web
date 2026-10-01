# AutoPCR_Web 移动端（手机端）界面重设计方案

> 设计基准宽度 390px · 兼容 375 / 430px · 触控热区 ≥ 44px · 与桌面端品牌视觉一致

---

## 0. 现状技术盘点

| 项 | 现状 |
|---|---|
| 技术栈 | React 18 + Vite 5 + TypeScript + **Chakra UI v3** + @tanstack/react-router（文件路由）+ next-themes + react-icons + nice-modal-react |
| 路由 | `/daily/login`、`/daily/validate`、`/daily/_sidebar/account/`（首页）、`/daily/_sidebar/account/$account`（账号详情）、`/daily/_sidebar/user/`（用户管理，仅 admin） |
| 响应式覆盖 | **全仓库仅 1 处**：`src/components/SideBar/Index.tsx:42 / :103` 的 `useBreakpointValue({ base: true, md: false })`（窄屏把导航文字收成图标） |
| 视口配置 | `index.html` 无 `viewport-fit=cover`，无 `env(safe-area-inset-*)`，无 `100dvh` |
| 结论 | 当前是**桌面优先**的后台管理界面，移动端处于"能打开、不好用"级别 |

---

## 1. 现状梳理：重点改造页面与核心问题

### P0 — 必修

| # | 页面 | 文件 | 核心问题 |
|---|---|---|---|
| 1 | **首页 / 账号一览** | `src/components/Account/DashBoard.tsx` | ① **布局拥挤**：欢迎卡 + 批量操作条 + 视图/账号操作条三段工具栏纵向叠加约 200px，390px 下首屏看不到任何账号卡片；② **热区过小**：大量 `size="xs"` 按钮（约 24–28px），远低于 44px；③ **快捷功能无限横排**：`quickActions` 动态按钮在 390px 下折成 5–6 行；④ **卡片密度错配**：`SimpleGrid minmax(280px,1fr)` 在 375/390 下退化为单列，但卡片仍是桌面三段式（Header/Body/Footer），留白浪费；⑤ **表格视图不可用**：4 列 + sticky header 在移动端横向溢出；⑥ `window.confirm` 原生弹窗（删除账号）在移动端体验割裂 |
| 2 | **账号详情** | `src/routes/daily/_sidebar/account/$account.tsx` | ① **导航层级混乱**：`Tabs.List` 同时承担"导航"与"操作区"，塞入「只显示收藏 / 清理全部日常 / 弹结果 / 状态 Tag」，只能靠 `overflowX="auto"` 横向滚动；② 区服数量 > 3 时 Tab 几乎不可见；③ 操作控件与 Tab 争抢同一行 |
| 3 | **账号卡片** | `src/components/Account/AccountCard.tsx` | ① 删除 `IconButton` 为 `1.5rem`（24px）且**紧邻"整卡点击进详情"**——误删与误入并存；② `renderActionButtons` 四个 `xs` 图标按钮并排、`gap=1`（4px），手指必然误触；③ 卡片内 `maxW` 百分比截断逻辑在窄屏下易挤压别名 |
| 4 | **全局导航** | `src/components/SideBar/Index.tsx` | ① 名为 SideBar 实为**顶栏**，主页面切换全靠顶部图标；② 窄屏仅留图标无文字标签，可发现性差；③ **无底部导航**，单手不可达；④ 「登出」为一级项且无二次确认 |
| 5 | **用户管理** | `src/components/Users/Index.tsx` | ① 标题与两个操作按钮同行挤压；② `CloseButton size="sm"`（24px）删除热区过小；③ `SimpleGrid minmax(280px)` 单列后卡片内 Switch/Checkbox 行高过密 |
| 6 | **基础设施** | `index.html` / `theme.ts` | ① 无 `viewport-fit=cover` → 刘海与 Home Indicator 遮挡；② `html { overflow-y: scroll; scrollbar-gutter: stable }` 在移动端制造幽灵滚动槽；③ `height="100vh"`（SideBar）在 iOS Safari 地址栏收放时错位 |

### P1 — 建议同批改

| 页面 / 组件 | 问题 |
|---|---|
| `routes/daily/login.tsx` | 已有响应式（品牌区 `md` 以下隐藏），但输入框/按钮未放大到移动规格；主题切换按钮 `position:absolute top:4 right:4` 与刘海/安全区冲突 |
| `components/Account/Area.tsx` + `Toc.tsx` | 目录 TOC 为**右侧 fixed 悬浮 Popover**，移动端遮挡正文、触发热区约 40px，Popover 定位在小屏易出界 |
| `components/Account/Module.tsx` | 模块卡展开后配置项密集，无移动端行高/分组 |
| `components/ui/tooltip.tsx` 依赖方 | `Tooltip` 沿用 hover 语义，触屏不触发，"清理/导入/同步/结果"四个图标按钮**在移动端没有任何文字说明** |
| `RunningStatus` / `ScheduleNotify` | `compact` 模式信息缺失，窄屏下语义不清 |

---

## 2. 重设计方案

### 2.1 信息架构调整

```
AutoPCR Mobile
├─ 登录 / 人机验证（无框架页，独立适配）
└─ 主框架（Bottom Tab × 3）
   ├─ 首页：执行视角 —— 执行目标切换 + 主 CTA + 快捷功能 + 账号状态列表
   │        └─（点卡片）→ 账号详情（二级页，无 TabBar，顶部返回）
   ├─ 账号：配置视角 —— 账号列表 → 同一详情页，但默认落在「账号信息」Tab
   └─ 我的：安全（修改密码 / 使用须知 / 注销 QQ）、主题模式、
            用户管理（仅 admin）、登出（二次确认）
```

**关键调整**
1. **用户管理从一级导航下沉至「我的」**——低频且仅管理员可见，不应占据主导航。
2. **登出移入「我的」并加二次确认**，不再是一级即触发项。
3. **首页只保留高频动作**：执行目标切换、清理全部日常、快捷功能；视图切换/导入 TSV/注销 QQ 等收进「⋯」溢出面板。
4. **账号详情的「导航」与「操作」分离**：区服 Tab 只做导航，操作下移为独立操作行。
5. **移动端下线表格视图**（`VIEW_MODE_KEY` 在 <768px 强制卡片流），表格仅在桌面提供。

### 2.2 页面结构与组件清单

| 页面 | 区块（自上而下） | 组件 | 来源 |
|---|---|---|---|
| 首页 | 状态栏安全区 | `SafeArea` | 新增 |
| | 顶栏（品牌标 + 主题切换） | `AppBar` | 新增（复用 logo 与 `color-mode`） |
| | 问候条（QQ + 「⋯」溢出） | `GreetingBar` | 改造 `DashBoard.tsx` 欢迎卡 |
| | 执行目标切换（全部 / 默认 / 已选 N） | `SegmentedControl` | 新增 |
| | 主 CTA「清理全部日常」 | `Button`（h=48） | 复用 Chakra Button |
| | 快捷功能 chip 横滑 + 编辑入口 | `ChipScroller` | 新增 |
| | 账号卡片流（单列） | `AccountCardMobile` | 新增（替代 `AccountInfo` 桌面分支） |
| | 新建账号（虚线全宽按钮） | `Button` | 复用 |
| | 底部 Tab（首页/账号/我的） | `BottomTabBar` | 新增 |
| 账号详情 | 返回顶栏（标题 + 状态 + 「⋯」） | `AppBar` | 新增 |
| | 区服 Tab 横滑（只做导航） | `ScrollTabs` | 新增（替代 `Tabs.List` 混装） |
| | 操作行（只看收藏 / 弹结果 / 清理全部） | `FilterBar` | 新增 |
| | 模块折叠卡（h≥56） | `ModuleCardMobile` | 新增（改造 `Module.tsx`） |
| | TOC 目录 | `BottomSheet` | 新增（替代右侧 Popover） |
| 用户管理 | 卡片流 + 操作进 ActionSheet | `UserCardMobile` + `ActionSheet` | 新增 |
| 登录 | 单列表单、大号输入（h=52） | `AuthForm` | 改造 `LoginWithPasswordComponent` |
| 全局 | 底部操作面板 / 二次确认 | `ActionSheet` | 新增（替代 `Tooltip` + `window.confirm`） |
| 全局 | 触控安全图标按钮 | `TouchIconButton`（min 44×44） | 新增 |

**新增目录建议**：`src/components/mobile/`（与桌面组件并存，通过断点分派，不破坏现有桌面实现）

### 2.3 关键交互流程

1. **单账号清理**：首页卡片「清理日常」→ 按钮转圈且卡片禁交互（沿用现有 `busyAccountsRef` 互斥真源）→ Toast → 若开启「弹结果」则拉起结果 `BottomSheet`。
2. **批量清理**：`SegmentedControl` 选目标（全部 / 默认 / 已选 N）→ 主 CTA → 顶部进度条 + 完成后结果汇总 Sheet（复用 `ResultSummaryModal`，移动端改为底部展开）。
3. **进入详情**：点卡片主体 → 账号详情 → 区服横滑 Tab → 模块折叠卡 → 目录 `BottomSheet` 锚点跳转。
4. **更多操作**：卡片「⋯」→ `ActionSheet`（立即清理 / 导入配置 / 同步配置 / 运行结果 / 编辑显示名 / 删除账号）→ 删除项二次确认 Sheet（**替换 `window.confirm`**）。
5. **快捷功能编辑**：chip 末尾「＋」→ 全屏 Picker（`QuickActionPicker` 改为全屏 Sheet）。
6. **登录**：单列表单 → 键盘弹出时主 CTA 保持可见（`position: sticky; bottom` + `env(safe-area-inset-bottom)`）。

### 2.4 适配规范

| 项 | 规范 |
|---|---|
| 视口 | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` |
| 断点 | `base` < 480px（手机）· `sm` 480–767px（大屏手机/平板竖屏）· `md` ≥ 768px（沿用桌面） |
| 375px | 与 390 同版式，左右外边距 16 → 12px，卡片圆角/行高不变 |
| 390px | **设计基准**，内容区左右留白 16px |
| 430px | 内容区最大宽度 430px 居中，卡片仍单列，模块间距 16 → 20px |
| 安全区 | `padding-top: env(safe-area-inset-top)`；`padding-bottom: calc(12px + env(safe-area-inset-bottom))`；BottomTabBar 高度 `calc(56px + env(safe-area-inset-bottom))` |
| 触控热区 | 所有可点区 **≥ 44×44**；图标按钮视觉 24px + padding 10px；相邻危险操作间距 ≥ 8px 且必须二次确认 |
| 高度 | `100dvh` 替代 `100vh`（`SideBar/Index.tsx`）；移动端移除 `html { overflow-y: scroll }` |
| 字号 | H1 20/600 · H2 17/600 · Body 15/400 · Caption 13/400 · Tag 12/500（最小 12px） |
| 行高 | 正文 1.5 · 标题 1.3 |
| 间距栅格 | 4px 基数：4 / 8 / 12 / 16 / 20 / 24 / 32 |
| 圆角 | 卡片 16 · 按钮 12 · Chip 999 · Sheet 顶部 20 · 头像 Full |
| 图标 | 沿用 `react-icons/fi`，24px 视框，视觉统一 |
| 信息承载 | **禁用纯 hover**：所有 Tooltip 语义改为常驻文案或点击/长按触发 |

---

## 3. 视觉方向（与桌面端品牌一致）

| 类别 | 取值 | 来源 |
|---|---|---|
| 品牌主色 | `#1A6CE6`（brand.500）/ 深色模式提亮为 `#388BF2`（brand.400） | `theme.ts` brand 色阶 |
| 强调按下态 | `#0F52CC`（brand.600） | 同上 |
| 品牌浅底 | `#ECF5FF`（brand.50）→ 深色 `#0D2E69`（brand.900） | 同上 |
| 页面底色 | 移动端由 `#E2E8F0` **调浅为 `#F1F5F9`**（深色 `#0B0E14`） | 大面积中灰在手机上显浑浊，仅调整明度，色相不变 |
| 面板 | `#FFFFFF`（深色 `#151B2B`） | `bg.panel` |
| 次级底 | `#F8FAFC`（深色 `#1A2132`） | `bg.subtle` 同族 |
| 分割线 | `#E2E8F0`（深色 `#232B3D`） | `border.subtle` |
| 语义色 | 成功 green / 警告 orange / 错误 red / 默认 purple | 与桌面完全一致 |
| 层次手法 | **白面板 + 1px 分割线**为主，仅悬浮元素（FAB / Sheet / TabBar）保留阴影 | 移动端减少重阴影带来的脏感 |
| 图标风格 | 线性、圆角端点、stroke 1.75、24px 视框 | 与桌面同一套 `react-icons/fi` |
| 圆角气质 | 卡片 16 / 按钮 12 / Chip 全圆 | 与桌面 `2xl` / `xl` 同族但收敛 |

**品牌一致性红线**：Logo（`autopcr.svg`）、主色、语义色、状态图标与桌面端**完全一致**；本次只改版式密度与导航形态，不动品牌符号。

---

## 4. 实施计划

### 阶段 0 · 基础设施（无 UI 变更，必须最先做）
| 任务 | 文件 | 依赖 | 验收 |
|---|---|---|---|
| 视口与安全区 | `index.html` | — | 加 `viewport-fit=cover`；`html{overflow-y:scroll}` 限定 `@media (min-width:768px)` |
| 高度单位 | `src/components/SideBar/Index.tsx` | 阶段 0 视口 | `100vh` → `100dvh` |
| 安全区 Token | `src/theme.ts` | — | 新增 `sizes.safeTop/Bottom`、`sizes.tabbar`、`sizes.touchMin: 44px` 语义 token |
| 断点工具 | `src/components/mobile/useIsMobile.ts`（新增） | — | 统一 `useBreakpointValue({ base:true, md:false })`，消除散落判断 |

### 阶段 1 · 结构调整（IA 与导航）
| 任务 | 文件 | 依赖 | 验收 |
|---|---|---|---|
| 底部 TabBar 骨架 | 新增 `src/components/mobile/BottomTabBar.tsx` | 阶段 0 | 3 Tab、56px + 安全区、当前项高亮 |
| 主框架分派 | `src/components/SideBar/Index.tsx` | TabBar | `base`：AppBar + Outlet + TabBar；`md`：沿用当前顶栏 |
| 顶栏 AppBar | 新增 `src/components/mobile/AppBar.tsx` | 阶段 0 | 支持返回 / 标题截断 / 右侧动作，56px |
| 路由分组 | `src/routes/daily/_sidebar/*` | TabBar | 「我的」页承载：修改密码 / 使用须知 / 注销 QQ / 主题 / 用户管理 / 登出 |
| 首页三段工具栏合并 | `src/components/Account/DashBoard.tsx` | AppBar | 欢迎卡 + 操作条合并为「问候条 + 执行面板」两屏内可见 |

> ⚠️ 阶段 1 结束后先在真机跑一遍路由，确认二级页不出现双 TabBar。

### 阶段 2 · 样式体系
| 任务 | 文件 | 依赖 | 验收 |
|---|---|---|---|
| 移动端 Token 层 | `src/theme.ts` | 阶段 0 | 新增 `--safe-*` 变量、`bg.canvas` 移动值、字号/圆角 token |
| 触控基线 | `src/components/ui/icon-button.tsx`、`close-button.tsx` | Token | 全局最小 `minW/minH = 44px`（桌面视觉不变，仅 `base` 断点生效） |
| 表单规格 | `src/components/ui/input.tsx`、`field.tsx`、`switch.tsx`、`checkbox.tsx` | Token | `base` 下 Input h=52、Switch/Checkbox 控件 ≥ 24 且整行 ≥ 44 |
| 卡片/间距基线 | `src/components/Account/AccountCard.tsx` 等 | Token | 卡片圆角 16、内边距 12–16、行高 ≥ 44 |

### 阶段 3 · 组件迁移
| 任务 | 文件 | 依赖 | 验收 |
|---|---|---|---|
| `SafeArea` / `ActionSheet` / `BottomSheet` | 新增 `src/components/mobile/*` | 阶段 2 | Sheet 支持手势关闭、顶部圆角 20、底部安全区 |
| 账号卡片移动版 | 新增 `AccountCardMobile.tsx`；`DashBoard.tsx` 分派 | 阶段 2 + ActionSheet | 单列、主操作 44、删除进二次确认；**移除 `window.confirm`** |
| 首页执行面板 | `DashBoard.tsx` | SegmentedControl / ChipScroller | 目标切换 + 单主 CTA + chip 横滑 + 溢出菜单 |
| 账号详情重构 | `src/routes/daily/_sidebar/account/$account.tsx` | ScrollTabs / FilterBar | Tab 只导航；操作下移独立行；区服多时可横滑 |
| 模块卡移动版 | `src/components/Account/Module.tsx` | 阶段 2 | 头部 ≥ 56，展开区行高 ≥ 48 |
| TOC 改 BottomSheet | `src/components/Account/Area.tsx`、`Toc.tsx` | BottomSheet | 取消右侧 fixed Popover |
| 用户管理 | `src/components/Users/Index.tsx` | ActionSheet | 卡片化，删除/权限变更进 Sheet |
| 登录页 | `routes/daily/login.tsx`、`LoginWithPasswordComponent.tsx` | 阶段 2 | 单列、大输入、CTA 吸底避让键盘 |
| 移动端禁用表格视图 | `DashBoard.tsx`（`VIEW_MODE_KEY`） | 阶段 2 | `<768px` 强制卡片流 |

### 阶段 4 · 细节优化
| 任务 | 文件 | 依赖 | 验收 |
|---|---|---|---|
| Tooltip 语义替换 | 全量 `Tooltip` 使用点 | 阶段 3 | 移动端改为常驻文案 / 长按，或 `hideBelow="md"` |
| Toast 位置 | `src/components/ui/toaster.tsx` | 阶段 3 | 移动端顶部偏移避开状态栏，底部避开 TabBar |
| 滚动与回弹 | `DashBoard.tsx`、`Area.tsx` | 阶段 3 | `-webkit-overflow-scrolling: touch`、列表与 TabBar 不重叠 |
| 深色模式对比度 | `src/theme.ts` | 阶段 3 | 主色提亮到 brand.400，语义色重校，文本对比 ≥ 4.5:1 |
| 真机验收 | — | 全部 | 375 / 390 / 430 三档 + iOS Safari / Android Chrome 各一轮 |

---

## 5. 效果图

`mobile/mobile-mockup.html`（单文件、内联 CSS、390px 居中模拟手机预览，无外部依赖）

包含：
1. 首页 · 账号一览（浅色）
2. 账号详情 · 区服配置（浅色）
3. 操作面板 ActionSheet（浅色）
4. 首页 · 深色模式校验

---

## 6. 假设清单（未在需求中明确，按现有实现推断）

1. **目标用户**：已登录的公会管理者 / 多账号玩家。手机上主要是「看运行状态 + 一键清日常 + 改少量配置」，重度配置仍在桌面完成。
2. **目标机型**：iOS 15+ / Android 10+ 现代浏览器；按 375 / 390 / 430px 三档适配，**不做 < 360px 适配**。
3. **优先级依据**：无埋点数据，页面与功能优先级按功能使用频次 + 代码复杂度的经验判断排序。
4. **兼容策略**：桌面端视觉与交互**保持不变**，移动端为增量适配层（新增 `src/components/mobile/`，通过断点分派），不引入新 UI 框架、不做 PWA / 离线。
5. **表格视图**：假设可在移动端下线；若必须保留，需另做横向卡片化方案（请确认）。
6. **用户管理**：假设仅管理员可见、且低频，故下沉至「我的」。
7. **状态互斥逻辑**：后端接口与 `busyAccountsRef` 互斥网保持不动，本次仅动 UI 层。
8. **图标与主题**：继续沿用 `react-icons/fi` 与 `next-themes`，深色模式与桌面端同步。
9. **区服/模块数据结构**：沿用 `ModuleResponse`（`order` / `info` / `config`），未做数据层改造。
10. **视觉稿性质**：为静态视觉稿，不含交互逻辑；动效仅示意（Sheet 弹出、Tab 切换为静态呈现）。
