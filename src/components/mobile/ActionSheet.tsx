import { Box, Button, Flex, Portal, Text } from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { keyframes } from '@emotion/react'
import type { ReactNode } from 'react'

import { SAFE_BOTTOM } from './SafeArea'

export interface ActionSheetItem {
    key: string
    label: string
    icon?: ReactNode
    /** 危险项：文字与图标转红，视觉上与其它项拉开距离 */
    danger?: boolean
    disabled?: boolean
}

interface ActionSheetProps {
    title?: string
    subtitle?: string
    items: ActionSheetItem[]
    cancelText?: string
}

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
`

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`

/**
 * 移动端底部操作面板
 *
 * 替代两样在触屏上不好用的东西：
 * 1. Tooltip —— 触屏没有 hover，图标按钮的说明完全暴露不出来
 * 2. window.confirm —— 原生弹窗样式割裂且不可定制
 *
 * 用法：const key = await showActionSheet({...})，取消/点遮罩返回 null。
 */
const ActionSheetModal = NiceModal.create<ActionSheetProps>(
    ({ title, subtitle, items, cancelText = '取消' }) => {
        const modal = useModal()

        const settle = async (value: string | null) => {
            modal.resolve(value)
            await modal.hide()
        }

        if (!modal.visible) return null

        return (
            <Portal>
                <Box
                    position="fixed"
                    inset={0}
                    bg="blackAlpha.600"
                    zIndex={1500}
                    animation={`${fadeIn} 0.18s ease-out`}
                    onClick={() => void settle(null)}
                />
                <Box
                    position="fixed"
                    left={0}
                    right={0}
                    bottom={0}
                    zIndex={1501}
                    bg="bg.panel"
                    borderTopRadius="20px"
                    px={3}
                    pt={2}
                    boxShadow="dark-lg"
                    animation={`${slideUp} 0.22s ease-out`}
                    display="flex"
                    flexDirection="column"
                    maxH="88vh"
                    css={{ paddingBottom: `calc(12px + ${SAFE_BOTTOM})` }}
                >
                    <Box w="38px" h="4px" borderRadius="full" bg="border.subtle" mx="auto" mb={2} />

                    {(title || subtitle) && (
                        <Box px={2} pb={2} flexShrink={0}>
                            {title && (
                                <Text fontSize="16px" fontWeight="semibold" color="fg">
                                    {title}
                                </Text>
                            )}
                            {subtitle && (
                                <Text fontSize="xs" color="fg.muted" mt={0.5}>
                                    {subtitle}
                                </Text>
                            )}
                        </Box>
                    )}

                    {/* 选项区可滚动：模块目录/账号选择这类列表可能很长，
                        不给高度上限 + overflow 会把「取消」按钮和底部安全区一起顶出屏幕 */}
                    <Box maxH="56vh" overflowY="auto" css={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
                        {items.map((item) => (
                            <Flex
                                key={item.key}
                                align="center"
                                gap={3}
                                minH="56px"
                                px={2}
                                borderRadius="12px"
                                cursor="pointer"
                                opacity={item.disabled ? 0.45 : 1}
                                color={item.danger ? 'red.fg' : 'fg'}
                                _active={{ bg: 'bg.subtle' }}
                                onClick={() => {
                                    if (item.disabled) return
                                    void settle(item.key)
                                }}
                            >
                                {item.icon && (
                                    <Box fontSize="20px" display="flex" flexShrink={0}>
                                        {item.icon}
                                    </Box>
                                )}
                                <Text fontSize="15px" fontWeight="medium" flex={1} minW={0}>
                                    {item.label}
                                </Text>
                            </Flex>
                        ))}
                    </Box>

                    <Box pt={2} flexShrink={0}>
                        <Button
                            w="full"
                            size="lg"
                            minH="52px"
                            variant="outline"
                            borderRadius="14px"
                            onClick={() => void settle(null)}
                        >
                            {cancelText}
                        </Button>
                    </Box>
                </Box>
            </Portal>
        )
    },
)

export interface ShowActionSheetOptions extends ActionSheetProps {}

/** 打开操作面板，返回被点击项的 key；取消返回 null */
export function showActionSheet(options: ShowActionSheetOptions): Promise<string | null> {
    return NiceModal.show(ActionSheetModal, options) as Promise<string | null>
}

export default ActionSheetModal
