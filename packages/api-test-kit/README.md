# API test kit

Shared Playwright API test fixtures and request utilities. Install the kit and a compatible Playwright runner as development dependencies:

```sh
npm install --save-dev @dvsa/api-test-kit @playwright/test
```

## Configure authentication

The consuming service loads and validates its environment, then passes configuration to the factory in its own fixture module:

```ts
import { createApiTest } from '@dvsa/api-test-kit';
import { config } from '../config';

export const test = createApiTest({
  jwt: {
    fetchUrl: `${config.jwt.baseUrl}/vta`,
    apiKey: config.jwt.apiKey,
    username: config.jwt.username,
    password: config.jwt.password,
  },
});

export { expect } from '@dvsa/api-test-kit';
```

The package does not read environment variables or assume a token URL suffix. Authentication posts `{ username, password }` with an `x-api-key` header and expects `{ token: string }`.

`getAuthToken()` fetches lazily and caches the token per worker. It refreshes 30 seconds before the JWT expiry and disposes its request context when the worker finishes. Tokens without a decodable expiry are reused for that worker's lifetime. Decoding the expiry does not verify the JWT signature.

## Send API requests

Import `test` from your configured fixture module:

```ts
import { getApiResponse } from '@dvsa/api-test-kit';
import { test, expect } from './helpers/fixtures';

test('updates an item', async ({ request, getAuthToken }) => {
  const response = await getApiResponse(request, '/items/123', {
    method: 'PATCH',
    token: await getAuthToken(),
    data: { name: 'updated' },
    headers: { 'x-correlation-id': 'example' },
  });

  expect(response.status()).toBe(200);
});
```

`method` supports `GET`, `PUT`, `POST`, `DELETE` and `PATCH`; it defaults to `GET`. Pass an absolute URL, or configure Playwright's `use.baseURL` for relative paths. Playwright uses standard URL resolution: `/items` starts at the origin root; `items` preserves a base path when the base URL ends with `/`.

The remaining options are Playwright's fetch options, including `params`, `data`, `form`, `multipart`, `headers` and `timeout`. The helper returns the unparsed `APIResponse` so tests can inspect status, headers and body.

`token` adds a Bearer authorization header. Explicit authorization headers take precedence regardless of casing. Omitting the token adds no authorization header; any authentication configured on the request context still applies. Use a context without default authentication for unauthenticated tests.

## Response utilities and test data

The package also exports `parseJsonOrThrow`, `decodeBase64Gzip`, `getTokenExpiryMs`, `getJwtToken` and their configuration/request types.

Expected responses stay in the consuming service. `readJsonFixture` takes a caller-resolved file path:

```ts
import { resolve } from 'node:path';
import { readJsonFixture } from '@dvsa/api-test-kit';

const expected = readJsonFixture(resolve(__dirname, 'resources', 'expected.json'));
```

## Development

From the workspace root:

```sh
npm install
npm run build --workspace=@dvsa/api-test-kit
npm test --workspace=@dvsa/api-test-kit -- --runInBand
npm run lint --workspace=@dvsa/api-test-kit
```

The build emits CommonJS (`index.cjs`) and ES module (`index.mjs`) bundles with matching declarations into `dist`. The existing publish lifecycle copies these files to the package root, where `package.json` entry points select the appropriate bundle and types. The package regression tests build and load this published layout using both `require` and `import`. Public APIs are exported from `src/index.ts`. Playwright is a peer dependency so consumers supply the runner; it is also a development dependency for this package's checks.
