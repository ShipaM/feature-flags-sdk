import { isEnabledForUser } from "./hashRollout.js";

// Re-exported so a server can reuse the exact same rollout logic as the SDK.
export { isEnabledForUser };

/** One flag exactly as GET /api/v1/flags returns it. */
export type FlagData = { enabled: boolean; rollout: number };

export type GetFlagsOptions = {
  /** Project API key, e.g. "ffk_prod_...". Sent as "Authorization: Bearer <key>". */
  apiKey: string;
  /** Any stable id of the end user (user id, email...). Decides the rollout bucket. */
  userKey: string;
  /** Where the feature-flags service lives, e.g. "https://flags.example.com". */
  baseUrl: string;
};

export type FlagsClient = {
  /** true if the flag exists, is enabled and the user is inside its rollout. */
  isEnabled(flagKey: string): boolean;
};

// In-memory cache: ONE network request per baseUrl + apiKey.
// We store the Promise, so parallel getFlags() calls share the same request.
const cache = new Map<string, Promise<Record<string, FlagData>>>();

/** Forget cached flags. The next getFlags() call fetches again. */
export function clearCache(): void {
  cache.clear();
}

async function fetchFlags(
  apiKey: string,
  baseUrl: string,
): Promise<Record<string, FlagData>> {
  const res = await fetch(`${baseUrl}/api/v1/flags`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) throw new Error(`Failed to load flags: HTTP ${res.status}`);

  const body = (await res.json()) as { flags?: Record<string, FlagData> };

  if (!body || typeof body.flags !== "object" || body.flags === null) {
    throw new Error("Failed to load flags: unexpected response format");
  }

  return body.flags;
}

export async function getFlags(options: GetFlagsOptions): Promise<FlagsClient> {
  const { apiKey, userKey, baseUrl } = options;

  if (!apiKey) throw new TypeError("getFlags: apiKey is required");
  if (!userKey) throw new TypeError("getFlags: userKey is required");
  if (!baseUrl) throw new TypeError("getFlags: baseUrl is required");

  const base = baseUrl.replace(/\/+$/, ""); // "https://x.com/" -> "https://x.com"

  const cacheKey = `${base}|${apiKey}`;

  let pending = cache.get(cacheKey);

  if (!pending) {
    pending = fetchFlags(apiKey, base);
    cache.set(cacheKey, pending);
    pending.catch(() => cache.delete(cacheKey)); // never cache a failure
  }

  const data = await pending;

  return {
    isEnabled(flagKey) {
      const flag = data[flagKey];
      if (!flag || !flag.enabled) return false; // unknown or switched off
      return isEnabledForUser(userKey, flagKey, flag.rollout);
    },
  };
}
