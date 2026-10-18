const encoder = new TextEncoder()

export function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export function randomToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function digest(value: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
}

function decode(value: string) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  )
}

async function key(secret: string) {
  const bytes = decode(secret)
  if (bytes.length !== 32) throw new Error('invalid_encryption_key')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

// Bind encrypted values to their record and purpose to prevent ciphertext swapping.
export async function encrypt(value: string, secret: string, purpose: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) },
    await key(secret),
    encoder.encode(value),
  )
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(ciphertext))}`
}

export async function decrypt(value: string, secret: string, purpose: string) {
  const [version, iv, ciphertext, extra] = value.split('.')
  if (version !== 'v1' || !iv || !ciphertext || extra) throw new Error('invalid_ciphertext')
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(iv), additionalData: encoder.encode(purpose) },
    await key(secret),
    decode(ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}
