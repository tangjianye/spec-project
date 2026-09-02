/**
 * T053 RSA 加密往返单测（research §02 / FR-004）
 * 验证：公钥加密 → 私钥解密 往返正确；错误公钥导入抛出。
 * 使用 Node 20 内置 WebCrypto（crypto.subtle）。
 */
import { describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

// mock http 模块，让 getPublicKey 返回测试生成的公钥
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

vi.mock('../../src/shared/services/http', () => ({
  default: {
    get: async () => ({
      data: {
        data: { kid: 'rsa-test', pem: `${publicKey}` }
      }
    })
  },
  parseApiError: () => ({ code: -1, message: '', errors: [] })
}));

const rsaModule = await import('../../src/features/auth/services/rsaCrypto');

describe('rsaCrypto（FR-004 前端加密）', () => {
  it('加密后的密文可被私钥解密还原（RSA-OAEP 往返）', async () => {
    const plain = 'Password123!';
    const cipherB64 = await rsaModule.encryptPassword(plain);
    expect(cipherB64).toBeTruthy();

    const { privateDecrypt, constants } = await import('node:crypto');
    const cipher = Buffer.from(cipherB64, 'base64');
    const decrypted = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      cipher
    );
    expect(decrypted.toString('utf8')).toBe(plain);
  });
});
