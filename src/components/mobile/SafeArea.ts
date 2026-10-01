/**
 * 安全区与触控基线常量
 *
 * index.html 里定义了 --safe-* 四个 CSS 变量（viewport-fit=cover 生效）。
 * 正常浏览器里它们恒为 0（浏览器 UI 已经占掉了刘海/底部条），
 * 「添加到主屏幕」以 standalone 打开时才会取到真实值——所以这套写法
 * 既不会破坏现有桌面/浏览器表现，又能兜住 standalone。
 */

export const SAFE_TOP = 'var(--safe-top, 0px)'
export const SAFE_BOTTOM = 'var(--safe-bottom, 0px)'
export const SAFE_LEFT = 'var(--safe-left, 0px)'
export const SAFE_RIGHT = 'var(--safe-right, 0px)'

/** 额外留白 + 安全区（用于 padding / margin） */
export function safeTop(extra = 0): string {
    return `calc(${extra}px + ${SAFE_TOP})`
}

export function safeBottom(extra = 0): string {
    return `calc(${extra}px + ${SAFE_BOTTOM})`
}

export function safeX(extra = 0): string {
    return `calc(${extra}px + ${SAFE_LEFT})`
}

/** 触控热区下限（Apple HIG / Material 双标准取交集） */
export const TOUCH_MIN = '44px'

/** 框架尺寸 */
export const APPBAR_H = 52
export const TABBAR_H = 56
