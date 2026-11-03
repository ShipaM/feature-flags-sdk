# @maksymshypytsia/flags-sdk

[![npm version](https://img.shields.io/npm/v/@maksymshypytsia/flags-sdk.svg)](https://www.npmjs.com/package/@maksymshypytsia/flags-sdk)
[![license](https://img.shields.io/npm/l/@maksymshypytsia/flags-sdk.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@maksymshypytsia/flags-sdk.svg)](https://nodejs.org)
![types](https://img.shields.io/npm/types/@maksymshypytsia/flags-sdk.svg)

Tiny JavaScript/TypeScript client for [feature-flags-saas](https://github.com/ShipaM/feature-flags-saas).

- **One request.** Flags are fetched once and cached in memory.
- **Local evaluation.** `isEnabled()` is synchronous: no network, no waiting.
- **Same answer as the server.** Uses the exact same rollout hash, so a user always lands in the same bucket.
- **Zero runtime dependencies**, ESM, written in TypeScript (types included).
- No polling, no WebSocket.

## Installation

```bash
npm install @maksymshypytsia/flags-sdk
```

<details>
<summary>pnpm / yarn / bun</summary>

```bash
pnpm add @maksymshypytsia/flags-sdk
yarn add @maksymshypytsia/flags-sdk
bun add @maksymshypytsia/flags-sdk
```

</details>

**Requirements:** Node.js 18+ (or any modern browser) because the SDK uses the built-in `fetch`.
The package is **ESM only**: use `import`, not `require`.

## Quick start

```ts
import { getFlags } from "@maksymshypytsia/flags-sdk";

const flags = await getFlags({
  apiKey: process.env.FLAGS_API_KEY!, // dashboard -> Project -> API keys
  userKey: "user-42", // any stable id: user id, email, ...
  baseUrl: "https://flags.example.com", // where the service runs
});

if (flags.isEnabled("new-checkout")) {
  // show the new checkout
}
```

## How to get the values

| Option    | Where to get it                                                      |
| --------- | -------------------------------------------------------------------- |
| `apiKey`  | Dashboard -> your project -> **API keys**. Looks like `ffk_prod_...` |
| `userKey` | Your own stable user identifier (id, email). Never random per visit  |
| `baseUrl` | The address of your feature-flags-saas deployment, no `/api` suffix  |

Each API key belongs to one environment (`dev`, `staging`, `prod`), so use a separate key per environment.

## Usage

### Server (Node.js, Next.js route, Express...)

```ts
import { getFlags } from "@maksymshypytsia/flags-sdk";

export async function handler(userId: string) {
  const flags = await getFlags({
    apiKey: process.env.FLAGS_API_KEY!,
    userKey: userId,
    baseUrl: process.env.FLAGS_URL!,
  });
  return flags.isEnabled("new-checkout") ? "new" : "old";
}
```

Calling `getFlags` for many users is cheap: the network request happens only
once per `baseUrl` + `apiKey`, every other call reuses the cached data
(parallel calls share the same request).

### Refresh the flags

Flags are **not** refreshed automatically. When you want fresh data:

```ts
import { clearCache, getFlags } from "@maksymshypytsia/flags-sdk";

clearCache(); // forget what we have
const flags = await getFlags({ apiKey, userKey, baseUrl }); // fetches again
```

### Error handling

```ts
try {
  const flags = await getFlags({ apiKey, userKey, baseUrl });
} catch (error) {
  // wrong key (HTTP 401), server down, unexpected response...
  // a failed request is never cached, the next call tries again
}
```

A sensible pattern is to treat "could not load flags" as "all flags off".

## API

### `getFlags(options): Promise<FlagsClient>`

| Option    | Type     | Description                                            |
| --------- | -------- | ------------------------------------------------------ |
| `apiKey`  | `string` | Project API key. Sent as `Authorization: Bearer <key>` |
| `userKey` | `string` | Stable id of the end user                              |
| `baseUrl` | `string` | Service URL. A trailing `/` is ignored                 |

Throws `TypeError` if an option is empty, and `Error` if the request fails
or the response has an unexpected shape.

### `client.isEnabled(flagKey): boolean`

`true` only if the flag exists, is enabled **and** the user falls inside the
flag's rollout percentage. Unknown or disabled flags return `false`.
Synchronous, makes no network requests, always gives the same answer for the same user and flag.

### `clearCache(): void`

Forgets cached flags; the next `getFlags()` fetches again.

### `isEnabledForUser(userKey, flagKey, rollout): boolean`

The raw rollout function the server uses. Handy for tests or for evaluating on your own server.

## How it works

1. `getFlags` sends one `GET {baseUrl}/api/v1/flags` with your API key.
2. The response (`{ flags: { key: { enabled, rollout } } }`) is cached in memory.
3. `isEnabled` computes `FNV-1a(userKey + ":" + flagKey) % 100` and compares it with the `rollout` percentage.
   The same input always gives the same bucket, so a user does not flip between old and new.

## FAQ

**Can I use it in the browser?**
Yes, if the service allows your origin (CORS). Keep in mind that an API key in
public frontend code is visible to everyone, so do not use a key you consider secret.

**Why does `require()` fail?**
The package is ESM only. Use `import`, or `await import("@maksymshypytsia/flags-sdk")`.

**Why does a user get a different result than my colleague?**
Rollout depends on `userKey`. Make sure you pass the same stable value everywhere.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # tsc -> dist/
npm pack --dry-run  # see what goes into the package
```

Try an unpublished build in another project:

```bash
npm pack
cd ../some-app && npm install ../feature-flags-sdk/maksymshypytsia-flags-sdk-0.1.0.tgz
```

Release: `npm version patch && git push --follow-tags && npm publish`.

## License

MIT
