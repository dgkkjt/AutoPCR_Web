import {
    Button,
    Card,
    Flex,
    SimpleGrid,
    Stack,
    Text,
    useDisclosure,
    Box,
    HStack,
    Badge
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { deleteUser, getAllUsers, getClanForbid, putUser, useUserRole } from "@api/Account.ts";

import Alert from "@components/alert.tsx";
import { AxiosError } from "axios";
import { Checkbox } from '../../components/ui/checkbox'
import { CloseButton } from '../../components/ui/close-button'
import { FiUnlock, FiPlus, FiShield, FiUser } from "react-icons/fi";
import NiceModal from "@ebay/nice-modal-react";
import { Switch } from '../../components/ui/switch'
import { UserInfo } from "@interfaces/UserInfo.ts";
import clanForbid from "./ChangeClanForbidUserModal";
import createUserModal from "./CreateUserModal";
import resetPasswdModal from "./ResetPasswdModal";
import { toaster } from '../../components/ui/toaster'

export default function Users() {

    const freshUserInfo = useDisclosure();
    const [users, setUsers] = useState<UserInfo[]>();

    useEffect(() => {
        getAllUsers().then((res) => {
            setUsers(res);
        }).catch((err: AxiosError) => {
            toaster.create({ type: 'error', title: err?.response?.data as string || '网络错误' });
        });
    }, [freshUserInfo.open]);

    const role = useUserRole();

    const createUser = () => {
        NiceModal.show(createUserModal, {}).then(() => {
            freshUserInfo.onToggle()
        }).catch(() => { return });
    }

    const setClanForbid = () => {
        getClanForbid().then(async (res) => {
            await NiceModal.show(clanForbid, { accs: res });
        }).catch((err: AxiosError) => {
            toaster.create({ type: 'error', title: err?.response?.data as string || '网络错误' });
        })
    }


    return (
        <Stack height={'100%'} p={4} gap={6}>
            <Card.Root variant="elevated" bg="bg.panel" shadow="sm" borderRadius="2xl">
                <Card.Body py={3} px={4}>
                    {/* 手机形态：标题与按钮各占一行，避免 358px 可用宽下两个按钮被压扁 */}
                    <Flex
                        direction={{ base: 'column', md: 'row' }}
                        justify="space-between"
                        align={{ base: 'stretch', md: 'center' }}
                        gap={3}
                    >
                        <Text fontSize="lg" fontWeight="bold">用户管理</Text>
                        <HStack gap={3}>
                           <Button flex={1} size="sm" minH={{ base: '44px', md: undefined }} variant="surface" colorPalette="blue" onClick={createUser}><FiPlus /> 创建用户</Button>
                           <Button flex={1} size="sm" minH={{ base: '44px', md: undefined }} variant="surface" colorPalette="orange" onClick={setClanForbid}><FiShield /> 会战禁用</Button>
                        </HStack>
                    </Flex>
                </Card.Body>
            </Card.Root>

            {/* min(280px,100%)：极窄屏下轨道不超过容器，避免卡片溢出 */}
            <SimpleGrid gap={4} templateColumns='repeat(auto-fill, minmax(min(280px, 100%), 1fr))'>
                {
                    users?.map((user) => {
                        // 仅超管可更改管理员用户
                        const allowManage = role?.super_user == true
                        const allowEdit = (user.admin == true && role?.super_user == true) || (user.admin == false)
                        return <UserInfoItem key={user.qq} qq={user.qq} onToggle={freshUserInfo.onToggle} clan={user.clan} admin={user.admin}
                            userDisabled={user.disabled} accountCount={user.account_count}
                            allowEdit={allowEdit} allowManage={allowManage} />
                    })
                }
            </SimpleGrid>
        </Stack>
    )
}

interface UserInfoProps {
    qq?: string
    userDisabled?: boolean
    clan?: boolean
    admin?: boolean
    accountCount?: number
    allowManage?: boolean
    allowEdit?: boolean
    onToggle: () => void
}

function UserInfoItem({ qq, userDisabled, clan, admin, accountCount, allowManage, allowEdit, onToggle }: UserInfoProps) {
    const cancelRef = React.useRef<HTMLButtonElement>(null)

    const deleteConfirm = useDisclosure()
    const handleDeleteUser = () => {
        if (qq == undefined) {
            return
        }
        deleteUser(qq).then((res) => {
            toaster.create({ type: 'success', title: `删除用户${qq}成功`, description: res });
            deleteConfirm.onClose()
            onToggle()
        }).catch((err: AxiosError) => {
            toaster.create({ type: 'error', title: err?.response?.data as string || '网络错误' });
        });
    }

    const handleUpdateUser = (userInfo: UserInfo, onSuccess: () => void) => {
        if (qq == undefined) {
            return
        }
        putUser(qq, userInfo).then((res) => {
            toaster.create({ type: 'success', title: `更新用户${qq}成功`, description: res });
            onSuccess()
            onToggle()
        }).catch((err: AxiosError) => {
            toaster.create({ type: 'error', title: err?.response?.data as string || '网络错误' });
        });
    }
    const disableConfirm = useDisclosure()
    const handleDisableUser = () => {
        handleUpdateUser({
            disabled: !userDisabled
        }, disableConfirm.onClose)
    }
    const adminConfirm = useDisclosure()
    const handleAdminUser = () => {
        handleUpdateUser({
            admin: !admin
        }, adminConfirm.onClose)
    }
    const handleClanUser = () => {
        handleUpdateUser({
            clan: !clan
        }, adminConfirm.onClose)
    }

    const startRstPwd = () => {
        NiceModal.show(resetPasswdModal, {}).then((res) => {
            handleUpdateUser({
                password: res as string
            }, () => { NiceModal.hide(resetPasswdModal).then(() => { return }).catch(() => { return }) })
        }).catch(() => { return });
    }

    return (
        <Card.Root 
            bg="bg.panel" 
            shadow="sm" 
            borderRadius="2xl" 
            borderWidth="1px" 
            borderColor="border.subtle"
            transition="all 0.2s"
            _hover={{ shadow: 'md', transform: 'translateY(-2px)', borderColor: "blue.400" }}
        >
            <Card.Header pb={2}>
                <Flex justify="space-between" align="center">
                    <HStack>
                        <Box 
                            w="40px" h="40px" 
                            borderRadius="full" 
                            bg={userDisabled ? "gray.100" : "blue.50"} 
                            color={userDisabled ? "gray.500" : "blue.600"}
                            display="flex" alignItems="center" justifyContent="center"
                            fontSize="xl"
                        >
                            <FiUser />
                        </Box>
                        <Stack gap={0}>
                            <Text fontWeight="bold" fontSize="md">{qq}</Text>
                             <Badge colorPalette={userDisabled ? "gray" : "green"} variant="subtle">
                                {userDisabled ? "已禁用" : "正常"}
                            </Badge>
                        </Stack>
                    </HStack>

                    <CloseButton 
                        size="sm" 
                        variant="ghost" 
                        colorPalette="gray"
                        _hover={{ bg: "red.100", color: "red.600" }}
                        onClick={deleteConfirm.onOpen} 
                        disabled={!allowEdit} 
                    />
                    
                    <Alert leastDestructiveRef={cancelRef} isOpen={deleteConfirm.open} onClose={deleteConfirm.onClose}
                        title="删除用户" body={`确定删除用户${qq}吗？`} onConfirm={handleDeleteUser}/>
                    <Alert leastDestructiveRef={cancelRef} isOpen={disableConfirm.open} onClose={disableConfirm.onClose}
                        title={`${userDisabled ? "启用" : "禁用"}用户`} body={`确定${userDisabled ? "启用" : "禁用"}用户${qq}吗？`}
                        onConfirm={handleDisableUser}/>
                </Flex>
            </Card.Header>
            <Card.Body py={3}>
                <Stack gap={3}>
                    <Flex justify="space-between" align="center" bg="bg.subtle" p={2} borderRadius="md">
                        <Text fontSize="sm" color="fg.muted">管理账户数</Text>
                        <Text fontWeight="bold">{accountCount}</Text>
                    </Flex>
                    
                    <HStack justify="space-between">
                         <Flex align="center" gap={2}>
                            <Text fontSize="sm">启用状态</Text>
                            <Switch 
                                size="sm" 
                                colorPalette="green"
                                checked={!userDisabled} 
                                onCheckedChange={disableConfirm.onOpen} 
                                disabled={!allowEdit} 
                            />
                         </Flex>
                    </HStack>

                    <Stack gap={2}>
                         <Checkbox variant="subtle" colorPalette="purple" checked={admin} onCheckedChange={handleAdminUser} disabled={!allowManage}>管理员权限</Checkbox>
                         <Checkbox variant="subtle" colorPalette="orange" checked={clan} onCheckedChange={handleClanUser} disabled={!allowManage}>公会管理权限</Checkbox>
                    </Stack>
                </Stack>
            </Card.Body>
            <Card.Footer pt={0}>
                <Button 
                    w="full" 
                    variant="surface" 
                    colorPalette="pink" 
                    size="sm"
                    minH={{ base: '44px', md: undefined }}
                    onClick={startRstPwd} 
                    disabled={!allowEdit}
                >
                    <FiUnlock /> 重设密码
                </Button>
            </Card.Footer>
        </Card.Root>
    )
}
