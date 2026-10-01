import './polyfills/structuredClone'
import App from './App.tsx'
import NiceModal from '@ebay/nice-modal-react';
import { Provider } from './components/ui/provider'
import ReactDOM from 'react-dom/client'
import { Toaster } from './components/ui/toaster'

ReactDOM.createRoot(document.getElementById('root')!).render(
    // <React.StrictMode>
    <Provider>
        <NiceModal.Provider>
            <App />
            <Toaster />
        </NiceModal.Provider>
    </Provider>
    // </React.StrictMode>,
)

/**
 * 交接启动骨架
 *
 * index.html 里的骨架是纯 HTML/CSS，在 JS 解析之前就能绘制，覆盖「白屏期」。
 * React 首次提交后由这里移除——之后页面内已有自己的骨架（问候条、账号卡片），
 * 两者交接，用户看到的是连续的一块骨架而不是白屏→内容。
 *
 * 用双 rAF 确保这次提交已经上屏，避免闪一下空白。
 */
const hideBootSkeleton = () => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const el = document.getElementById('boot-skeleton')
            if (!el) return
            el.style.opacity = '0'
            const remove = () => el.remove()
            el.addEventListener('transitionend', remove, { once: true })
            // 过渡被禁用（reduced-motion / 动画未触发）时兜底移除
            window.setTimeout(remove, 400)
            window.dispatchEvent(new Event('autopcr:boot-done'))
        })
    })
}

hideBootSkeleton()
