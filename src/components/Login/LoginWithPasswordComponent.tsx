import {
    Box,
    Button,
    Input,
    Stack,
    Text,
} from '@chakra-ui/react'
import {
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
} from '../../components/ui/modal'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useEffect } from 'react'

import { Checkbox } from '../../components/ui/checkbox'
import { Field } from '../../components/ui/field'
import { Route as InfoRoute } from '@routes/daily/_sidebar/account/index'
import { postLoginWithPassword } from '@api/Login'
import { postRegister } from '@api/Register'
import { toaster } from '../../components/ui/toaster'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { clearCredential, loadCredential, saveCredential } from '@/utils/credentialStore'
import { safeGetItem, safeRemoveItem, safeSetItem } from '@components/Account/accountShared'

interface Inputs {
    qq: string
    password: string
}

export default function LoginWithPasswordComponent() {
    const navigate = useNavigate();
    const {
        handleSubmit,
        register,
        setValue,
        formState: { isSubmitting, errors },
    } = useForm<Inputs>({ defaultValues: { qq: '', password: '' } })
    const [remember, setRemember] = useState<boolean>(() => safeGetItem('remember') === 'true');
    const [isForgotOpen, setIsForgotOpen] = useState(false);

    // 勾选过「记住我」时把加密保存的凭据解密回填。异步进行，回填前输入框保持为空。
    useEffect(() => {
        if (!remember) return;
        let cancelled = false;
        void loadCredential().then((saved) => {
            if (cancelled || !saved) return;
            setValue('qq', saved.qq);
            setValue('password', saved.password);
        });
        return () => {
            cancelled = true;
        };
    }, [remember, setValue]);

    /**
     * 记住登录信息：QQ 明存（不是秘密），密码经 AES-GCM 加密后存储。
     * 加密不可用时拒绝写明文，只保留 QQ —— 宁可少一个便利，也不留明文密码。
     */
    const handleRember = async (values: Inputs) => {
        safeSetItem('remember', remember ? 'true' : 'false');
        if (!remember) {
            safeRemoveItem('qq');
            clearCredential();
            return;
        }
        safeSetItem('qq', values.qq);
        const saved = await saveCredential(values.qq, values.password);
        if (!saved) {
            clearCredential();
            toaster.create({
                type: 'warning',
                title: '密码未能保存',
                description: '当前浏览器不支持加密存储，下次需手动输入密码',
            });
        }
    }

    const handleLogin: SubmitHandler<Inputs> = async (values) => {
        const res = await postLoginWithPassword(values.qq, values.password);
        await handleRember(values);
        toaster.create({ title: "登录成功", type: "success", description: res });
        await navigate({ to: InfoRoute.to });
    }

    const handleRegister: SubmitHandler<Inputs> = async (values) => {
        const res = await postRegister(values.qq, values.password);
        await handleRember(values);
        toaster.create({ title: "注册成功", type: "success", description: res });
        await navigate({ to: InfoRoute.to });
    }

    return (
        <Box w="full">
            <form onSubmit={handleSubmit(handleLogin)}>
                <Stack gap={4}>
                    <Field invalid={!!errors.qq} label="QQ" errorText={errors.qq?.message}>
                        <Input type="text"
                            {...register('qq')}
                            placeholder='5位以上'
                            autoComplete="username"
                            size="lg"
                            minH={{ base: '52px', md: undefined }}
                        />
                    </Field>
                    <Field invalid={!!errors.password} label="密码" errorText={errors.password?.message}>
                        <Input type="password"
                            {...register('password')}
                            placeholder='8位以上,非QQ密码'
                            autoComplete="current-password"
                            size="lg"
                            minH={{ base: '52px', md: undefined }}
                        />
                    </Field>
                    <Stack gap={10}>
                        <Stack
                            direction={{ base: 'column', sm: 'row' }}
                            align={'start'}
                            justify={'space-between'}>
                            <Checkbox
                                checked={remember}
                                onCheckedChange={(e) => setRemember(!!e.checked)}
                                title="记住后会加密保存在本机；共用设备不建议勾选"
                            >
                                记住我
                            </Checkbox>
                            <Text 
                                color="fg.muted" 
                                fontSize="sm" 
                                cursor="pointer"
                                display="flex"
                                alignItems="center"
                                minH={{ base: '44px', md: undefined }}
                                _hover={{ color: "fg.emphasized", textDecoration: "underline" }}
                                onClick={() => setIsForgotOpen(true)}
                            >
                                忘记密码？
                            </Text>
                        </Stack>
                        <Button
                            colorPalette="brand"
                            loading={isSubmitting} type='submit'
                            minH={{ base: '52px', md: undefined }}
                        >
                            登录
                        </Button>
                        <Button
                            colorPalette="brand"
                            loading={isSubmitting}
                            onClick={handleSubmit(handleRegister)}
                            minH={{ base: '52px', md: undefined }}
                        >
                            注册
                        </Button>
                    </Stack>
                </Stack>
            </form>

            <Modal isOpen={isForgotOpen} onClose={() => setIsForgotOpen(false)}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>忘记密码</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Text>如需重置密码，请联系系统维护人员。</Text>
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={() => setIsForgotOpen(false)}>我知道了</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    )
}
