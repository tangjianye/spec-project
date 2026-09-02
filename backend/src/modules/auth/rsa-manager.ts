/**
 * RSA 密钥管理（T013）——对齐 research §02
 * 前端用公钥加密密码（RSA-OAEP-2048），后端私钥解密后再 bcrypt 比对。
 * 生产私钥从 env RSA_PRIVATE_KEY_PEM / file 注入，绝不可进入 git。
 */
import { readFileSync } from 'node:fs';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { config } from '../../config/env.js';

export interface PublicKeyInfo {
  kid: string;
  pem: string;
}

export class RsaManager {
  private privateKeyPem: string | null = null;

  /** 加载私钥：优先 env 内联 PEM，其次 file:// 路径 */
  loadPrivateKey(): string {
    if (this.privateKeyPem) return this.privateKeyPem;
    if (config.rsaPrivateKeyPem) {
      this.privateKeyPem = config.rsaPrivateKeyPem;
    } else if (config.rsaPrivateKeyPath) {
      this.privateKeyPem = readFileSync(config.rsaPrivateKeyPath, 'utf8');
    } else {
      // 本地开发/测试：运行时生成临时 RSA 密钥对（不持久化，重启失效）
      this.privateKeyPem = this.generateEphemeralKey();
    }
    return this.privateKeyPem;
  }

  getPublicKeyInfo(): PublicKeyInfo {
    const pem = this.loadPrivateKey();
    return { kid: config.rsaKid, pem: this.derivePublicPem(pem) };
  }

  /** 从私钥导出公钥 PEM（Node crypto：createPublicKey 从私钥 PEM 派生公钥） */
  private derivePublicPem(privatePem: string): string {
    const publicKeyObject = createPublicKey(privatePem);
    return publicKeyObject.export({ type: 'spki', format: 'pem' }) as string;
  }

  private generateEphemeralKey(): string {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return privateKey;
  }
}

export const rsaManager = new RsaManager();
