import {
    Box,
    Button,
    Flex,
    FlexProps,
    HStack,
    Icon,
    Image,
    Text,
    useBreakpointValue,
} from '@chakra-ui/react'
import {
    FiCompass,
    FiHome,
    FiLogOut,
    FiMoreHorizontal,
    FiUser,
    FiUsers,
} from 'react-icons/fi'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { LuMoon, LuSun } from 'react-icons/lu'
import { useColorMode } from '../ui/color-mode'

import { IconType } from 'react-icons'
import { Route as InfoRoute } from "@routes/daily/_sidebar/account/index";
import { Route as LoginRoute } from "@routes/daily/login";
import { Tooltip } from '../../components/ui/tooltip'
import { Route as UsersRoute } from "@routes/daily/_sidebar/user/index";
import { ValidateResponse } from '@/interfaces/Account'
import autopcr from "@/assets/autopcr.svg"
import { postLogout } from '@api/Login'
import { toaster } from '../../components/ui/toaster'
import {useEffect} from 'react'
import {useUserRole} from "@api/Account.ts";
import RunningStatus from '../Account/RunningStatus';
import { ScheduleNotifyWatcher } from '../Account/ScheduleNotify';
import { Route as MeRoute } from '@routes/daily/_sidebar/me/index';
import { AppBar } from '@components/mobile/AppBar'
import BottomTabBar from '@components/mobile/BottomTabBar'
import { showActionSheet } from '@components/mobile/ActionSheet'
import { useIsMobile } from '@components/mobile/useIsMobile'

interface NavItemProps extends FlexProps {
    icon?: IconType
    children: React.ReactNode
    href?: string
}

const NavItem = ({ icon, children, href, onClick, ...rest }: NavItemProps) => {
    const isSmallScreen = useBreakpointValue({ base: true, md: false });

    const content = (
        <Flex
            align="center"
            py={2}
            px={3}
            borderRadius="0"
            role="group"
            cursor="pointer"
            transition="all 0.2s"
            color="fg.muted"
            _hover={{
                bg: 'bg.subtle',
                color: 'fg',
                transform: 'translateY(-1px)'
            }}
            onClick={onClick}
            {...rest}>
            {icon && (
                <Icon
                    mr={isSmallScreen ? "0" : "2"}
                    fontSize="18"
                    as={icon}
                />
            )}
            {!isSmallScreen && <Text fontSize="sm" fontWeight="medium">{children}</Text>}
        </Flex>
    );

    if (href) {
        return (
            <Link
                to={href}
                activeProps={{
                    style: {
                        fontWeight: "bold",
                        backgroundColor: "var(--chakra-colors-sidebar-active-bg)",
                        color: "var(--chakra-colors-sidebar-active-fg)",
                    }
                }}
                style={{ textDecoration: 'none' }}
            >
                {/* Need to override color for active state manually as activeProps style applies to the 'a' tag */}
                 <Tooltip content={isSmallScreen ? children : undefined}>
                    {content}
                 </Tooltip>
            </Link>
        )
    }

    return (
        <Tooltip content={isSmallScreen ? children : undefined}>
            {content}
        </Tooltip>
    )
}

export default function Nav() {
    const { colorMode, toggleColorMode } = useColorMode()
    const role = useUserRole();
    const isSmallScreen = useBreakpointValue({ base: true, md: false });
    // 手机形态走独立框架：顶栏 + 内容 + 底部 Tab；桌面完全沿用原有顶栏版式
    const isMobile = useIsMobile();

    const navigate = useNavigate();

    useEffect(() => {
        const eventSource = new EventSource('/daily/api/query_validate');

        eventSource.onmessage = function(event) {
            const res: ValidateResponse = JSON.parse(event.data as string) as ValidateResponse;
            if (res.status !== 'ok') {
                window.open(res.url, '_blank');
            }
        };

        eventSource.onerror = function() {
            // console.error('Error receiving SSE', err);
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const handleLogout = async () => {
        try {
            const res = await postLogout();
            toaster.create({ title: "登出成功", description: res, type: "success" });
            await navigate({ to: LoginRoute.to });
        } catch {
            // Error is handled globally
        }
    }

    // 100dvh：iOS Safari 地址栏收放时 100vh 会错位；不支持 dvh 的旧浏览器回落 100vh
    const shellHeight = { height: ['100vh', '100dvh'] } as const;

    if (isMobile) {
        return (
            <Flex
                flexDirection={'column'}
                bg="bg.canvas"
                css={shellHeight}
            >
                <AppBar
                    left={
                        <Box flexShrink={0} pl={1}>
                            <Link to={InfoRoute.to}>
                                <Image src={autopcr} alt="autopcr" h="26px" w="auto" objectFit="contain" maxW="40vw" />
                            </Link>
                        </Box>
                    }
                    right={
                        <>
                            <RunningStatus compact />
                            <Button
                                aria-label="Toggle color mode"
                                onClick={toggleColorMode}
                                size="sm"
                                minW="44px"
                                minH="44px"
                                px={0}
                                variant="ghost"
                                colorPalette="brand"
                            >
                                {colorMode === 'light' ? <LuSun /> : <LuMoon />}
                            </Button>
                            {/* 登出放在顶栏溢出菜单：它是全局动作，不该埋在二级页里 */}
                            <Button
                                aria-label="更多操作"
                                size="sm"
                                minW="44px"
                                minH="44px"
                                px={0}
                                variant="ghost"
                                colorPalette="gray"
                                onClick={() => void (async () => {
                                    const key = await showActionSheet({
                                        title: '更多',
                                        items: [
                                            { key: 'me', label: '我的', icon: <FiUser /> },
                                            ...(role?.admin
                                                ? [{ key: 'users', label: '用户管理', icon: <FiUsers /> }]
                                                : []),
                                            { key: 'logout', label: '登出', icon: <FiLogOut />, danger: true },
                                        ],
                                    });
                                    if (!key) return;
                                    if (key === 'me') void navigate({ to: MeRoute.to });
                                    else if (key === 'users') void navigate({ to: UsersRoute.to });
                                    else if (key === 'logout') void handleLogout();
                                })()}
                            >
                                <FiMoreHorizontal />
                            </Button>
                        </>
                    }
                />

                {/* minH=0 + minW=0：不加这两个，flex 子项的 min-height:auto 会让内容区撑开、
                    把底部 Tab 栏顶到视口之外，同时顶栏也跟着整页滚走 */}
                <Box
                    flex={1}
                    minH={0}
                    minW={0}
                    overflowY="auto"
                    overflowX="hidden"
                    p={3}
                    zIndex={1}
                    css={{ WebkitOverflowScrolling: 'touch' }}
                >
                    <ScheduleNotifyWatcher />
                    <Outlet />
                </Box>

                <BottomTabBar />
            </Flex>
        )
    }

    return (
        <Flex flexDirection={'column'} bg="bg.canvas" css={shellHeight}>
            <Box top={0} left={0} right={0} zIndex={20} bg="transparent" px={4} py={0}>
                <Flex h={14} alignItems={'center'} justifyContent={'space-between'} gap={2} minW={0}>
                    <Box flexShrink={0}>
                        <Link to={InfoRoute.to}>
                            <Image src={autopcr} alt="autopcr" h={isSmallScreen ? "26px" : "32px"} w="auto" objectFit="contain" maxW="40vw" />
                        </Link>
                    </Box>
                    <HStack as={'nav'} gap={isSmallScreen ? 1 : 4} minW={0}>
                        <NavItem key="dashboard" href={InfoRoute.to} icon={FiHome} >
                            一览
                        </NavItem>
                        {role?.admin && <NavItem key="user" href={UsersRoute.to} icon={FiUsers}>
                            用户管理
                        </NavItem>}
                        <NavItem key="logout" icon={FiCompass} onClick={handleLogout}>
                            登出
                        </NavItem>
                    </HStack>
                    <Flex alignItems={'center'} gap={isSmallScreen ? 1 : 2} flexShrink={0}>
                        <RunningStatus compact={isSmallScreen} />
                        <Button
                            aria-label="Toggle color mode"
                            onClick={toggleColorMode}
                            size={isSmallScreen ? "sm" : "md"}
                            px={0}
                            variant="ghost"
                            colorPalette="brand"
                        >
                            {colorMode === 'light' ? <LuSun /> : <LuMoon />}
                        </Button>
                    </Flex>
                </Flex>
            </Box>

            <Flex p={4} flex={1} overflow={'auto'} flexDirection={'column'} zIndex={1}>
                <ScheduleNotifyWatcher />
                <Outlet />
            </Flex>

            <Box py={0} pb={2} bg="transparent" px={4} textAlign='right'>
                <Text fontSize="xs" color="fg.muted">
                    Powered by <a href="https://github.com/cc004/autopcr" target="_blank" rel="noreferrer">AutoPCR</a> & <a href="https://github.com/Lanly109/AutoPCR_Web" target="_blank" rel="noreferrer">AutoPCR_Web</a> · {APP_VERSION}
                </Text>
            </Box>
        </Flex>
    )
}
