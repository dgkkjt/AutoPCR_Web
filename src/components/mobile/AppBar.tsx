import { Box, Flex, IconButton, Text } from '@chakra-ui/react'
import { FiChevronLeft } from 'react-icons/fi'
import type { ReactNode } from 'react'

import { APPBAR_H, SAFE_TOP } from './SafeArea'

interface AppBarProps {
    /** 左侧区域（优先级低于 onBack） */
    left?: ReactNode
    /** 传入则显示返回箭头 */
    onBack?: () => void
    title?: ReactNode
    subtitle?: ReactNode
    /** 右侧动作区（请自行保证每项 ≥ 44px） */
    right?: ReactNode
    /** 是否显示底部分割线，默认显示 */
    bordered?: boolean
    /** 是否吸顶，默认随内容滚动 */
    sticky?: boolean
}

/**
 * 移动端顶栏
 *
 * 高度固定 52px（内容区）+ 安全区；标题单行截断，右侧动作槽不压缩。
 * 桌面端不使用本组件（沿用 SideBar 的顶栏），所以这里可以自由定移动端尺寸。
 */
export function AppBar({
    left,
    onBack,
    title,
    subtitle,
    right,
    bordered = true,
    sticky = false,
}: AppBarProps) {
    return (
        <Flex
            as="header"
            data-app-bar
            flex="0 0 auto"
            align="center"
            gap={1}
            px={2}
            bg="bg.panel"
            borderBottomWidth={bordered ? '1px' : '0'}
            borderColor="border.subtle"
            position={sticky ? 'sticky' : 'static'}
            top={sticky ? SAFE_TOP : undefined}
            zIndex={sticky ? 20 : undefined}
            css={{
                minHeight: `${APPBAR_H}px`,
                paddingTop: SAFE_TOP,
            }}
        >
            {onBack ? (
                <IconButton
                    aria-label="返回"
                    variant="ghost"
                    colorPalette="gray"
                    minW="44px"
                    minH="44px"
                    onClick={onBack}
                >
                    <FiChevronLeft />
                </IconButton>
            ) : (
                left
            )}

            <Box flex={1} minW={0} px={1}>
                {typeof title === 'string' ? (
                    <Text
                        fontSize="17px"
                        fontWeight="semibold"
                        color="fg"
                        lineHeight="1.3"
                        truncate
                    >
                        {title}
                    </Text>
                ) : (
                    title
                )}
                {subtitle && (
                    <Text fontSize="xs" color="fg.muted" lineHeight="1.4" truncate>
                        {subtitle}
                    </Text>
                )}
            </Box>

            {right && (
                <Flex align="center" gap={0} flexShrink={0}>
                    {right}
                </Flex>
            )}
        </Flex>
    )
}

export default AppBar
