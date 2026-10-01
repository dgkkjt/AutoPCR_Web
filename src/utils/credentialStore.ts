/**
 * 「记住我」的凭据存储：尽量加密落盘，绝不写明文。
 *
 * 分两档，按环境自动降级：
 *
 * ┌ 档位 ──────┬ 条件 ────────────────┬ 做法 ────────────────────────────┐
 * │ encrypted  │ 安全上下文 + WebCrypto │ AES-GCM，不可导出密钥存 IndexedDB │
 * │ obfuscated │ 其余（典型：http://） │ 随机密钥 XOR 混淆，密钥存 IndexedDB │
 * │ unavailable│ IndexedDB 也不可用    │ 不存密码，只存 QQ                  │
 * └────────────┴─────────────────────┴────────────────────────────────┘
 *
 * 关键背景：**`crypto.subtle` 只在安全上下文（HTTPS / localhost）可用**。
 * 所以 `http://192.168.x.x:端口` 这类局域网部署会直接落到 obfuscated 档——
 * 这不是「浏览器不支持」，而是「当前来源不安全」，两件事必须区分开提示。
 *
 * encrypted 档能防什么：
 *  - 直接读 localStorage（DevTools、浏览器扩展、共用电脑、离线取证）—— 读到密文；
 *  - 密钥不可导出，拿到 IndexedDB 记录也拿不到密钥字节。
 *
 * obfuscated 档能防什么（**必须说清楚**）：
 *  - 只是**混淆，不是加密**：密钥在 IndexedDB 里是 JS 可读的，同源脚本/扩展能还原。
 *  - 它挡住的只是「肉眼扫一眼 localStorage / 随便 dump 一下」这种最随意的暴露。
 *  - 想拿到 encrypted 档的真加密，**给部署加 HTTPS 即可**（自签证书也行），
 *    代码会自动升级，无需改动。
 *
 * 两档都防不住同源 XSS —— 浏览器里不存在能对抗同源脚本的客户端加密。
 * 要根治只能不存密码，改用浏览器自带密码管理器（已加 autoComplete）。
 */

// 复用项目内已有的安全读写封装（隐私模式下 localStorage 访问会抛 SecurityError）
import { safeGetItem, safeRemoveItem, safeSetItem } from '@components/Account/accountShared';

const DB_NAME = 'autopcr';
const DB_STORE = 'keys';
const DB_KEY_AES = 'credential-aes-gcm';
const DB_KEY_XOR = 'credential-xor-key';
const LS_KEY = 'autopcr_credential_v2';
/** 旧版（v1）明文/早期格式，读到就丢弃，避免误判为有效凭据 */
const LS_KEY_LEGACY = 'autopcr_credential_v1';

export interface StoredCredential {
    qq: string;
    password: string;
}

/** 存储档位：调用方据此给出准确提示 */
export type CredentialMode = 'encrypted' | 'obfuscated';

export type SaveResult =
    | { ok: true; mode: CredentialMode }
    | { ok: false; reason: 'unavailable' };

/** Web Crypto 的 subtle 只在安全上下文可用；getRandomValues 则一直可用 */
function hasSubtle(): boolean {
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

function idbGet<T>(key: string): Promise<T | undefined> {
    return openDb().then(
        (db) =>
            new Promise<T | undefined>((resolve, reject) => {
                const tx = db.transaction(DB_STORE, 'readonly');
                const req = tx.objectStore(DB_STORE).get(key);
                req.onsuccess = () => resolve(req.result as T | undefined);
                req.onerror = () => reject(req.error ?? new Error('读取失败'));
                tx.oncomplete = () => db.close();
            }),
    );
}

function idbPut(key: string, value: unknown): Promise<void> {
    return openDb().then(
        (db) =>
            new Promise<void>((resolve, reject) => {
                const tx = db.transaction(DB_STORE, 'readwrite');
                tx.objectStore(DB_STORE).put(value as never, key);
                tx.oncomplete = () => {
                    db.close();
                    resolve();
                };
                tx.onerror = () => {
                    db.close();
                    reject(tx.error ?? new Error('写入失败'));
                };
                tx.onabort = () => {
                    db.close();
                    reject(tx.error ?? new Error('写入被中止'));
                };
            }),
    );
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

/* ────────────────────────── 档位一：AES-GCM ────────────────────────── */

async function getOrCreateAesKey(): Promise<CryptoKey | null> {
    if (!hasSubtle() || !hasIndexedDB()) return null;
    try {
        const existing = await idbGet<CryptoKey>(DB_KEY_AES);
        if (existing) return existing;
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
            'encrypt',
            'decrypt',
        ]);
        await idbPut(DB_KEY_AES, key);
        return key;
    } catch {
        return null;
    }
}

async function encryptAes(qq: string, password: string): Promise<{ iv: string; ct: string } | null> {
    const key = await getOrCreateAesKey();
    if (!key) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify({ qq, password }));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return { iv: toBase64(iv.buffer), ct: toBase64(ct) };
}

async function decryptAes(ivB64: string, ctB64: string): Promise<StoredCredential | null> {
    const key = await getOrCreateAesKey();
    if (!key) return null;
    const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(ivB64) },
        key,
        fromBase64(ctB64),
    );
    return parseCredentialJson(new TextDecoder().decode(plain));
}

/* ────────────────────────── 档位二：XOR 混淆 ────────────────────────── */

/** 取（或生成）混淆密钥：随机字节，存 IndexedDB（与 localStorage 分开放） */
async function getOrCreateXorKey(): Promise<Uint8Array | null> {
    if (!hasIndexedDB()) return null;
    try {
        const raw = await idbGet<string>(DB_KEY_XOR);
        if (typeof raw === 'string' && raw.length > 0) return new Uint8Array(fromBase64(raw));
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        await idbPut(DB_KEY_XOR, toBase64(bytes.buffer));
        return bytes;
    } catch {
        return null;
    }
}

function xorBytes(bytes: Uint8Array, key: Uint8Array): Uint8Array {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
    return out;
}

async function obfuscate(qq: string, password: string): Promise<{ ct: string } | null> {
    const key = await getOrCreateXorKey();
    if (!key) return null;
    const encoded = new TextEncoder().encode(JSON.stringify({ qq, password }));
    return { ct: toBase64(xorBytes(encoded, key).buffer) };
}

async function deobfuscate(ctB64: string): Promise<StoredCredential | null> {
    const key = await getOrCreateXorKey();
    if (!key) return null;
    return parseCredentialJson(new TextDecoder().decode(xorBytes(new Uint8Array(fromBase64(ctB64)), key)));
}

/* ────────────────────────── 对外接口 ────────────────────────── */

function parseCredentialJson(text: string): StoredCredential | null {
    const parsed = JSON.parse(text) as Partial<StoredCredential>;
    if (typeof parsed?.qq !== 'string' || typeof parsed?.password !== 'string') return null;
    return { qq: parsed.qq, password: parsed.password };
}

/**
 * 保存凭据。优先真加密；环境不支持时降级为混淆；都不可用则不存密码。
 */
export async function saveCredential(qq: string, password: string): Promise<SaveResult> {
    if (!qq || !password) return { ok: false, reason: 'unavailable' };

    const aes = await encryptAes(qq, password).catch(() => null);
    if (aes) {
        safeSetItem(LS_KEY, JSON.stringify({ v: 2, alg: 'aes-gcm', iv: aes.iv, ct: aes.ct }));
        return { ok: true, mode: 'encrypted' };
    }

    const xor = await obfuscate(qq, password).catch(() => null);
    if (xor) {
        safeSetItem(LS_KEY, JSON.stringify({ v: 2, alg: 'xor', ct: xor.ct }));
        return { ok: true, mode: 'obfuscated' };
    }

    return { ok: false, reason: 'unavailable' };
}

/** 读取凭据；解析失败（密钥轮换/数据损坏）时清掉残留并返回 null */
export async function loadCredential(): Promise<StoredCredential | null> {
    // 旧格式直接丢弃，避免把 v1 的密文喂给 v2 的解法
    if (safeGetItem(LS_KEY_LEGACY) !== null) safeRemoveItem(LS_KEY_LEGACY);

    const raw = safeGetItem(LS_KEY);
    if (!raw) return null;

    try {
        const rec = JSON.parse(raw) as { v?: number; alg?: string; iv?: string; ct?: string };
        if (typeof rec?.ct !== 'string') throw new Error('格式无效');
        const cred =
            rec.alg === 'aes-gcm' && typeof rec.iv === 'string'
                ? await decryptAes(rec.iv, rec.ct)
                : await deobfuscate(rec.ct);
        return cred;
    } catch {
        // 解不出来就别留着：留着只会让用户以为「记住了」却又填不出来
        safeRemoveItem(LS_KEY);
        return null;
    }
}

/** 清除已保存的凭据（取消「记住我」等场景） */
export function clearCredential(): void {
    safeRemoveItem(LS_KEY);
    safeRemoveItem(LS_KEY_LEGACY);
}
