const encoder = new TextEncoder()
const decoder = new TextDecoder()
const PBKDF2_ITERATIONS = 250_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const passwordBytes = encoder.encode(password)
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export interface EncryptedPayload {
  encryptedPayload: string
  iv: string
  salt: string
}

export async function encryptJson(password: string, payload: unknown): Promise<EncryptedPayload> {
  if (!password) throw new Error('Ana parola boş olamaz.')
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const key = await deriveKey(password, salt)
  const plainBytes = encoder.encode(JSON.stringify(payload))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer },
    key,
    plainBytes.buffer as ArrayBuffer,
  )

  return {
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
  }
}

export async function decryptJson<T>(
  password: string,
  encryptedPayload: string,
  iv: string,
  salt: string,
): Promise<T> {
  try {
    const saltBytes = base64ToBytes(salt)
    const ivBytes = base64ToBytes(iv)
    const payloadBytes = base64ToBytes(encryptedPayload)
    const key = await deriveKey(password, saltBytes)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes.buffer },
      key,
      payloadBytes.buffer,
    )
    return JSON.parse(decoder.decode(decrypted)) as T
  } catch {
    throw new Error('Ana parola yanlış veya kasa kaydı çözülemiyor.')
  }
}
