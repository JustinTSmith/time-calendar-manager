<<<<<<< HEAD
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_BUFFER = Buffer.from(env.ENCRYPTION_KEY, 'hex');

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export function encrypt(text: string): EncryptedData {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decrypt(data: EncryptedData): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    KEY_BUFFER,
    Buffer.from(data.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
  
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Helper to serialize/deserialize encrypted data for storage
export function serializeEncrypted(data: EncryptedData): string {
  return JSON.stringify(data);
}

export function deserializeEncrypted(serialized: string): EncryptedData {
  return JSON.parse(serialized) as EncryptedData;
=======
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const PBKDF2_ITERATIONS = 100_000
const KEY_BYTES = 32

function keyBuffer(key: string): Buffer {
  return crypto.createHash('sha256').update(key).digest()
}

export function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer(key), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(encoded: string, key: string): string {
  const parts = encoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string]
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer(key), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]).toString('utf8')
}

export function deriveKey(secret: string, salt: string): string {
  return crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, KEY_BYTES, 'sha256').toString('hex')
>>>>>>> origin/blocks/jus-29-test-scaffolding-vitest-unit-tests-and-playwright-e2e-smoke
}
