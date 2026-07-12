/**
 * Tabflow Crypto Utilities
 * Shared hashing functions used across popup, dashboard, and service worker.
 */

/**
 * Simple SHA-256 hash (used for backward compatibility with existing password hashes).
 * New passwords should use hashPassword() with PBKDF2 instead.
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random salt for password hashing.
 * Returns a hex-encoded 16-byte random value.
 */
export function generateSalt(): string {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  return Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password using PBKDF2 with 100,000 iterations.
 * This is the recommended way to hash passwords — resistant to brute-force.
 * 
 * @param password - The plaintext password
 * @param salt - A random salt (use generateSalt() to create one)
 * @returns A hex-encoded derived key
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
