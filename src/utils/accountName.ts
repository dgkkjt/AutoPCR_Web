/**
 * 账号昵称校验（新建账号入口）
 *
 * 背景：昵称会被直接拼进 API 路径（`/account/${alias}`）。虽然请求侧已经统一做了
 * encodeURIComponent，但含 `/`、`..` 的名字依然会在浏览器 URL 规范化后指向别的路由
 * （`/account/../user/1` → `/user/1`）。因此入口处再拦一道，是纵深防御而非重复劳动。
 *
 * 只用于「新建」：历史账号即使名字不合规也继续可用，不做追溯清理。
 */

/** 返回 null 表示合法；否则返回可直接展示的原因 */
export function checkAccountName(raw: string): string | null {
    const value = raw.trim();
    if (!value) return '名字不能为空';
    if (value.length > 64) return '名字过长（最多 64 个字符）';

    // 控制字符（含 DEL）：用 charCode 判断，避免在正则里写转义序列
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) return '名字不能包含控制字符';
    }

    if (/[/\\]/.test(value)) return '名字不能包含 / 或 \\';
    if (/[?#]/.test(value)) return '名字不能包含 ? 或 #';
    if (value === '.' || value === '..') return '名字不能是 . 或 ..';

    return null;
}
