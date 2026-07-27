export const DEFAULT_USER_EMAIL = 'gvenkatesh.on@gmail.com';
export const DEFAULT_SALT = 'retain_salt_gvenkatesh';
export const DEFAULT_HASH = '2a52bd126fed1aacf12d39236c4d669ab114b2f3690fdd217897d61ca133b448';

/**
 * Computes PBKDF2-SHA-256 hash hex of a password string using Web Crypto API.
 */
export async function hashPassword(password: string, salt: string = DEFAULT_SALT): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies a password against the expected salt and hash.
 */
export async function verifyPassword(
  passwordAttempt: string,
  salt: string = DEFAULT_SALT,
  expectedHash: string = DEFAULT_HASH
): Promise<boolean> {
  const computedHash = await hashPassword(passwordAttempt, salt);
  return computedHash === expectedHash;
}
