import { Flex, Text } from '@chakra-ui/react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import type { IconType } from 'react-icons'
import { FiHome, FiUser } from 'react-icons/fi'

import { Route as DashBoardRoute } from '@routes/daily/_sidebar/account/index'
import { Route as MeRoute } from '@routes/daily/_sidebar/me/index'
import { SAFE_BOTTOM, TABBAR_H } from './SafeArea'

interface TabDef {
    key: string
    label: string
    icon: IconType
    to: string
}

/**
 * ⚠️ 必须放在组件内构造，不能提到模块作用域。
 *
 * `Route.to` 是 Router 在 createRouter() 时通过 route.init() 赋上的；
 * 模块作用域求值发生在 createRouter 之前，那时读到的是 undefined，
 * 于是每一项的 to 会被快照成 undefined → navigate({to: undefined}) 静默无效。
 */
function buildTabs(): TabDef[] {
    return [
        { key: 'home', label: '首页', icon: FiHome, to: DashBoardRoute.to },
        { key: 'me', label: '我的', icon: FiUser, to: MeRoute.to },
    ]
}

/**
 * 移动端底部 Tab 栏
 *
 * 只放真正的两个一级目的地：
 * - 首页：执行 + 账号列表（账号详情是它的下钻二级页，不再单独立 Tab）
 * - 我的：安全设置 / 用户管理（仅管理员）/ 主题 / 登出
 *
 * 跳转走 navigate() 而不是 Link：这里不需要预加载/右键新窗口等 <a> 语义，
 * 用按钮点击可以避免锚点默认行为与父级 Flex 布局互相干扰。
 *
 * 桌面端不渲染本组件（沿用顶部导航）。
 */
export function BottomTabBar() {
    const navigate = useNavigate()
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const tabs = buildTabs()

    return (
        <Flex
            as="nav"
            data-tab-bar
            flex="0 0 auto"
            align="stretch"
            bg="bg.panel"
            borderTopWidth="1px"
            borderColor="border.subtle"
            css={{
                paddingBottom: SAFE_BOTTOM,
            }}
        >
            {tabs.map((tab) => {
                // to 形如 '/daily/account/'，下钻页 '/daily/account/xxx' 用前缀命中 → 详情页也高亮「首页」
                const isActive = pathname === tab.to || pathname.startsWith(tab.to)
                // 但「已高亮」不等于「不用跳」：在详情页时前缀命中会让 isActive 为真，
                // 若据此提前 return，点「首页」就再也回不到列表页了（实测路径不变）。
                // 只有正好停在目标路径本身才跳过跳转。
                const isSameLocation = pathname === tab.to
                return (
                    <Flex
                        as="button"
                        key={tab.key}
                        flex={1}
                        direction="column"
                        align="center"
                        justify="center"
                        gap={1}
                        minH={`${TABBAR_H}px`}
                        bg="transparent"
                        border={0}
                        color={isActive ? 'blue.solid' : 'fg.muted'}
                        cursor="pointer"
                        aria-label={tab.label}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => {
                            if (isSameLocation) return;
                            void navigate({ to: tab.to });
                        }}
                        _active={{ bg: 'bg.subtle' }}
                    >
                        <tab.icon size={22} />
                        <Text
                            fontSize="11px"
                            lineHeight="1"
                            fontWeight={isActive ? 'semibold' : 'medium'}
                        >
                            {tab.label}
                        </Text>
                    </Flex>
                )
            })}
        </Flex>
    )
}

export default BottomTabBar
