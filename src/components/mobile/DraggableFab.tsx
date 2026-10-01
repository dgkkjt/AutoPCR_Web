import { useCallback, useEffect, useRef, useState } from 'react'

import { IconButton, type IconButtonProps } from '@components/ui/icon-button'
import { APPBAR_H, SAFE_BOTTOM, TABBAR_H } from './SafeArea'

/**
 * 可拖动的悬浮按钮
 *
 * 需求背景：导航球固定在右下角，会压住账号详情页最后几行配置，用户希望自己挪开。
 *
 * 关键约定：
 * - 位置用「距右 / 距下」表示而不是 left/top：视口变化（横竖屏、地址栏收放）时
 *   贴着的那一侧仍贴着，不会跑到屏幕外。
 * - 拖动与点击分离：位移超过阈值才算拖动，抬手不触发 onClick。
 *   少了这个判断，用户拖完松手会顺带把目录面板弹出来。
 * - 用 Pointer Events + setPointerCapture：触摸 / 鼠标 / 触控笔一套逻辑，
 *   且指针移出按钮范围后仍能继续拖动。
 *
 * 边界：始终完整留在「AppBar 下方 ~ 底部 Tab 上方」的区域内，
 * 不会盖住顶栏，也不会被 Tab 栏遮住。
 */
export interface DraggableFabProps extends Omit<IconButtonProps, 'onClick'> {
    /** 位置持久化键；不传则只在本次会话有效 */
    storageKey?: string
    /** 抬手且未发生拖动时触发（即真正的「点击」） */
    onClick?: () => void
    /** 距右 / 距下的初始值 */
    defaultOffset?: { right: number; bottom: number }
}

interface Offset {
    right: number
    bottom: number
}

const MARGIN = 12
/** 位移超过这个距离才算拖动，避免手指轻微抖动就吃掉点击 */
const DRAG_THRESHOLD = 6
const BUTTON_SIZE = 52

function readStored(key?: string): Offset | null {
    if (!key) return null
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<Offset>
        if (typeof parsed?.right === 'number' && typeof parsed?.bottom === 'number') {
            return { right: parsed.right, bottom: parsed.bottom }
        }
    } catch {
        // 隐私模式 / 数据损坏：忽略，用默认位置
    }
    return null
}

/** 把偏移夹回可视范围：AppBar 之下、底部 Tab 之上、四周留边 */
function clampOffset(offset: Offset, size: number = BUTTON_SIZE): Offset {
    const vw = window.innerWidth
    const vh = window.innerHeight
    // 顶栏/底栏高度受安全区影响，读实际渲染高度比用常量准
    const header = document.querySelector<HTMLElement>('[data-app-bar]')
    const tabbar = document.querySelector<HTMLElement>('[data-tab-bar]')
    const topLimit = (header?.getBoundingClientRect().height ?? APPBAR_H) + MARGIN
    const bottomLimit = (tabbar?.getBoundingClientRect().height ?? TABBAR_H) + MARGIN

    return {
        right: Math.min(Math.max(offset.right, MARGIN), Math.max(MARGIN, vw - size - MARGIN)),
        bottom: Math.min(
            Math.max(offset.bottom, bottomLimit),
            Math.max(bottomLimit, vh - size - topLimit),
        ),
    }
}

export function DraggableFab({
    storageKey,
    onClick,
    defaultOffset = { right: 16, bottom: 24 },
    ...rest
}: DraggableFabProps) {
    const [offset, setOffset] = useState<Offset>(() => readStored(storageKey) ?? defaultOffset)
    const [dragging, setDragging] = useState(false)

    const dragRef = useRef<{
        pointerId: number
        startX: number
        startY: number
        startRight: number
        startBottom: number
        moved: boolean
    } | null>(null)

    /**
     * 「这次抬手要不要吞掉 click」
     *
     * 必须用 ref 而不是 dragging 这个 state：pointerup 里 setDragging(false) 会先提交，
     * 随后浏览器派发的 click 读到的已是新值，于是拖动完松手会顺带把目录面板弹出来（实测到了）。
     * ref 是同步的，不受渲染时序影响。
     */
    const suppressClickRef = useRef(false)

    /** 实测按钮尺寸，供边界夹取使用（视觉尺寸可能被外层 size 覆盖，不能写死常量） */
    const sizeRef = useRef(BUTTON_SIZE)

    /** 视口变化后重新夹一次，避免按钮被留在屏幕外 */
    useEffect(() => {
        const onResize = () => setOffset((prev) => clampOffset(prev, sizeRef.current))
        window.addEventListener('resize', onResize)
        window.addEventListener('orientationchange', onResize)
        return () => {
            window.removeEventListener('resize', onResize)
            window.removeEventListener('orientationchange', onResize)
        }
    }, [])

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLButtonElement>) => {
            // 只响应主指针：多指触摸时忽略后续手指
            if (e.pointerType === 'mouse' && e.button !== 0) return
            sizeRef.current = e.currentTarget.getBoundingClientRect().width || BUTTON_SIZE
            suppressClickRef.current = false
            dragRef.current = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                startRight: offset.right,
                startBottom: offset.bottom,
                moved: false,
            }
            e.currentTarget.setPointerCapture?.(e.pointerId)
        },
        [offset.right, offset.bottom],
    )

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
        drag.moved = true
        setDragging(true)
        // 向右下拖 → 距右/距下的值变小
        setOffset(clampOffset({ right: drag.startRight - dx, bottom: drag.startBottom - dy }, sizeRef.current))
    }, [])

    const finishDrag = useCallback(
        (e: React.PointerEvent<HTMLButtonElement>) => {
            const drag = dragRef.current
            if (!drag || drag.pointerId !== e.pointerId) return
            dragRef.current = null
            e.currentTarget.releasePointerCapture?.(e.pointerId)
            setDragging(false)
            // 同步打标：紧接着派发的 click 会据此被吞掉（state 来不及更新）
            suppressClickRef.current = drag.moved
            if (!drag.moved) return; // 未移动 → 交给 onClick
            setOffset((prev) => {
                const next = clampOffset(prev, sizeRef.current)
                if (storageKey) {
                    try {
                        localStorage.setItem(storageKey, JSON.stringify(next))
                    } catch {
                        // 存不下就只保留本次会话的位置
                    }
                }
                return next
            })
        },
        [storageKey],
    )

    return (
        <IconButton
            {...rest}
            position="fixed"
            right={`${offset.right}px`}
            bottom={`calc(${offset.bottom}px + ${SAFE_BOTTOM})`}
            rounded="full"
            shadow="xl"
            zIndex={100}
            // touchAction:none 让触摸交给 pointermove，而不是被当成滚动
            css={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
            transform={dragging ? 'scale(1.08)' : undefined}
            transition={dragging ? 'none' : 'transform 0.15s ease'}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onClick={() => {
                // 刚拖动过：这次 click 是拖动的副产物，不触发业务动作
                if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    return
                }
                onClick?.()
            }}
        />
    )
}

export default DraggableFab
