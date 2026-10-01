import { Box, Button, Card, Flex, Stack, Text } from '@chakra-ui/react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { FiBook, FiKey, FiLogOut, FiShield, FiUser, FiUserX } from 'react-icons/fi'
import { LuMoon, LuSun } from 'react-icons/lu'
import NiceModal from '@ebay/nice-modal-react'
import type { AxiosError } from 'axios'

import { Route as LoginRoute } from '@routes/daily/login'
import { Route as UsersRoute } from '@routes/daily/_sidebar/user/index'
import { deleteAccount, getUserInfo, putUserInfo, useUserRole } from '@api/Account'
import { postLogout } from '@api/Login'
import { UserInfoResponse } from '@interfaces/UserInfo'
import { toaster } from '@components/ui/toaster'
import { Switch } from '@components/ui/switch'
import ReadmeModal from '@components/Account/ReadmeModal'
import resetPasswdModal from '@components/Users/ResetPasswdModal'
import { getErrorDescription } from '@components/Account/Config'
import { useColorMode } from '@components/ui/color-mode'
import { showConfirmSheet } from './ConfirmSheet'

/** 「我的」页：把低频、且此前占据一级导航的入口收拢到这里 */
export function Me() {
    const navigate = useNavigate()
    const role = useUserRole()
    const { colorMode, toggleColorMode } = useColorMode()
    const [userInfo, setUserInfo] = useState<UserInfoResponse>()

    useEffect(() => {
        getUserInfo()
            .then((res) => setUserInfo(res))
            .catch(() => {
                /* 全局拦截器统一处理 */
            })
    }, [])

    const handleResetPassword = () => {
        NiceModal.show(resetPasswdModal, {})
            .then((value) => {
                putUserInfo({ password: value as string })
                    .then((res) => {
                        toaster.create({ type: 'success', title: '修改密码成功', description: res });
                        NiceModal.hide(resetPasswdModal).catch(() => {
                            return;
                        });
                    })
                    .catch(async (err: AxiosError) => {
                        toaster.create({ type: 'error', title: '修改密码失败', description: await getErrorDescription(err) });
                    });
            })
            .catch(() => {
                return;
            });
    };

    const handleReadme = () => {
        NiceModal.show(ReadmeModal, {})
            .then(() => localStorage.setItem('readme2', 'true'))
            .catch(() => localStorage.setItem('readme2', 'true'));
    };

    /** 注销 QQ：终止性操作，必须二次确认 */
    const handleDeleteQQ = async () => {
        const ok = await showConfirmSheet({
            title: '注销 QQ',
            body: `确定注销 QQ ${userInfo?.qq ?? ''} 吗？\n该操作会删除本 QQ 下的全部账号与配置，且无法恢复。`,
            confirmText: '确认注销',
        });
        if (!ok) return;
        try {
            const res = await deleteAccount();
            toaster.create({ type: 'success', title: '注销成功', description: res });
            await navigate({ to: LoginRoute.to });
        } catch (err) {
            toaster.create({ type: 'error', title: '注销失败', description: await getErrorDescription(err as AxiosError) });
        }
    };

    const handleLogout = async () => {
        const ok = await showConfirmSheet({
            title: '登出',
            body: '确定要退出当前账号吗？',
            confirmText: '登出',
            danger: false,
        });
        if (!ok) return;
        try {
            const res = await postLogout();
            toaster.create({ title: '登出成功', description: res, type: 'success' });
            await navigate({ to: LoginRoute.to });
        } catch {
            /* 错误由全局拦截器处理 */
        }
    };

    return (
        <Stack gap={4} p={4} pb={8} w="full" minW={0}>
            {/* 用户信息 */}
            <Card.Root bg="bg.panel" borderRadius="2xl" shadow="sm">
                <Card.Body>
                    <Flex align="center" gap={3}>
                        <Box
                            w="48px"
                            h="48px"
                            borderRadius="full"
                            bg="blue.subtle"
                            color="blue.fg"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            fontSize="20px"
                            flexShrink={0}
                        >
                            <FiUser />
                        </Box>
                        <Stack gap={0} minW={0}>
                            <Text fontSize="17px" fontWeight="semibold" truncate>
                                {userInfo?.qq ?? '—'}
                            </Text>
                            <Text fontSize="13px" color="fg.muted">
                                {userInfo?.accounts?.length ?? 0} 个账号
                                {role?.admin ? ' · 管理员' : ''}
                            </Text>
                        </Stack>
                    </Flex>
                </Card.Body>
            </Card.Root>

            {/* 账号与安全 */}
            <Section title="账号与安全">
                <Row
                    icon={<FiKey />}
                    label="修改密码"
                    onPress={handleResetPassword}
                />
                <Row icon={<FiBook />} label="使用须知" onPress={handleReadme} />
                <Row
                    icon={<FiUserX />}
                    label="注销 QQ"
                    danger
                    onPress={() => void handleDeleteQQ()}
                />
            </Section>

            {/* 外观 */}
            <Section title="外观">
                <Flex
                    align="center"
                    gap={3}
                    minH="56px"
                    px={3}
                    bg="bg.panel"
                    borderRadius="xl"
                >
                    <Box fontSize="18px" color="fg.muted" display="flex">
                        {colorMode === 'light' ? <LuMoon /> : <LuSun />}
                    </Box>
                    <Text flex={1} fontSize="15px">
                        深色模式
                    </Text>
                    <Switch
                        checked={colorMode === 'dark'}
                        onCheckedChange={toggleColorMode}
                        colorPalette="blue"
                    />
                </Flex>
            </Section>

            {/* 管理（仅管理员） */}
            {role?.admin && (
                <Section title="管理">
                    <Row
                        icon={<FiShield />}
                        label="用户管理"
                        onPress={() => void navigate({ to: UsersRoute.to })}
                    />
                </Section>
            )}

            {/* 登出 */}
            <Box pt={2}>
                <Row icon={<FiLogOut />} label="登出" danger standalone onPress={() => void handleLogout()} />
            </Box>

            <Box h="8px" />
        </Stack>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Stack gap={2}>
            <Text fontSize="13px" color="fg.muted" px={1}>
                {title}
            </Text>
            <Stack gap={2}>{children}</Stack>
        </Stack>
    );
}

interface RowProps {
    icon: React.ReactNode
    label: string
    danger?: boolean
    /** 单独一行展示（不与其它行同组） */
    standalone?: boolean
    onPress: () => void
}

function Row({ icon, label, danger, standalone, onPress }: RowProps) {
    return (
        <Button
            type="button"
            variant="ghost"
            justifyContent="flex-start"
            alignItems="center"
            gap={3}
            minH="56px"
            px={3}
            w="full"
            bg="bg.panel"
            borderRadius="xl"
            shadow={standalone ? 'sm' : undefined}
            color={danger ? 'red.fg' : 'fg'}
            fontWeight="medium"
            fontSize="15px"
            onClick={onPress}
        >
            <Box fontSize="18px" display="flex" flexShrink={0} opacity={danger ? 1 : 0.8}>
                {icon}
            </Box>
            {label}
        </Button>
    );
}

export default Me;
