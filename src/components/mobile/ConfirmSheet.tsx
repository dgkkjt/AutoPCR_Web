import { Box, Button, Flex, Portal, Text } from '@chakra-ui/react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { keyframes } from '@emotion/react'

import { SAFE_BOTTOM } from './SafeArea'

interface ConfirmSheetProps {
    title: string
    /** 正文，支持 \n 换行 */
    body?: string
    confirmText?: string
    cancelText?: string
    /** 危险操作：确认按钮转红 */
    danger?: boolean
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
 * 移动端二次确认面板
 *
 * 用来替换 window.confirm：原生弹窗在移动端样式割裂、按钮文案不可控，
 * 且无法承载"其中 N 个账号正在执行"这类补充信息。
 */
const ConfirmSheetModal = NiceModal.create<ConfirmSheetProps>(
    ({
        title,
        body,
        confirmText = '确认',
        cancelText = '取消',
        danger = true,
    }) => {
        const modal = useModal()

        const settle = async (value: boolean) => {
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
                    onClick={() => void settle(false)}
                />
                <Box
                    position="fixed"
                    left={0}
                    right={0}
                    bottom={0}
                    zIndex={1501}
                    bg="bg.panel"
                    borderTopRadius="20px"
                    px={4}
                    pt={3}
                    boxShadow="dark-lg"
                    animation={`${slideUp} 0.22s ease-out`}
                    css={{ paddingBottom: `calc(16px + ${SAFE_BOTTOM})` }}
                >
                    <Box w="38px" h="4px" borderRadius="full" bg="border.subtle" mx="auto" mb={3} />

                    <Text fontSize="17px" fontWeight="bold" color="fg" mb={1}>
                        {title}
                    </Text>
                    {body && (
                        <Text
                            fontSize="14px"
                            color="fg.muted"
                            lineHeight="1.6"
                            whiteSpace="pre-line"
                        >
                            {body}
                        </Text>
                    )}

                    <Flex direction="column" gap={2} mt={4}>
                        <Button
                            w="full"
                            minH="52px"
                            borderRadius="14px"
                            colorPalette={danger ? 'red' : 'blue'}
                            onClick={() => void settle(true)}
                        >
                            {confirmText}
                        </Button>
                        <Button
                            w="full"
                            minH="52px"
                            borderRadius="14px"
                            variant="outline"
                            onClick={() => void settle(false)}
                        >
                            {cancelText}
                        </Button>
                    </Flex>
                </Box>
            </Portal>
        )
    },
)

/** 打开确认面板，返回用户是否确认 */
export function showConfirmSheet(options: ConfirmSheetProps): Promise<boolean> {
    return NiceModal.show(ConfirmSheetModal, options) as Promise<boolean>
}

export default ConfirmSheetModal
