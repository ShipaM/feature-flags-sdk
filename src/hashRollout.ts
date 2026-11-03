// Deterministic rollout: the same user and flag always get the same result.
const FNV_OFFSET_BASIS = 0x811c9dc5; // Initial value for FNV-1a (32-bit).

const FNV_PRIME = 0x01000193; // FNV-1a multiplication constant.

const encoder = new TextEncoder();

/** Fast, non-cryptographic hash. Returns a number from 0 to 2^32 - 1. */
export function fnv1a(input: string): number {
  let hash = FNV_OFFSET_BASIS;

  // Hash the UTF-8 bytes so different languages get the same result.
  for (const byte of encoder.encode(input)) {
    hash ^= byte; // Mix the byte into the hash.
    hash = Math.imul(hash, FNV_PRIME); // Multiply using 32-bit arithmetic.
  }

  return hash >>> 0; // Convert the result to an unsigned 32-bit number.
}

/** Get a user's bucket from 0 to 99 for a specific flag. */
export function getBucket(userKey: string, flagKey: string): number {
  // Combine user and flag so each flag gets its own rollout.
  return fnv1a(`${userKey}:${flagKey}`) % 100;
}

/** Check if a flag is enabled for a user at the given rollout percentage. */
export function isEnabledForUser(
  userKey: string,
  flagKey: string,
  rolloutPercentage: number,
): boolean {
  // Handle edge cases explicitly.
  if (Number.isNaN(rolloutPercentage)) return false;
  if (rolloutPercentage <= 0) return false;
  if (rolloutPercentage >= 100) return true;

  // Enable the flag if the user's bucket is inside the rollout range.
  return getBucket(userKey, flagKey) < rolloutPercentage;
}
