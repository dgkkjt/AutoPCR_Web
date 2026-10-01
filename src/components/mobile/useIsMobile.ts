/**
 * 移动端断点判断（全项目唯一入口）
 *
 * 背景：此前响应式判断散落在各组件里（只有 SideBar 一处 useBreakpointValue），
 * 且阈值口径不统一。这里统一为「是否处于手机形态」这一个语义，组件层只关心
 * 用哪套版式，不再各自猜宽度。
 *
 * 阈值与 Chakra 默认断点对齐：md = 768px。
 * - base (< 768px)  → 手机：底部 TabBar + 单列 + 44px 热区
 * - md   (>= 768px) → 桌面：沿用现有顶栏版式，视觉与交互不变
 *
 * 返回值在首帧是 SSR/首屏安全值（false），挂载后同步为真实值，避免布局跳变。
 */
import { useBreakpointValue } from '@chakra-ui/react'

/** 是否处于手机形态（< 768px） */
export function useIsMobile(): boolean {
    return useBreakpointValue({ base: true, md: false }) ?? false
}

/** 是否处于平板/大屏手机（>= 480px 且 < 768px）：卡片可放宽留白，但仍是移动版式 */
export function useIsWideMobile(): boolean {
    return useBreakpointValue({ base: false, sm: true, md: false }) ?? false
}
