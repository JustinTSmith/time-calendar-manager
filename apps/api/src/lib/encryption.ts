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
}
