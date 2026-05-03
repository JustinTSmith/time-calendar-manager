import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, deriveKey } from './encryption'

describe('encrypt / decrypt', () => {
  it('round-trips a plaintext string', () => {
    const key = 'test-secret-key'
    const plaintext = 'hello, world!'
    expect(decrypt(encrypt(plaintext, key), key)).toBe(plaintext)
  })

  it('round-trips an empty string', () => {
    const key = 'any-key'
    expect(decrypt(encrypt('', key), key)).toBe('')
  })

  it('round-trips unicode text', () => {
    const key = 'unicode-key'
    const text = '日本語テスト 🎉'
    expect(decrypt(encrypt(text, key), key)).toBe(text)
  })

  it('different keys produce different ciphertexts', () => {
    const text = 'same plaintext'
    expect(encrypt(text, 'key-one')).not.toBe(encrypt(text, 'key-two'))
  })

  it('same input produces different ciphertexts each call (random IV)', () => {
    const key = 'k'
    const a = encrypt('hello', key)
    const b = encrypt('hello', key)
    expect(a).not.toBe(b)
  })

  it('throws on ciphertext with wrong number of segments', () => {
    expect(() => decrypt('bad-data', 'key')).toThrow('Invalid ciphertext format')
  })

  it('throws when auth tag is corrupted', () => {
    const key = 'my-key'
    const encoded = encrypt('secret', key)
    const [iv, , cipher] = encoded.split(':')
    const corrupted = [iv, 'deadbeefdeadbeefdeadbeefdeadbeef', cipher].join(':')
    expect(() => decrypt(corrupted, key)).toThrow()
  })
})

describe('deriveKey', () => {
  it('returns a 64-character hex string (32 bytes)', () => {
    const derived = deriveKey('password', 'salt')
    expect(derived).toHaveLength(64)
    expect(derived).toMatch(/^[0-9a-f]+$/)
  })

  it('is deterministic with the same inputs', () => {
    expect(deriveKey('pass', 'salt')).toBe(deriveKey('pass', 'salt'))
  })

  it('differs when secret changes', () => {
    expect(deriveKey('pass1', 'salt')).not.toBe(deriveKey('pass2', 'salt'))
  })

  it('differs when salt changes', () => {
    expect(deriveKey('pass', 'salt1')).not.toBe(deriveKey('pass', 'salt2'))
  })

  it('can be used as an encryption key', () => {
    const key = deriveKey('my-password', 'my-salt')
    const plaintext = 'top secret'
    expect(decrypt(encrypt(plaintext, key), key)).toBe(plaintext)
  })
})
