import { Flex, Text } from '@chakra-ui/react'
import { Link, useRouterState } from '@tanstack/react-router'
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

const TABS: TabDef[] = [
    { key: 'home', label: '首页', icon: FiHome, to: DashBoardRoute.to },
    { key: 'me', label: '我的', icon: FiUser, to: MeRoute.to },
]

/**
 * 移动端底部 Tab 栏
 *
 * 只放真正的两个一级目的地：
 * - 首页：执行 + 账号列表（账号详情是它的下钻二级页，不再单独立 Tab）
 * - 我的：安全设置 / 用户管理（仅管理员）/ 主题 / 登出
 *
 * 桌面端不渲染本组件（沿用顶部导航）。
 */
export function BottomTabBar() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })

    return (
        <Flex
            as="nav"
            flex="0 0 auto"
            align="stretch"
            bg="bg.panel"
            borderTopWidth="1px"
            borderColor="border.subtle"
            css={{
                paddingBottom: SAFE_BOTTOM,
            }}
        >
            {TABS.map((tab) => {
                // 下钻页（如 /daily/account/xxx）仍高亮所属一级 Tab
                const isActive = pathname === tab.to || pathname.startsWith(`${tab.to}/`)
                return (
                    <Link
                        key={tab.key}
                        to={tab.to}
                        style={{ flex: 1, textDecoration: 'none' }}
                    >
                        <Flex
                            direction="column"
                            align="center"
                            justify="center"
                            gap={1}
                            minH={`${TABBAR_H}px`}
                            color={isActive ? 'blue.solid' : 'fg.muted'}
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
                    </Link>
                )
            })}
        </Flex>
    )
}

export default BottomTabBar
