import { getAccountValidate, postAccountValidate } from '@api/Account';

import { AxiosError } from 'axios';
// @ts-ignore
import Geetest from 'react-geetest';
import NiceModal from '@ebay/nice-modal-react';
import ValidateModal from './ValidateModal';
import { toaster } from '../../components/ui/toaster';

export interface ValidateProps {
    id: string;
    userid: string;
    gt: string;
    challenge: string;
    onClose?: () => void;
}

interface GeetestResponse {
    geetest_challenge: string;
    geetest_validate: string;
    geetest_seccode: string;
}

/** 轮询定时器句柄：组件卸载 / 主动停止时清掉，避免卸载后继续发请求与弹窗 */
let validateTimer: number | undefined = undefined;
/** 弹窗在途标记：弹窗期间轮询仍会继续，但不重复弹（否则每秒叠一层） */
let validateModalShowing = false;

/** 停止轮询（供调用方在卸载时调用） */
export function stopQueryValidate(): void {
    if (validateTimer !== undefined) {
        clearTimeout(validateTimer);
        validateTimer = undefined;
    }
}

export function QueryValidate(alias: string, left_cnt = 120) {
    if (left_cnt < 0) {
        stopQueryValidate();
        toaster.create({ type: 'error', title: '验证查询超时' });
        return;
    }
    getAccountValidate().then(async (res) => {
        if (res.status === 'empty') {
            validateTimer = window.setTimeout(QueryValidate, 1000, alias, left_cnt - 1);
        } else if (res.status == "ok") {
            // do nothing（已无待验证项：不再排下一次）
            stopQueryValidate();
        } else {
            // 关键：这里也必须递减 left_cnt。原实现漏传该参数，值回落默认 120，
            // 于是只要后端持续返回非 ok/empty 状态，计数器永不归零 → 无限轮询
            validateTimer = window.setTimeout(QueryValidate, 1000, alias, left_cnt - 1);
            if (validateModalShowing) return;
            validateModalShowing = true;
            try {
                await NiceModal.show(ValidateModal, { alias: alias, id: res.id, userid: res.userid, gt: res.gt, challenge: res.challenge });
            } finally {
                validateModalShowing = false;
            }
        }
    }).catch((err: AxiosError) => {
        toaster.create({ type: 'error', title: '验证查询失败', description: err?.response?.data as string || "网络错误" });
    })
}

export default function Validate({ id, userid, gt, challenge, onClose }: ValidateProps) {
    const onSuccess = (isSuccess: GeetestResponse) => {
        const { geetest_challenge, geetest_validate } = isSuccess;
        postAccountValidate(id, geetest_challenge, geetest_validate, userid).then(() => {
            if (typeof (onClose) === 'undefined') {
                window.close();
            } else {
                onClose();
            }
        }).catch((err: AxiosError) => {
            toaster.create({ title: '发送验证信息失败', type: 'error', description: err?.response?.data as string || '网络问题' });
        });
    }

    return (
        <Geetest
            gt={gt}
            challenge={challenge}
            onSuccess={onSuccess}
            https={true}
            width="300px"
            captch_type={1}
            gs={1}
            offline={false}
        />
    );
}
