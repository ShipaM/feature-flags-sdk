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
});
