import {defineConfig, loadEnv, type Plugin} from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import path from 'path'
import { visualizer } from "rollup-plugin-visualizer";
import { splitVendorChunkPlugin } from 'vite'
import obfuscator from 'rollup-plugin-obfuscator';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import envCompatible from 'vite-plugin-env-compatible';

const version: string = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')).version;

/**
 * 把「入口首屏真正需要的 chunk 清单」注入 index.html。
 *
 * 用途：启动骨架的进度条需要知道分母。这份清单在构建期是确定的事实
 * （入口 chunk + 它的静态 import 闭包），注入后进度 = 已加载/总数，
 * 既不猜也不打表；关掉 modulepreload 后 HTML 里已没有 link 可读，更需要它。
 *
 * dev 模式下没有 bundle，占位脚本保持空，前端自动回退到「读 HTML 已声明资源」。
 */
function bootChunkManifest(): Plugin {
  return {
    name: 'autopcr-boot-chunk-manifest',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = (ctx as { bundle?: Record<string, unknown> }).bundle
        if (!bundle) return html

        type Chunk = { type: string; fileName: string; isEntry?: boolean; imports?: string[] }
        const entry = Object.values(bundle).find(
          (f) => (f as Chunk).type === 'chunk' && (f as Chunk).isEntry,
        ) as Chunk | undefined
        if (!entry) return html

        const seen = new Set<string>()
        const walk = (chunk: Chunk | undefined) => {
          if (!chunk || seen.has(chunk.fileName)) return
          seen.add(chunk.fileName)
          for (const imp of chunk.imports || []) walk(bundle[imp] as Chunk)
        }
        walk(entry)

        const urls = [...seen].map((f) => `/daily/${f}`)
        const tag = `<script>window.__BOOT_CHUNKS__=${JSON.stringify(urls)};</script>`
        return html.replace('<script id="boot-manifest"></script>', tag)
      },
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: '/daily',
    server: {
      proxy: {
        "/daily/api": {
          target: env.AUTOPCR_SERVER_HOST || 'http://localhost:13200',
          changeOrigin: true,
        },
      },
      host: env.AUTOPCR_WEBUI_LISTEN || 'localhost'
    },
    define: {
      'APP_VERSION': JSON.stringify(version),
    },
    plugins: [
      react(),
      TanStackRouterVite(),
      bootChunkManifest(),
      splitVendorChunkPlugin(),
      // 体积分析只在显式开启时跑：原来每次 build 都会生成 stats.html 并自动弹浏览器，
      // 既拖慢构建，也让 CI 里出现无意义的外部动作。需要时用 ANALYZE=1 npm run build
      ...(process.env.ANALYZE
        ? [visualizer({ open: true })]
        : []),
      envCompatible({
        mountedPath: 'process.env',
      }),
      // 混淆是「防篡改」与「加载速度」之间的取舍：controlFlowFlattening / stringArray base64 /
      // selfDefending 都会显著增大产物体积并拖慢解析执行。设 OBFUSCATE=0 可构建未混淆版本做对比。
      ...(process.env.OBFUSCATE === '0' ? [] : [obfuscator({
        global:false,
        options: {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          numbersToExpressions: true,
          simplify: true,
          stringArrayShuffle: true,
          splitStrings: true,
          splitStringsChunkLength: 10,
          rotateUnicodeArray: true,
          deadCodeInjection: false,
          // deadCodeInjectionThreshold: 0.4,
          debugProtection: false,
          debugProtectionInterval: 2000,
          disableConsoleOutput: true,
          domainLock: [],
          identifierNamesGenerator: "hexadecimal",
          identifiersPrefix: "",
          inputFileName: "",
          log: true,
          renameGlobals: true,
          reservedNames: [],
          reservedStrings: [],
          seed: 0,
          selfDefending: true,
          sourceMap: false,
          sourceMapBaseUrl: "",
          sourceMapFileName: "",
          sourceMapMode: "separate",
          stringArray: true,
          stringArrayEncoding: ["base64"],
          stringArrayThreshold: 0.75,
          target: "browser",
          transformObjectKeys: true,
          unicodeEscapeSequence: true,

          domainLockRedirectUrl: "about:blank",
          forceTransformStrings: [],
          identifierNamesCache: null,
          identifiersDictionary: [],
          ignoreImports: true,
          optionsPreset: "default",
          renameProperties: false,
          renamePropertiesMode: "safe",
          sourceMapSourcesMode: "sources-content",

          stringArrayCallsTransform: true,
          stringArrayCallsTransformThreshold: 0.5,

          stringArrayIndexesType: ["hexadecimal-number"],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayWrappersCount: 1,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 2,
          stringArrayWrappersType: "variable",
        }
      })]),
    ],
	build: {
		target: 'es2020',         
		sourcemap: false,        
		brotliSize: true,
		// 默认关掉 modulepreload（设 MODULE_PRELOAD=1 可回退对比）。
		// 实测（4G + 4x CPU）：6 条 preload 会把首绘从 1288ms 推到 2480ms（骨架被压后约 1.1s），
		// 而 DCL 只快 61ms。首绘是用户真正感知的指标，这里用 61ms 换 1.1s。
		modulePreload: process.env.MODULE_PRELOAD === '1',
		rollupOptions: {
		  output: {
			manualChunks(id) {
			  if (id.includes('node_modules')) {
                // xlsx 必须单独成 chunk：它与 file-saver 混在一起时，只要 file-saver 被静态引用，
                // 整块（含 285KB 的 xlsx）就会被写进 index.html 的 modulepreload，首屏白下载。
                // 现在 xlsx 只在「导出 Excel」点击时才动态 import。
                if (id.includes('xlsx')) return 'xlsx';
                if (id.includes('file-saver')) return 'utils';
                if (id.includes('react-icons')) return 'icons';
                if (id.includes('@chakra-ui') || id.includes('@emotion') || id.includes('framer-motion')) return 'chakra';
                if (id.includes('@tanstack') || id.includes('react-location')) return 'tanstack';
                if (id.includes('axios')) return 'utils';
                if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
                
				return 'vendor'
			  }
			}
		  }
		}
	},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@interfaces': path.resolve(__dirname, 'src/interfaces'),
        '@routes': path.resolve(__dirname, 'src/routes'),
      },
    },
  }
})
