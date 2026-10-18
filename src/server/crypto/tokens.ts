import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export interface TokenKeys { digest: Buffer; encryption: Buffer }
export function tokenKeys(env = process.env): TokenKeys {
  function key(name: string) {
    const value = env[name] ?? '';
    if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Token keys must be independent 32-byte hex values.');
    return Buffer.from(value, 'hex');
  }
  const digest = key('CODE_DIGEST_KEY');
  const encryption = key('CODE_ENCRYPTION_KEY');
  if (digest.equals(encryption)) throw new Error('Token keys must be independent.');
  return { digest, encryption };
}

export const newToken = () => randomBytes(16).toString('hex').toUpperCase();
export function normalizeToken(token: string) { return token.trim().replaceAll('-', '').toUpperCase(); }
export function tokenDigest(keys: TokenKeys, purpose: 'code' | 'invitation' | 'request', value: string): Buffer {
  return createHmac('sha256', keys.digest).update(JSON.stringify(['gdgbingo:v1', purpose, value])).digest();
}
export function encryptToken(keys: TokenKeys, token: string, context: string): Buffer {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys.encryption, nonce);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), encrypted]);
}
export function decryptToken(keys: TokenKeys, stored: Buffer, context: string): string {
  if (stored.length < 30 || stored[0] !== 1) throw new Error('Invalid encrypted token.');
  const decipher = createDecipheriv('aes-256-gcm', keys.encryption, stored.subarray(1, 13));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(stored.subarray(13, 29));
  return Buffer.concat([decipher.update(stored.subarray(29)), decipher.final()]).toString('utf8');
}
