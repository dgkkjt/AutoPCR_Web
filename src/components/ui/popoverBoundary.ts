/**
 * 浮层的可用区域（floating-ui 的 boundary）
 *
 * 问题背景：日程通知面板原来只设了 `maxH="70vh"`，没有边界约束。
 * 当触发按钮在页面中下部时，浮层向上展开到 70vh，顶边会越过 AppBar，
 * 于是「正在进行」那一块被顶栏盖住——表现为「面板上方的详情显示不完整」。
 *
 * 壳层的内容区（AppBar 与底部 Tab 之间）标了 `data-popover-boundary`，
 * 把它作为 boundary 后，flip / shift / size 三个中间件都以这块区域为界，
 * 再配合 `fitViewport` 由库按可用空间写 max-width / max-height。
 *
 * 取不到时退回 document.body（等同不做额外约束），不会比原来更糟。
 */
export function popoverBoundary(): HTMLElement {
    const el = document.querySelector<HTMLElement>('[data-popover-boundary]');
    return el ?? document.body;
}
