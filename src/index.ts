import { isEnabledForUser } from "./hashRollout.js";

// Re-exported so a server can reuse the exact same rollout logic as the SDK.
export { isEnabledForUser };

// One flag exactly as GET /api/v1/flags returns it. */
export type FlagData = { enabled: boolean; rollout: number };

// Valid ONLY if both fields have the exact type and range. Anything else is "broken".
// Broken flags are treated as disabled (fail closed).
function isValidFlag(value: unknown): value is FlagData {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.enabled === "boolean" &&
    typeof f.rollout === "number" &&
    Number.isInteger(f.rollout) &&
    f.rollout >= 0 &&
    f.rollout <= 100
  );
}

export type GetFlagsOptions = {
  // Project API key, e.g. "ffk_prod_...". Sent as "Authorization: Bearer <key>".
  apiKey: string;

  // Any stable id of the end user (user id, email...). Decides the rollout bucket.
  userKey: string;

  // Where the feature-flags service lives, e.g. "https://flags.example.com".
  baseUrl: string;

  // Give up on the request after this many milliseconds. Default 5000.
  timeoutMs?: number;
};

export type FlagsClient = {
  // true if the flag exists, is enabled and the user is inside its rollout.
  isEnabled(flagKey: string): boolean;
};

// In-memory cache: ONE network request per baseUrl + apiKey.
// We store the Promise, so parallel getFlags() calls share the same request.
const cache = new Map<string, Promise<Record<string, FlagData>>>();

// Forget cached flags. The next getFlags() call fetches again.
export function clearCache(): void {
  cache.clear();
}

const DEFAULT_TIMEOUT_MS = 5_000;

async function fetchFlags(
  apiKey: string,
  baseUrl: string,
  timeoutMs: number,
): Promise<Record<string, FlagData>> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1/flags`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs), // a hanging server must not hang our app
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`Failed to load flags: timed out after ${timeoutMs} ms`);
    }
    throw err;
  }

  if (!res.ok) throw new Error(`Failed to load flags: HTTP ${res.status}`);

  const body = (await res.json()) as { flags?: Record<string, FlagData> };

  if (!body || typeof body.flags !== "object" || body.flags === null) {
    throw new Error("Failed to load flags: unexpected response format");
  }

  return body.flags;
}

export async function getFlags(options: GetFlagsOptions): Promise<FlagsClient> {
  const { apiKey, userKey, baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  if (!apiKey) throw new TypeError("getFlags: apiKey is required");
  if (!userKey) throw new TypeError("getFlags: userKey is required");
  if (!baseUrl) throw new TypeError("getFlags: baseUrl is required");
  // Upper bound: larger delays overflow the timer and fire almost immediately.
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new TypeError("getFlags: timeoutMs must be a positive integer");
  }

  const base = baseUrl.replace(/\/+$/, ""); // "https://x.com/" -> "https://x.com"

  // timeoutMs is part of the key, so every caller gets the timeout it asked for.
  const cacheKey = `${base}|${apiKey}|${timeoutMs}`;

  let pending = cache.get(cacheKey);

  if (!pending) {
    pending = fetchFlags(apiKey, base, timeoutMs);
    cache.set(cacheKey, pending);
    pending.catch(() => cache.delete(cacheKey)); // never cache a failure
  }

  const data = await pending;

  return {
    isEnabled(flagKey) {
      const flag = data[flagKey];
      if (!isValidFlag(flag) || !flag.enabled) return false; // unknown, invalid or switched off
      return isEnabledForUser(userKey, flagKey, flag.rollout);
    },
  };
}
