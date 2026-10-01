/**
 * 「记住我」的凭据存储：加密落盘，不存明文。
 *
 * 方案：AES-GCM 对称加密，密钥由 Web Crypto 生成并标为 **不可导出（extractable=false）**，
 * 密钥本体存在 IndexedDB（结构化克隆会保留其不可导出属性），密文存 localStorage。
 *
 * 能防什么：
 *  - 任何人/任何脚本直接读 localStorage（DevTools、浏览器扩展、共用电脑、
 *    以及对 Profile 目录 LevelDB 文件的离线取证）——读到的是密文；
 *  - 密钥不可导出，即便拿到了 IndexedDB 记录也拿不到密钥字节。
 *
 * 不能防什么（必须说清楚）：
 *  - **同源 XSS**。攻击者在本页面内执行代码时，可以调用本模块把密文解出来。
 *    浏览器里不存在能对抗同源脚本的客户端加密方案——要根治只能不存密码，
 *    改用浏览器自带的密码管理器（autoComplete="current-password"）。
 *
 * 失败一律「关门」：Web Crypto / IndexedDB 不可用（隐私模式、老浏览器）时
 * 拒绝写入明文，只保留 QQ，由调用方提示用户。
 */

// 复用项目内已有的安全读写封装（隐私模式下 localStorage 访问会抛 SecurityError）
import { safeGetItem, safeRemoveItem } from '@components/Account/accountShared';

const DB_NAME = 'autopcr';
const DB_STORE = 'keys';
const DB_KEY = 'credential-aes-gcm';
const LS_KEY = 'autopcr_credential_v1';

export interface StoredCredential {
    qq: string;
    password: string;
}

function hasWebCrypto(): boolean {
    return typeof crypto !== 'undefined' && !!crypto.subtle && !!crypto.subtle.generateKey;
}

function hasIndexedDB(): boolean {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'));
    });
}

/** 取（或首次生成）不可导出的 AES-GCM 密钥 */
async function getOrCreateKey(): Promise<CryptoKey | null> {
    if (!hasWebCrypto() || !hasIndexedDB()) return null;
    let db: IDBDatabase;
    try {
        db = await openDb();
    } catch {
        return null;
    }
    try {
        const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readonly');
            const req = tx.objectStore(DB_STORE).get(DB_KEY);
            req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
            req.onerror = () => reject(req.error ?? new Error('读取密钥失败'));
        });
        if (existing) return existing;

        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
            'encrypt',
            'decrypt',
        ]);
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(key, DB_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error('写入密钥失败'));
            tx.onabort = () => reject(tx.error ?? new Error('写入密钥被中止'));
        });
        return key;
    } catch {
        return null;
    } finally {
        db.close();
    }
}

function toBase64(buf: ArrayBufferLike): string {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function fromBase64(value: string): ArrayBuffer {
    const bin = atob(value);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer as ArrayBuffer;
}

/**
 * 加密保存凭据。
 * @returns 是否成功保存了「密码」；false 表示环境不支持，密码未被保存（调用方应提示）。
 */
export async function saveCredential(qq: string, password: string): Promise<boolean> {
    if (!qq || !password) return false;
    const key = await getOrCreateKey();
    if (!key) return false;

    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(JSON.stringify({ qq, password }));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, iv: toBase64(iv.buffer), ct: toBase64(ct) }));
        return true;
    } catch {
        return false;
    }
}

/** 读取并解密凭据；解密失败（密钥轮换/数据损坏）时清掉残留并返回 null */
export async function loadCredential(): Promise<StoredCredential | null> {
    const raw = safeGetItem(LS_KEY);
    if (!raw) return null;
    const key = await getOrCreateKey();
    if (!key) return null;

    try {
        const parsed = JSON.parse(raw) as { v?: number; iv?: string; ct?: string };
        if (typeof parsed?.iv !== 'string' || typeof parsed?.ct !== 'string') throw new Error('格式无效');
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64(parsed.iv) },
            key,
            fromBase64(parsed.ct),
        );
        const decoded = JSON.parse(new TextDecoder().decode(plain)) as Partial<StoredCredential>;
        if (typeof decoded?.qq !== 'string' || typeof decoded?.password !== 'string') throw new Error('内容无效');
        return { qq: decoded.qq, password: decoded.password };
    } catch {
        // 解密不了就别留着：留着只会让用户以为「记住了」却又填不出来
        safeRemoveItem(LS_KEY);
        return null;
    }
}

/** 清除已保存的凭据（取消「记住我」、登出清理等场景） */
export function clearCredential(): void {
    safeRemoveItem(LS_KEY);
}
