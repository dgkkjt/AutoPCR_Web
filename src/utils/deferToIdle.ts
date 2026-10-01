/**
 * 把「不参与首屏渲染」的工作推迟到浏览器空闲时执行。
 *
 * 用于首屏加载期的取舍：网络请求和主线程都应优先服务首屏。
 * 典型场景是长连接（SSE）与非关键数据预取——它们在首屏期间发起会
 * 挤占 HTTP/1.1 同源并发连接（浏览器上限 6），并和入口 JS 争抢主线程。
 *
 * 行为约定：
 * - 优先 requestIdleCallback，给 timeout 兜底，保证最终一定会执行；
 * - 不支持时退化为 setTimeout（老浏览器 / 部分移动端 WebView）；
 * - 返回取消函数，供 effect 清理时调用，避免卸载后回调仍执行。
 */
export function deferToIdle(fn: () => void, timeout = 3000, fallbackDelay = 1200): () => void {
    if (typeof window === 'undefined') return () => { /* SSR 空实现 */ }

    const ric = (window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (handle: number) => void
    })

    if (typeof ric.requestIdleCallback === 'function') {
        const handle = ric.requestIdleCallback(fn, { timeout })
        return () => ric.cancelIdleCallback?.(handle)
    }

    const handle = window.setTimeout(fn, fallbackDelay)
    return () => window.clearTimeout(handle)
}
