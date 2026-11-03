# @maksymshypytsia/flags-sdk

Tiny client for the [feature-flags-saas](https://github.com/ShipaM/feature-flags-saas)
service. It makes **one** request, caches the result in memory and then decides
locally and deterministically whether a flag is on for a user.
No polling, no WebSocket.

## Install

```bash
npm install @maksymshypytsia/flags-sdk
```

## Quick start

```ts
import { getFlags } from "@maksymshypytsia/flags-sdk";
const flags = await getFlags({
  apiKey: "ffk_prod_...", // dashboard -> Project -> API keys
  userKey: "user-42", // any stable id: user id, email, ...
  baseUrl: "https://flags.example.com", // where the service runs
});
if (flags.isEnabled("new-checkout")) {
  // show the new checkout
}
```

## Development

```bash
npm install         # install dev dependencies
npm run typecheck   # tsc --noEmit, type errors only
npm test            # vitest run
```

### Build and pack

```bash
npm run build       # tsc -> dist/ (old dist/ is deleted first)
ls dist             # hashRollout.d.ts hashRollout.js index.d.ts index.js
npm pack --dry-run  # list what goes into the package, creates nothing
npm pack            # create maksymshypytsia-flags-sdk-0.1.0.tgz
```

Only `dist/`, `README.md` and `package.json` end up in the package
(see `"files"` in `package.json`). Test files are excluded from the build
by `tsconfig.build.json`.

### Try the package locally

Install the `.tgz` into any other project to check it before publishing:

```bash
cd ../some-app
npm install ../feature-flags-sdk/maksymshypytsia-flags-sdk-0.1.0.tgz
```

`*.tgz` and `dist/` are in `.gitignore`, so they are never committed.
