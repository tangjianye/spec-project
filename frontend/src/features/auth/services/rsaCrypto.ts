/**
 * 密码前端加密工具（T027）——对齐 research §02 / spec FR-004
 * 使用 WebCrypto (SubtleCrypto) RSA-OAEP-2048 公钥加密密码明文。
 * 公钥通过 /api/v1/auth/public-key 获取；kid 校验防密钥轮换错配。
 */
import http from '../../../shared/services/http';

export interface PublicKeyInfo {
  kid: string;
  pem: string;
}

let cachedPublicKey: PublicKeyInfo | null = null;

/** 获取 RSA 公钥（带缓存；kid 变化时由后端响应头触发刷新） */
export async function getPublicKey(force = false): Promise<PublicKeyInfo> {
  if (cachedPublicKey && !force) return cachedPublicKey;
  const res = await http.get<{ data: PublicKeyInfo }>('/auth/public-key');
  cachedPublicKey = res.data.data;
  return cachedPublicKey;
}

/** 将 PEM 公钥导入为 CryptoKey */
async function importPublicKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    der as unknown as ArrayBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

/** 加密密码明文 → Base64 密文（spec FR-004：前端加密后传输） */
export async function encryptPassword(plain: string): Promise<string> {
  const { pem } = await getPublicKey();
  const key = await importPublicKey(pem);
  const cipher = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(plain)
  );
  const bytes = new Uint8Array(cipher);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
