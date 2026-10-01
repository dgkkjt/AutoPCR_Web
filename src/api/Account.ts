import { ModuleResult } from '@interfaces/ModuleResult';
import { API } from '@api/APIUtils';
import { AccountResponse, ValidateResponse, RunningStatusResponse } from '@interfaces/Account';
import { DefaultResponse } from '@interfaces/DefaultResponse';
import { ConfigValue, ModuleResponse } from '@interfaces/Module';
import {AccountInfo, ResultInfo, RoleInfo, UserInfo, UserInfoResponse} from '@interfaces/UserInfo';
import {useEffect, useState} from "react";

/**
 * 账号列表 / 单个账号的 stale-while-revalidate 缓存
 *
 * 动机：首页每次挂载都重新 getUserInfo、详情页的 route loader 每次都重新 getAccount，
 * 于是「详情 → 首页」「首页 → 详情」每次都要等一个网络往返才开始渲染内容。
 * 这两份数据在一次会话内的变化只来自本端的写操作，缓存 + 写操作失效即可保证正确性。
 *
 * 语义：getUserInfo / getAccount 永远发请求并把新值写回缓存；peek* 只读缓存不请求，
 * 供页面首帧立即渲染（随后照常被真实请求刷新，属于 SWR 的 stale 阶段）。
 */
let userInfoCache: UserInfoResponse | null = null;
const accountInfoCache = new Map<string, AccountResponse>();

/** 读缓存的用户信息（不发起请求）；无缓存返回 null */
export function peekUserInfo(): UserInfoResponse | null {
  return userInfoCache;
}

/** 读缓存的账号详情（不发起请求）；无缓存返回 null */
export function peekAccount(alias: string): AccountResponse | null {
  return accountInfoCache.get(alias) ?? null;
}

/** 账号信息类写操作后统一失效：下一次 peek 拿不到旧值，页面会走真实请求 */
export function invalidateAccountInfoCache(alias?: string): void {
  userInfoCache = null;
  if (alias === undefined) accountInfoCache.clear();
  else accountInfoCache.delete(alias);
}

const ACCOUNT_CONFIG_CACHE_LIMIT = 24;
const accountConfigCache = new Map<string, ModuleResponse>();
const accountConfigRequests = new Map<string, Promise<ModuleResponse>>();
let accountConfigCacheVersion = 0;

const accountConfigCacheKey = (alias: string, area: string) => `${alias}\u0000${area}`;

function cacheAccountConfig(key: string, config: ModuleResponse) {
  // Reinsert hits at the end so the map also acts as a small LRU cache.
  accountConfigCache.delete(key);
  accountConfigCache.set(key, config);

  while (accountConfigCache.size > ACCOUNT_CONFIG_CACHE_LIMIT) {
    const oldestKey = accountConfigCache.keys().next().value;
    if (oldestKey === undefined) break;
    accountConfigCache.delete(oldestKey);
  }
}

function updateCachedAccountConfigs(alias: string, configs: Record<string, ConfigValue>) {
  const keyPrefix = `${alias}\u0000`;
  const updates: [string, ModuleResponse][] = [];

  for (const [key, cached] of accountConfigCache) {
    if (!key.startsWith(keyPrefix)) continue;

    const relevantEntries = Object.entries(configs).filter(([configKey]) =>
      Object.prototype.hasOwnProperty.call(cached.config, configKey),
    );
    if (relevantEntries.length === 0) continue;

    updates.push([key, {
      ...cached,
      config: { ...cached.config, ...Object.fromEntries(relevantEntries) },
    }]);
  }

  for (const [key, updated] of updates) {
    cacheAccountConfig(key, updated);
  }
}

function clearCachedAccountConfigs(alias?: string) {
  // Prevent requests started before an import/sync/delete from repopulating stale data.
  accountConfigCacheVersion += 1;

  if (alias === undefined) {
    accountConfigCache.clear();
    accountConfigRequests.clear();
    return;
  }

  const keyPrefix = `${alias}\u0000`;
  for (const key of accountConfigCache.keys()) {
    if (key.startsWith(keyPrefix)) accountConfigCache.delete(key);
  }
  for (const key of accountConfigRequests.keys()) {
    if (key.startsWith(keyPrefix)) accountConfigRequests.delete(key);
  }
}

export function useUserRole() {
  const [role, setRole] = useState<RoleInfo>()

  useEffect(() => {
    API.get<RoleInfo>('/role').then(response => {
      setRole(response.data)
    }).catch(() => {return})
  }, []);

  return role;
}

export async function getClanForbid() {
	const response = await API.get<DefaultResponse>('/clan_forbid');
	return response.data;
}

export async function putClanForbid(accs: string) {
	const response = await API.put<DefaultResponse>('/clan_forbid', {
		accs: accs,
	});
	return response.data;
}

export async function getUserInfo() {
  const response = await API.get<UserInfoResponse>('/account');
  // 载荷不完整（如 200 但缺 accounts）时不入缓存，避免把残缺数据当成「真没账号」渲染
  if (response.data?.accounts) userInfoCache = response.data;
  return response.data;
}

export async function putUserInfo(userInfo: UserInfoResponse) {
  const response = await API.put<DefaultResponse>('/account', userInfo);
  invalidateAccountInfoCache();
  return response.data;
}

export async function postAccountImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await API.post<DefaultResponse>('/account/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  clearCachedAccountConfigs();
  invalidateAccountInfoCache();
  return response.data;
}

export async function postAccount(alias: string) {
  const response = await API.post<DefaultResponse>(`/account`, {
    alias: alias,
  });
  invalidateAccountInfoCache();
  return response.data;
}

export async function deleteAccount() {
  const response = await API.delete<DefaultResponse>(`/`);
  clearCachedAccountConfigs();
  invalidateAccountInfoCache();
  return response.data;
}

export async function clearAccounts() {
  const response = await API.delete<DefaultResponse>(`/account`);
  clearCachedAccountConfigs();
  invalidateAccountInfoCache();
  return response.data;
}

export async function postAccountSyncConfig(alias: string) {
  const response = await API.post<DefaultResponse>(`/account/sync`, {
    alias: alias,
  });
  clearCachedAccountConfigs(alias);
  return response.data;
}

export async function getAccount(alias: string) {
  const response = await API.get<AccountResponse>(`/account/${encodeURIComponent(alias)}`);
  if (response.data) accountInfoCache.set(alias, response.data);
  return response.data;
}

export async function delAccount(alias: string) {
  const response = await API.delete<DefaultResponse>(`/account/${encodeURIComponent(alias)}`);
  clearCachedAccountConfigs(alias);
  invalidateAccountInfoCache(alias);
  return response.data;
}

export async function putAccount(alias: string, account: string, password: string, channel: string, batch_accounts: (string | number)[]) {
  const response = await API.put<DefaultResponse>(`/account/${encodeURIComponent(alias)}`, {
    username: account,
    password: password,
    channel: channel,
	batch_accounts: batch_accounts
  });
  // 改名/改密码/改渠道都会改变账号详情，缓存必须失效，否则详情页会先渲染旧值
  invalidateAccountInfoCache(alias);
  return response.data;
}

export async function getAccountConfig(alias: string, area: string) {
  const key = accountConfigCacheKey(alias, area);
  const cached = accountConfigCache.get(key);
  if (cached) {
    cacheAccountConfig(key, cached);
    return cached;
  }

  const pendingRequest = accountConfigRequests.get(key);
  if (pendingRequest) return pendingRequest;

  const requestVersion = accountConfigCacheVersion;
  const request = API.get<ModuleResponse>(`/account/${encodeURIComponent(alias)}/${encodeURIComponent(area)}`)
    .then((response) => {
      if (requestVersion === accountConfigCacheVersion) {
        cacheAccountConfig(key, response.data);
      }
      return response.data;
    })
    .finally(() => {
      if (accountConfigRequests.get(key) === request) {
        accountConfigRequests.delete(key);
      }
    });

  accountConfigRequests.set(key, request);
  return request;
}

export async function putAccountConfig(alias: string, key: string, value: ConfigValue) {
  return putAccountConfigs(alias, {[key]: value})
}

export async function putAccountConfigs(alias: string, configs: Record<string, ConfigValue>) {
  const response = await API.put<DefaultResponse>(`/account/${encodeURIComponent(alias)}/config`, configs);
  updateCachedAccountConfigs(alias, configs);
  return response.data;
}

export async function postAccountAreaDaily(alias: string) {
  const response = await API.post<AccountInfo>(`/account/${encodeURIComponent(alias)}/do_daily`, {}, {
    timeout: 10 * 60 * 1000,
  });
  return response.data;
}

export async function postAccountAreaSingle(alias: string, module: string) {
  const response = await API.post<ResultInfo[]>(`/account/${encodeURIComponent(alias)}/do_single`, {
    order: module
  }, {
    timeout: 10 * 60 * 1000,
  });
  return response.data;
}

export async function getAccountDailyResultList(alias: string) {
  const response = await API.get<ResultInfo[]>(`/account/${encodeURIComponent(alias)}/daily_result`);
  return response.data
}

export async function getAccountDailyResult(alias: string, id: number) {
  const response = await API.get<Blob>(`/account/${encodeURIComponent(alias)}/daily_result/${encodeURIComponent(id)}`,
    {
		responseType: "blob",
		timeout: 1 * 60 * 1000
  });
  const imageUrl = window.URL.createObjectURL(response.data);
  return imageUrl
}

export async function getAccountAreaSingleResultList(alias: string, module: string) {
  const response = await API.get<ResultInfo[]>(`/account/${encodeURIComponent(alias)}/single_result/${encodeURIComponent(module)}`);
  return response.data
}

export async function getAccountAreaSingleResult(alias: string, module: string, text: boolean) {
  const response = await API.get<Blob | ModuleResult>(`/account/${encodeURIComponent(alias)}/single_result/${encodeURIComponent(module)}?text=${encodeURIComponent(text)}`,
    {
		responseType: "blob",
		timeout: 1 * 60 * 1000
  });
  if (text) {
    return response.data as ModuleResult;
  } else{
    const imageUrl = window.URL.createObjectURL(response.data as Blob);
    return imageUrl
  }
}

export async function getAllUsers() {
  const response = await API.get<UserInfo[]>('/user');
  return response.data;
}

export async function postUser(account: string, userInfo: UserInfo) {
  const response = await API.post<DefaultResponse>(`/user/${encodeURIComponent(account)}`, userInfo);
  return response.data;
}

export async function putUser(account: string, userInfo: UserInfo) {
  const response = await API.put<DefaultResponse>(`/user/${encodeURIComponent(account)}`, userInfo);
  return response.data;
}

export async function deleteUser(account: string) {
  const response = await API.delete<DefaultResponse>(`/user/${encodeURIComponent(account)}`);
  return response.data;
}

export async function getAccountValidate() {
  const response = await API.get<ValidateResponse>(`/query_validate`);
  return response.data;
}

export async function postAccountValidate(id: string, challenge: string, validate: string, userid: string) {
  const response = await API.post<DefaultResponse>(`/validate`, {
    id: id,
    challenge: challenge,
    validate: validate,
    userid: userid
  });
  return response.data;
}

export async function getRunningStatus() {
  const response = await API.get<RunningStatusResponse>(`/running_status`);
  return response.data;
}
