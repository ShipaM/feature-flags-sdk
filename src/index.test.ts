import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache, getFlags } from "./index.js";
import { getBucket } from "./hashRollout.js";

const API_KEY = "ffk_prod_test";
const BASE_URL = "http://flags.test";

function mockFetch() {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) =>
    Response.json({
      flags: {
        "new-checkout": { enabled: true, rollout: 50 },
        "dark-mode": { enabled: true, rollout: 100 },
        "off-flag": { enabled: false, rollout: 100 },
      },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  clearCache();
  vi.unstubAllGlobals();
});

describe("getFlags", () => {
  it("sends a Bearer Authorization header to /api/v1/flags", async () => {
    const fetchMock = mockFetch();
    await getFlags({ apiKey: API_KEY, userKey: "user-1", baseUrl: BASE_URL });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://flags.test/api/v1/flags");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${API_KEY}`,
    );
  });

  it("matches the server logic (golden bucket 43 for user-1/new-checkout)", async () => {
    mockFetch();
    expect(getBucket("user-1", "new-checkout")).toBe(43);
    const flags = await getFlags({
      apiKey: API_KEY,
      userKey: "user-1",
      baseUrl: BASE_URL,
    });
    expect(flags.isEnabled("new-checkout")).toBe(true); // 43 < 50
  });

  it("isEnabled is stable and makes no extra requests", async () => {
    const fetchMock = mockFetch();
    const flags = await getFlags({
      apiKey: API_KEY,
      userKey: "user-1",
      baseUrl: BASE_URL,
    });
    const first = flags.isEnabled("new-checkout");
    for (let i = 0; i < 10; i++) {
      expect(flags.isEnabled("new-checkout")).toBe(first);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches flags between getFlags calls", async () => {
    const fetchMock = mockFetch();
    const opts = { apiKey: API_KEY, userKey: "user-1", baseUrl: BASE_URL };
    await getFlags(opts);
    const flags = await getFlags({ ...opts, userKey: "user-2" });
    expect(flags.isEnabled("dark-mode")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("parallel getFlags calls share one request", async () => {
    const fetchMock = mockFetch();
    const opts = { apiKey: API_KEY, userKey: "user-1", baseUrl: BASE_URL };
    await Promise.all([getFlags(opts), getFlags(opts), getFlags(opts)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns false for disabled and unknown flags", async () => {
    mockFetch();
    const flags = await getFlags({
      apiKey: API_KEY,
      userKey: "user-1",
      baseUrl: BASE_URL,
    });
    expect(flags.isEnabled("off-flag")).toBe(false);
    expect(flags.isEnabled("does-not-exist")).toBe(false);
  });

  it("does not cache a failed request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({ flags: { "dark-mode": { enabled: true, rollout: 100 } } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const opts = { apiKey: API_KEY, userKey: "user-1", baseUrl: BASE_URL };
    await expect(getFlags(opts)).rejects.toThrow("HTTP 500");
    const flags = await getFlags(opts);
    expect(flags.isEnabled("dark-mode")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on a malformed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ nope: true })),
    );
    await expect(
      getFlags({ apiKey: API_KEY, userKey: "user-1", baseUrl: BASE_URL }),
    ).rejects.toThrow("unexpected response format");
  });

  it("strips a trailing slash from baseUrl", async () => {
    const fetchMock = mockFetch();
    await getFlags({
      apiKey: API_KEY,
      userKey: "user-1",
      baseUrl: `${BASE_URL}/`,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("http://flags.test/api/v1/flags");
  });
});
