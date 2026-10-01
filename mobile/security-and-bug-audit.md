# AutoPCR_Web 前端代码审计：Bug 与安全性问题

> 审计范围：`src/` 全部 TS/TSX（不含 `node_modules`、构建脚本、后端）。
> 方法：逐层通读（API → 共享状态 → 组件 → 路由）+ 危险模式扫描（`innerHTML`/`eval`/`window.open`/`querySelector` 拼接/localStorage 敏感项/未编码 URL 插值/权限门禁点）。
> 说明：本项目是**纯前端**，后端行为未纳入审计；凡依赖后端配合的结论均标为「需确认」。

---

## 修复状态（P0 三条已修复并通过真实浏览器验收）

| 编号 | 问题 | 状态 | 验收结果 |
|---|---|---|---|
| P0-1 | API 路径参数未编码 → 路径穿越 | ✅ 已修 | `src/api/Account.ts` 14 处路径参数全部 `encodeURIComponent`；新增 `src/utils/accountName.ts` 并在 `handleCreateAccount` 校验。实测请求 URL 为 `/daily/api/account/%E8%B5%A4%E8%84%9A`；`../user/1`、`a/b`、`x?y`、`..` 均被拒，`正常账号` 正常提交 |
| P0-2 | 明文密码写 localStorage | ✅ 已修（保留记住密码） | 新增 `src/utils/credentialStore.ts`：AES-GCM + **不可导出密钥**（存 IndexedDB），密文存 localStorage。实测：localStorage 无任何键含明文密码；重开登录页 QQ 与密码均正确回填；取消勾选后凭据被清除 |
| P0-3 | 验证轮询计数器不递减 → 无限轮询 | ✅ 已修 | `Validate.tsx` 三分支均递减 `left_cnt`；新增 `stopQueryValidate()` 与定时器句柄；弹窗在途标记避免叠加 |

> P0-2 的防护边界必须说清楚：加密能防住「直接读 localStorage」（扩展、共用电脑、离线取证），
> **但防不住同源 XSS**——浏览器里不存在能对抗同源脚本的客户端加密。要彻底解决只能不存密码，
> 改用浏览器自带密码管理器（已同时加上 `autoComplete="current-password"`）。

---

## 高危（P0）

### P0-1 账号名未编码直接拼进 API 路径 → 路径穿越 / 端点混淆

**位置**：`src/api/Account.ts`

```
144:  API.get<AccountResponse>(`/account/${alias}`)
149:  API.delete(`/account/${alias}`)
155:  API.put(`/account/${alias}`, {...})
176:  API.get(`/account/${alias}/${area}`)
198:  API.put(`/account/${alias}/config`, configs)
204:  API.post(`/account/${alias}/do_daily`)
211:  API.post(`/account/${alias}/do_single`)
220:  API.get(`/account/${alias}/daily_result`)
225:  API.get(`/account/${alias}/daily_result/${id}`)
235:  API.get(`/account/${alias}/single_result/${module}`)
240:  API.get(`/account/${alias}/single_result/${module}?text=${text}`)   // text 也未编码
269:  API.delete(`/user/${account}`)
```

**风险**：`alias` 是**用户自由输入的账号昵称**（`DashBoard.handleCreateAccount` 只校验非空，见 P0-3）。用户建一个名为 `../user/1` 的账号后：

- 浏览器会规范化 `..`，请求从 `/daily/api/account/../user/1` 变成 **`/daily/api/user/1`** —— 打到「用户管理」接口上；
- 昵称含 `/` 会命中其它路由（或 404）；含 `?`/`#` 会截断路径、注入查询参数；含空格/控制字符会破坏请求。

即：**普通用户仅凭创建账号的输入，就能让前端把请求打到非预期的 API 端点**。同理 `/user/${account}` 里的 qq 也未编码。

**修复建议**
1. 所有路径参数统一 `encodeURIComponent`：`API.put(`/account/${encodeURIComponent(alias)}`, ...)`。
2. 在 `handleCreateAccount` 增加字符白名单/黑名单校验（至少拒绝 `/ .. ? # % \` 与控制字符），前后端都做。
3. 后端对账号名做同样的规范化校验（前端校验只是体验层，不是安全边界）。

---

### P0-2 「记住我」把明文密码写进 localStorage

**位置**：`src/components/Login/LoginWithPasswordComponent.tsx`

```
44-48:  if (remember) {
            localStorage.setItem('qq', values.qq);
            localStorage.setItem('password', values.password);   // ← 明文
        }
80-85:  <Input type="password" defaultValue={localStorage.getItem('password')} />
```

**风险**：localStorage 对同源任意脚本、浏览器扩展、以及能接触设备的人完全可读，**且不会随关闭浏览器失效**。任何一次 XSS（哪怕与本功能无关）、恶意扩展、共用电脑场景，都会直接拿到账号明文密码。这类凭据一旦落盘，就等于长期有效。

注：`handleSubmit(handleRegister)` 走的是同一套 `handleRember`，**注册时也会把新密码明文落盘**。

**修复建议**
1. 只记住 QQ，不记住密码（改动最小，推荐）；或
2. 改为 `sessionStorage` + 明确提示「仅本次会话有效」；或
3. 若业务一定要记住登录态，应让后端下发短期 refresh token，前端只存 token，不存密码。
4. 无论如何，**禁止把密码用作 `defaultValue` 回显**——用占位提示代替。

---

### P0-3 验证轮询计数器不递减 → 无限轮询 + 反复弹窗，且定时器不可取消

**位置**：`src/components/Account/Validate.tsx`

```js
export function QueryValidate(alias: string, left_cnt = 120) {
    if (left_cnt < 0) { toaster...; return; }
    getAccountValidate().then(async (res) => {
        if (res.status === 'empty') {
            setTimeout(QueryValidate, 1000, alias, left_cnt - 1);   // 递减 ✓
        } else if (res.status == "ok") {
            // do nothing
        } else {
            setTimeout(QueryValidate, 1000, alias);                // ← 未传 left_cnt
            await NiceModal.show(ValidateModal, {...});
        }
    }).catch(...)
}
```

**风险**：第三个分支调用时没传 `left_cnt`，参数回落到默认值 120。因此**只要后端一直返回既非 `empty` 也非 `ok` 的状态，计数器永远不递减，120 次上限形同虚设**：

- 每秒一次请求 + 每秒弹一次验证弹窗，**无限循环**；
- 组件卸载后已排队的 `setTimeout` 仍会触发（无任何清理句柄），继续发请求、继续对已卸载组件弹窗；
- 后端异常时表现为「弹窗关不掉 + 请求刷屏」。

**修复建议**
1. 第三分支同样传 `left_cnt - 1`：`setTimeout(QueryValidate, 1000, alias, left_cnt - 1)`。
2. 保存 `setTimeout` 句柄，组件卸载/`Promise` 结束时 `clearTimeout`。
3. 弹窗已打开时不再重复 `show`（加一个在途标记），避免叠加。

---

## 中危（P1）

### P1-1 无 CSRF 防护（Cookie 鉴权 + 全站写操作无令牌）

**位置**：`src/api/APIUtils.ts`

```js
axios.defaults.withCredentials = true;                    // 15 行
BASE_CONFIG = { withCredentials: true, ... }              // 18-23 行
```

全站写操作（`POST/PUT/DELETE`，含 `/logout`、`/account/*/config`、`/user/*`、`/register`）均**未携带任何 CSRF token 或自定义头**（只有 `X-APP-Version`，是常量，不构成防护）。

**风险**：若后端依赖 Cookie 做鉴权且没有其它防护（SameSite=Strict 或双提交 token / 校验 `Origin`），则**任意第三方站点都能诱导已登录用户发起注销账号、改配置、重置他人密码等请求**。

**修复建议**（需与后端确认）
1. 确认 Cookie 设置了 `SameSite=Strict`（或至少 `Lax`）与 `Secure`、`HttpOnly`；
2. 后端校验 `Origin`/`Referer`，或下发 CSRF token、前端在写请求上携带（如 `X-CSRF-Token`）；
3. 前端侧配合：请求拦截器统一注入 token。

---

### P1-2 `window.open` 缺少 `noopener`，且目标 URL 完全由服务端下发

**位置**：`src/components/SideBar/Index.tsx:129`

```js
window.open(res.url, '_blank');
```

`res.url` 来自 SSE `/daily/api/query_validate` 推送，`ValidateResponse.url` 未做任何校验（未限定同源/白名单）。

**风险**
1. **反向标签劫持（reverse tabnabbing）**：未加 `noopener` 时，被打开页面可通过 `window.opener` 操纵原页面（例如把原页面导航到钓鱼页）。
2. 服务端被劫持/MITM 时可下发任意 URL（`javascript:` 之外的任意地址），前端无条件打开。

**修复建议**
```js
const u = new URL(res.url, location.origin);
if (u.protocol === 'https:' || u.protocol === 'http:') {
    window.open(u.href, '_blank', 'noopener,noreferrer');
}
```
并尽量限定到应用自身域名白名单。

---

### P1-3 登录/注册表单零校验，且与「重置密码」的密码下限不一致

**位置**：`src/components/Login/LoginWithPasswordComponent.tsx`

```js
register('qq')        // 无 required / minLength / pattern
register('password')  // 无 required / minLength
```

而 `src/components/Users/ResetPasswdModal.tsx:47`、`CreateUserModal.tsx:57` 用的是 `minLength: 5`，界面文案写的是「8位以上」。

**风险**
- 空提交、1 位密码、`abc` 当 QQ 号都能直达后端，错误只能靠后端返回（体验差且放大无效请求）；
- 密码强度策略三处不一致（登录页无校验 / 重置 5 位 / 文案 8 位），用户能设出 5 位密码而登录侧毫无提示。

**修复建议**：三处统一校验规则（建议 QQ：`required + /^\d{5,}$/`；密码：`required + minLength: 8`），并把规则抽成常量共享。

---

### P1-4 用户管理路由无权限门禁，仅靠隐藏入口

**位置**：`src/routes/daily/_sidebar/user/index.tsx`（无 `beforeLoad` 校验）；`src/components/Users/Index.tsx:84-85`

```js
const allowManage = role?.super_user == true
const allowEdit = (user.admin == true && role?.super_user == true) || (user.admin == false)
```

**风险**：路由不校验角色，导航入口只是「不渲染」。非管理员用户直接访问 `/daily/user/` 会渲染出完整的用户管理界面（虽然写操作会被后端 403）。这属于 security by obscurity，且会让非管理员看到其他用户的 QQ 列表（若后端未对列表接口鉴权则直接泄露）。

**修复建议**
1. 路由层加 `beforeLoad`：非 `role.admin` 时 `redirect` 到首页；
2. `allowEdit` 使用严格比较（`===`）并显式处理 `admin === undefined` 的情况；
3. 后端对 `/user` 列表与写操作独立鉴权（前端门禁永远只是体验层）。

---

### P1-5 登录页在「网络故障」时放行进应用 → 后端故障时登录页不可达

**位置**：`src/routes/daily/login.tsx` `beforeLoad`

```js
} catch (e) {
    if (isRedirect(e)) throw e
    if (axios.isAxiosError(e) && e.response?.status === 401) return
    throw redirect({ to: AccountRoute.to })     // ← 网络故障也跳首页
}
```

**风险**：后端不可达时（网络错误/超时），登录页把用户送去首页；首页 `getUserInfo` 同样是网络错误，`errorHandler` 里 401 分支不触发（`error.response` 为空）→ **既不跳回登录页，也没有任何重试入口**，用户卡在一个空白首页，无法重新登录。

**修复建议**：网络类错误（无 `error.response`）应**留在登录页**并提示「无法连接服务器」，而不是跳转。

---

### P1-6 `querySelector` 拼接未转义 → 选择器注入 + 未捕获的 SyntaxError

**位置**：`src/components/Account/Toc.tsx:51`、`src/components/Account/Area.tsx:102`

```js
document.querySelector(`#${module_id}`)?.scrollIntoView(...)
```

`module_id` 来自后端返回的模块 key。

**风险**
1. **选择器注入**：key 形如 `a, body` 会让选择器匹配到额外元素（`scrollIntoView` 作用对象被改变）；
2. key 含空格、引号、`[`、`#`、`\` 等时，`querySelector` 直接抛 `SyntaxError` —— 两处都没 `try/catch`，异常会冒泡打断点击处理流程。

**修复建议**：改用 `document.getElementById(id)`（不解析选择器，天然免疫），或在必须保留选择器时 `CSS.escape(id)` 并包 `try/catch`。

---

### P1-7 账号真实密码被拉到前端并作为输入框默认值

**位置**：`src/components/Account/Info.tsx:44`、`:163`

```js
const [password, setPassword] = useState<string>(accountInfo?.password);
<Input type="password" defaultValue={accountInfo?.password || ''} />
```

**风险**：后端把真实密码返回给前端，前端放进 DOM 的 `value`。`type="password"` 只是视觉遮蔽，`input.value` 对任何脚本/扩展可读，也会进入浏览器密码管理器与 DOM 快照。

**修复建议**：后端不要返回明文密码（返回一个「是否已设置」的布尔 + 掩码占位即可）；前端在未修改时不提交该字段。

---

## 低危（P2）

| # | 位置 | 问题 | 风险 | 建议 |
|---|---|---|---|---|
| P2-1 | `accountShared.tsx`（`importConfigFile` 收藏写入） | `JSON.parse(raw) as Record<string, string[]>` 未做类型校验即 `{...existing}` 展开写回 | localStorage 被写成非对象（如字符串）时，展开会产生数字索引键，收藏数据被污染 | 解析后校验 `typeof === 'object' && !Array.isArray`，否则重置为空对象 |
| P2-2 | `src/polyfills/structuredClone.ts` + `main.tsx:1` | polyfill 引入但**全项目零使用**，且会 `Object.defineProperty(globalThis, ...)` 改全局对象 | 无谓的全局副作用与包体 | 删除 import 与该文件 |
| P2-3 | `Config.tsx` `configSaveChains`、`accountShared.tsx` `dailyCleanRegistry` | 两个 Map/Set 只增不删 | 有界（受账号数限制），影响很小 | 长期可加清理；当前无需处理 |
| P2-4 | `accountShared.tsx` `onDailyFinished` / `emitDailyFinished` | `onDailyFinished` 从未被调用 | 死代码 | 删除或补上订阅方 |
| P2-5 | `Validate.tsx:52` `window.close()` | 非脚本打开的窗口调用 `window.close()` 会静默失败 | 用户在 `/daily/validate` 直接访问时验证完无反馈、页面不关 | 失败时提示「可关闭本页」 |
| P2-6 | `Info.tsx:68` | `putAccount(accountInfo?.alias, ...)` 无空值守卫 | alias 为空时请求打到 `/account/undefined` | 加 `if (!alias) return` |
| P2-7 | `ConfigImportExport.tsx` | 导入文件无大小上限，`file.text()` 全量读入 | 超大文件导致内存/卡顿（自伤为主） | 加 1–2 MB 上限并提示 |
| P2-8 | `accountShared.tsx` `getErrorDescription` | 对对象型错误体直接 `JSON.stringify` 展示给用户 | 后端内部对象结构可能出现在 toast 里（轻微信息泄露） | 只展示 `message`/`error` 字段，其余统一兜底文案 |
| P2-9 | `Users/Index.tsx:84-85` | `role?.super_user == true` 用宽松比较；`admin` 缺省时语义依赖 `==` 的巧合 | 后端字段缺失时行为不确定 | 改 `===` 并显式处理 undefined |

---

## 总体结论与建议优先级

**必须先处理（P0）**
1. **API 路径参数全部 `encodeURIComponent`** —— 这是唯一一个「普通用户可直接触发、且能打到非预期接口」的问题。
2. **停止把密码写入 localStorage / 用作 defaultValue** —— 凭据落盘是长期风险，一次 XSS 即全量泄露。
3. **修 `QueryValidate` 的计数器与定时器清理** —— 已经在生产代码里存在「无限轮询 + 反复弹窗」的路径。

**需要后端配合确认（P1）**
4. CSRF（`SameSite` / token / `Origin` 校验）—— **这是本次审计里唯一无法在前端单方面闭环的高风险项**，务必与后端核对。
5. `window.open` 的 URL 白名单与 `noopener`。

**建议尽快补齐（P1）**
6. 表单校验统一（尤其是密码下限不一致）。
7. 用户管理路由加 `beforeLoad` 门禁。
8. 登录页网络故障分支改为留在登录页。
9. `querySelector` → `getElementById`。

**说明**：所有前端权限判断（`role.admin` / `super_user` / `allowEdit`）都只是体验层，**安全边界必须在后端**。本次审计未发现 `dangerouslySetInnerHTML`、`eval`、`innerHTML` 等直接 XSS 面，也未发现敏感信息的 `console.log` 泄露（混淆构建还会进一步移除日志）——这一点值得肯定。

需要我按上述优先级开始修复吗？建议从 P0 三条 + P1-6（改动都很小）先动，P1-1 等你跟后端确认后再定方案。
