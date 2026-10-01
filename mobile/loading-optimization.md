# AutoPCR_Web 首屏加载优化方案

> 目标：不改变现有功能与视觉设计的前提下，缩短首屏可交互时间，并让加载过程平滑、可预期。
> 本文所有数字均来自真实浏览器实测，测量方法见第 4 节，可复现。

---

## 1. 瓶颈定位

### 1.1 度量口径

模拟条件（贴近手机）：**390×844 视口 · CPU 4× 降频 · 网络 1.6Mbps / 60ms RTT · 禁用缓存**。
测量工具：真实 Edge + DevTools Protocol 采集 FCP/LCP、longtask、resource timing。

### 1.2 改前基线

| 指标 | 数值 |
|---|---|
| 首绘 FCP（用户看到第一帧） | **3372 ms** |
| LCP | 3496 ms |
| DCL / Load | 3128 ms |
| 长任务 | 5 个，累计 **672 ms**，最长 236 ms |
| 请求数 / 传输 / 解码 | 20 个 / 399 KB / **1266 KB** |
| 其中 JS 传输 | **393 KB** |

**首屏白屏 3.4 秒**——这是最严重的问题，且期间没有任何反馈。

### 1.3 定位到的四类瓶颈

#### ① 阻塞渲染的资源：入口带着 7 个静态 chunk 一起 preload

`index.html` 里有 7 条 `modulepreload`（入口 + 6 个 vendor chunk），全部在首屏关键路径上。

对照实验（同条件、只改 HTML）：

| 变体 | 内容 | 首绘 | DCL |
|---|---|---|---|
| D | 极简页（测量工具地板值） | 972 ms | 970 ms |
| A | 仅启动骨架 | **968 ms** | 968 ms |
| E | 骨架 + 入口脚本（无 preload） | **1316 ms** | 2894 ms |
| C | 骨架 + preload + 入口脚本（原状） | **2456 ms** | 2744 ms |

结论：**骨架本身几乎零成本（等于地板值），但 7 条 `modulepreload` 把首绘推后了约 1.1 秒**；关掉后首绘提前 1140 ms，代价是 DCL 慢 150 ms。

> 注：地板值 972 ms 是 headless + 4× 降频的固有开销，绝对数字是测量环境的产物；**相对差值才是信号**。

#### ② 体积过大的依赖：xlsx 被绑进了首屏

`xlsx` 是 285 KB raw / **95 KB gzip**，仅次于 vendor chunk。它被静态 import 链带进首屏：

```
DashBoard → ResultInfoModal → SingleResult → TableResultWrapper → ExcelExport → xlsx
```

更隐蔽的是**分块配置把问题放大了**：`vite.config.ts` 的 `manualChunks` 把 `xlsx` 和 `file-saver` 分到同一个 chunk，而 `file-saver` 仍被 `ConfigImportExport` 静态引用 → **只要 file-saver 在，整个含 xlsx 的 chunk 就会被写进 index.html 的 modulepreload，首屏白下载 285 KB**。

#### ③ 冗余/抢带宽的请求：非关键请求挤在首屏窗口

| 请求 | 发起时机 | 问题 |
|---|---|---|
| `GET /daily/api/query_validate`（SSE 长连接） | 挂载即连 | 长连接占掉一个 HTTP/1.1 同源并发名额（上限 6） |
| `GET /daily/api/schedule` | 挂载即拉 | 不参与首屏渲染 |
| `getAccount` + 每区 `getAccountConfig`（N+1） | 挂载后 | 危险标记对账，首屏期间打出一串请求 |
| `announcement.png` **263 KB** | 首次访问自动弹出的「使用须知」 | **比全站 JS 传输量还大 87%**，且正好落在首屏窗口 |

#### ④ 主线程阻塞：解析执行 1.27 MB JS

5 个长任务累计 672 ms，最长 236 ms。其中一部分来自构建期的**代码混淆**：

| 入口 chunk | raw | gzip |
|---|---|---|
| 混淆后（原状） | 194 KB | 66.9 KB |
| 未混淆（`OBFUSCATE=0`） | **139 KB** | **42.8 KB** |

混淆让入口 chunk 膨胀 **40%**（+55 KB raw / +24 KB gzip）。vendor 类不经过混淆，所以只影响应用代码。

---

## 2. 优化措施与收益/成本

### 已实施

| # | 措施 | 涉及文件 | 预期收益 | 改动成本 | 实测 |
|---|---|---|---|---|---|
| 1 | **xlsx 改动态 import**，表头/合并单元格/数据体计算一并从 render 挪进点击回调 | `ExcelExport.tsx` | 首屏少下 95 KB gzip | 小（30 行） | JS 393→303 KB |
| 2 | **修正分块规则**：`xlsx` 与 `file-saver` 拆开 | `vite.config.ts` | 让措施 1 真正生效 | 极小（2 行） | xlsx 移出 preload 列表 |
| 3 | **默认关闭 modulepreload** | `vite.config.ts` | 首绘 −1.19 s | 极小（1 行，`MODULE_PRELOAD=1` 可回退） | FP 2480→1288 ms |
| 4 | **纯 HTML/CSS 启动骨架**（不依赖 JS 加载完） | `index.html`、`main.tsx` | 白屏 3.4 s → 有内容的骨架 | 中（~150 行 CSS/HTML + 20 行交接） | FP 3372→1288 ms |
| 5 | **构建期注入初始 chunk 清单**，给骨架提供真实进度分母 | `vite.config.ts` 插件 + `index.html` | 进度真实、不回落 | 中（~40 行插件） | 见第 3 节 |
| 6 | **非关键请求延后到 idle**：SSE 长连接、`/schedule`、危险标记对账 | `SideBar/Index.tsx`、`ScheduleNotify.tsx`、`DashBoard.tsx`、新增 `utils/deferToIdle.ts` | 首屏窗口少 3 类并发占用 | 小 | 见第 4 节 |
| 7 | **图片异步解码** | `ReadmeModal.tsx` | 避免 263 KB 图解码阻塞首帧 | 极小（1 个属性） | — |
| 8 | **体积分析改为按需**（`ANALYZE=1`） | `vite.config.ts` | 构建更快、CI 不再弹浏览器 | 极小 | 构建 ~11.6s → ~6.6s |

### 未实施（需你确认，见第 5 节）

| 措施 | 预期收益 | 成本/风险 |
|---|---|---|
| 关闭代码混淆（`OBFUSCATE=0`） | 入口 chunk −24 KB gzip，首绘约 −100 ms，DCL 约 −140 ms | 失去防篡改；需你判断是否必要 |
| `announcement.png` 压成 WebP / 缩小到 1000px | 单张图 263 KB → 约 60–90 KB | 会改动资源文件（显示尺寸不变，画质需目检） |
| 「使用须知」首次弹窗延后到 idle 再开 | 首屏窗口再少 263 KB 争抢 | 可见时机变化约 1 s，属交互时序改动 |
| 进一步减小 vendor chunk（268 KB） | 需逐个分析依赖，收益不确定 | 需先接 `ANALYZE=1` 看构成 |

---

## 3. 加载进度反馈

### 3.1 现状问题

- 首屏 3.4 s 内**没有任何反馈**（纯白屏）。
- 现有骨架（问候条、账号卡片）只在 React 挂载后才出现——它解决的是「布局已就绪、数据未到」，**不覆盖 JS 还没跑起来的那段**。

### 3.2 设计：两层骨架 + 真实进度

```
0 ─────────────── 1288ms ────────── 2750ms ──────── 3533ms
│  启动骨架（纯 HTML/CSS，HTML 到达即可绘制）  │
│                  │  页面内骨架（React 已挂载，等数据）  │
                                  │ 内容就绪 │
```

**启动骨架**（新增，`index.html`）：
- 纯 HTML/CSS，**不依赖任何 JS 加载完成**，在入口脚本解析之前就能绘制；
- 样式完全对齐现有视觉语言：同一组底色（`#F1F5F9` / 桌面 `#E2E8F0`）、白面板、16px 圆角、品牌色顶栏、同样的扫光骨架块；
- 跟随 `localStorage.theme` + `prefers-color-scheme` 判断深色，避免深色用户看到一屏白；
- 尊重 `prefers-reduced-motion`：系统开了「减弱动态效果」就只留静态骨架，不做扫光；
- React 首次提交后由 `main.tsx` 双 `requestAnimationFrame` 淡出移除，与页面内骨架无缝交接。

**真实进度**（`index.html` + `vite.config.ts` 插件）：
- **分母**：构建期由 `bootChunkManifest` 插件遍历入口 chunk 的静态 import 闭包，把清单注入 HTML（实测 7 项，xlsx 不在其中）；
- **分子**：`PerformanceObserver({type:'resource'})` 统计这些资源真正加载完成的个数；
- 因此进度**只增不减**（同名资源只记一次）、**不会提前到 100%**（封顶 99%，剩下的 1% 留给无法量化的初始化）；
- 真正的「完成」不是数字，而是应用可交互——由 `main.tsx` 移除骨架来表达。

实测采样（4G + 4×CPU，`performance.now()`）：

```
1325ms   14%   正在加载资源…
1481ms   29%   正在加载资源…
1792ms   57%   正在加载资源…
2415ms   71%   正在加载资源…
2835ms   99%   正在初始化界面…      ← DOMContentLoaded
3533ms   骨架移除                    ← React 首次提交
```

**为什么不用百分比动画或打表**：请求时长不可预知，任何定时器推进的百分比都是编的，必然出现「停在 99%」或「提前 100% 然后卡住」。这里的进度只由真实完成的资源数驱动。

**兜底**：入口脚本 12 s 仍未挂载时，文案切到「仍在加载，请检查网络…」，避免无限等待；`main.tsx` 的移除逻辑带 `transitionend` + 超时双保险，不会永久遮住页面。

---

## 4. 验收指标与对比方式

### 4.1 验收指标（改前 → 改后）

**模拟手机（390×844 · CPU 4× · 1.6Mbps / 60ms RTT · 禁缓存）**

| 指标 | 改前 | 改后 | 变化 |
|---|---|---|---|
| **首绘 FCP**（用户看到第一帧） | 3372 ms | **1288 ms** | **−2084 ms（−62%）** |
| LCP | 3496 ms | 3152 ms | −344 ms |
| **DCL / Load**（JS 就绪） | 3128 ms | 2750 ms | **−378 ms（−12%）** |
| 长任务累计 / 最长 | 672 / 236 ms | 677 / 219 ms | 基本持平 |
| 请求数 | 20 | 21 | +1 |
| **传输总量** | 399 KB | **313 KB** | **−86 KB（−22%）** |
| **JS 传输** | 393 KB | **303 KB** | **−90 KB（−23%）** |
| 解码总量 | 1266 KB | 1005 KB | −261 KB（−21%） |

**本机不限速（localhost）**

| 指标 | 改前 | 改后 |
|---|---|---|
| 首绘 FCP | 228 ms | **44 ms** |
| LCP | 248 ms | 184 ms |
| DCL | 182 ms | 113 ms |
| 传输总量 | 399 KB | 313 KB |

**分步归因**（同条件逐步施加）：

| 步骤 | 首绘 | Δ |
|---|---|---|
| 改前基线 | 3372 ms | — |
| + 启动骨架 + xlsx 移出首屏 | 2480 ms | −892 ms |
| + 关闭 modulepreload | 1288 ms | −1192 ms |

### 4.2 对比方式（可复现）

1. `npm run build` 产出 `dist/`；
2. 用带 gzip 的静态服务器托管 `dist`，并把 `/daily/api/*` 指向 mock（或真实后端）；
3. 真实 Chrome/Edge 通过 DevTools Protocol 设置：
   - `Emulation.setDeviceMetricsOverride` 390×844（模拟手机）
   - `Emulation.setCPUThrottlingRate` 4（降频）
   - `Network.emulateNetworkConditions` 1.6 Mbps / 60 ms RTT
   - `Network.setCacheDisabled` true（每次都是首次访问）
4. 页面内用 `PerformanceObserver` 采集 `paint` / `largest-contentful-paint` / `longtask`，并读 `resource` 条目统计传输量与请求数；
5. 单指标取 3 次运行的中位数，避免抖动误判。

**关键点：A/B 必须同条件各跑一遍**。我这次的 modulepreload 结论就是靠「同一份 HTML 只删 preload 链接」的对照实验得出的，直接对比不同构建的绝对数字会被噪声带偏。

### 4.3 建议纳入回归的阈值

| 指标 | 阈值 |
|---|---|
| JS 传输量（首屏） | ≤ 320 KB |
| 首屏 JS chunk 数 | ≤ 7 |
| 新增「首屏模块」 | 必须进 `__BOOT_CHUNKS__` 清单（说明它在关键路径上） |

---

## 5. 需要你确认的技术取舍点

| # | 取舍 | 现状 | 选项 | 风险/影响 |
|---|---|---|---|---|
| 1 | **modulepreload 开关** | 已默认关闭 | 设 `MODULE_PRELOAD=1` 可恢复 | 关：首绘 −1.19 s、DCL +61 ms；开：反过来。**首绘是用户感知指标**，我选了首绘 |
| 2 | **代码混淆** | 保持开启（不改行为） | 设 `OBFUSCATE=0` 可构建未混淆版 | 关：入口 chunk −24 KB gzip、首绘约 −100 ms；代价是失去防篡改。**这是安全 vs 速度，需要你判断** |
| 3 | **`announcement.png` 263 KB** | 仅加 `decoding="async"` | 压成 WebP / 缩到 1000px | 会改动资源文件；显示尺寸不变，画质需目检 |
| 4 | **「使用须知」首次弹窗时机** | 保持原样（挂载即开） | 延后到 idle 再开 | 首屏窗口再省 263 KB 争抢，但弹窗出现时间变化约 1 s |
| 5 | **非关键请求延后时长** | SSE 1.2 s / schedule 1.5 s / 对账 1.8 s（均带 idle 优先、超时兜底） | 可调 | 验证通知最多晚约 1.2 s 建立，功能不受影响 |
| 6 | **启动骨架的深色判断** | 读 `localStorage.theme`（next-themes 的 key） | 保持 | 若将来更换主题实现（改 key 或改用 `data-theme`），需同步 `index.html` 的内联脚本 |
| 7 | **测量脚本是否入库** | 未入库（用的临时脚本） | 可固化为 `scripts/measure-mobile-load.mjs` | 便于后续回归；会增加一个脚本文件与 devDependency 依赖面 |

---

## 6. 假设

1. 部署侧对 `/assets/*` 已开启长缓存（Vite 文件名带内容哈希，可 `immutable`）；本文只优化首次访问，**未涉及缓存命中路径**。
2. 真实后端在首屏只需 `/account` 与 `/role` 两个接口即可渲染列表；`/schedule` 与 SSE 可延后。
3. 目标浏览器支持 ES modules、`PerformanceObserver`、`requestIdleCallback`（不支持时均已提供回退：进度条退化为读 HTML 已声明资源、`deferToIdle` 退化为 `setTimeout`）。
4. 绝对时间指标受测量环境的固有开销影响（headless + 降频地板值约 970 ms），**以相对差值作为验收依据**。
5. 未改动任何视觉样式与交互逻辑；启动骨架只是新增了一层「应用起来之前」的过渡。
