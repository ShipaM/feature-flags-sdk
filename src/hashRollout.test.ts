import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { fnv1a, getBucket, isEnabledForUser } from "./hashRollout.js";

describe("fnv1a", () => {
  it("produces the known reference values", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });
});

describe("isEnabledForUser", () => {
  it("the same userKey+flagKey always gives the same result", () => {
    const first = isEnabledForUser("user-42", "new-checkout", 30);
    for (let i = 0; i < 1000; i++) {
      expect(isEnabledForUser("user-42", "new-checkout", 30)).toBe(first);
    }
  });

  it("a user who is enabled stays enabled as the percentage grows", () => {
    for (let i = 0; i < 2000; i++) {
      const userKey = `user-${i}`;
      if (isEnabledForUser(userKey, "flag-a", 10)) {
        expect(isEnabledForUser(userKey, "flag-a", 30)).toBe(true);
      }
    }
  });

  it("at rollout=30 the share of true is about 30% (±3 pp) over 10000 keys", () => {
    const total = 10000;
    let enabled = 0;
    for (let i = 0; i < total; i++) {
      if (isEnabledForUser(randomUUID(), "new-checkout", 30)) enabled++;
    }
    const share = (enabled / total) * 100;
    expect(share).toBeGreaterThan(27);
    expect(share).toBeLessThan(33);
  });

  it("rollout=0 is always false", () => {
    for (let i = 0; i < 1000; i++) {
      expect(isEnabledForUser(`user-${i}`, "f", 0)).toBe(false);
    }
  });

  it("rollout=100 is always true", () => {
    for (let i = 0; i < 1000; i++) {
      expect(isEnabledForUser(`user-${i}`, "f", 100)).toBe(true);
    }
  });

  it("strictly less than: bucket equal to the percentage -> disabled", () => {
    // user-1 + dark-mode falls in bucket 10 (see golden vectors below)
    expect(isEnabledForUser("user-1", "dark-mode", 10)).toBe(false);
    expect(isEnabledForUser("user-1", "dark-mode", 11)).toBe(true);
  });

  it("out-of-range values and NaN are handled safely", () => {
    expect(isEnabledForUser("u", "f", -5)).toBe(false);
    expect(isEnabledForUser("u", "f", 150)).toBe(true);
    expect(isEnabledForUser("u", "f", NaN)).toBe(false);
  });
});

// Golden values: the SDK (day 14) and the API (day 8) must produce the same numbers.
describe("golden vectors (contract for the SDK)", () => {
  const vectors: [string, string, number][] = [
    ["user-1", "new-checkout", 43],
    ["user-2", "new-checkout", 92],
    ["user-1", "dark-mode", 10],
    ["maks@example.com", "beta-ui", 45],
    ["Привет", "new-checkout", 30],
  ];

  it.each(vectors)("%s + %s -> bucket %i", (userKey, flagKey, bucket) => {
    expect(getBucket(userKey, flagKey)).toBe(bucket);
  });
});
