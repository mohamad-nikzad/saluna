import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const PASSWORD_HASH_CONFIG = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
}

function derivePasswordKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      PASSWORD_HASH_CONFIG.dkLen,
      {
        N: PASSWORD_HASH_CONFIG.N,
        r: PASSWORD_HASH_CONFIG.r,
        p: PASSWORD_HASH_CONFIG.p,
        maxmem: 128 * PASSWORD_HASH_CONFIG.N * PASSWORD_HASH_CONFIG.r * 2,
      },
      (err, key) => {
        if (err) {
          reject(err)
          return
        }
        resolve(key)
      },
    )
  })
}

export async function hashCredentialPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const key = await derivePasswordKey(password, salt)
  return `${salt}:${key.toString('hex')}`
}

export async function verifyCredentialPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  const [salt, key] = hash.split(':')
  if (!salt || !key) {
    throw new Error('Invalid password hash')
  }

  const expected = Buffer.from(key, 'hex')
  const actual = await derivePasswordKey(password, salt)
  return expected.length === actual.length && timingSafeEqual(actual, expected)
}
