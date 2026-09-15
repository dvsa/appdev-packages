import {
	test as base,
	type PlaywrightTestArgs,
	type PlaywrightTestOptions,
	type PlaywrightWorkerArgs,
	type PlaywrightWorkerOptions,
	type TestType,
} from '@playwright/test';
import { getJwtToken, getTokenExpiryMs, type JwtConfig } from '../utils';

export type WorkerFixtures = {
	/**
	 * Returns a valid JWT, fetching a fresh one only when needed. The token is
	 * cached for the worker's lifetime and reused across tests, so we normally
	 * authenticate once per worker rather than once per test.
	 */
	getAuthToken: () => Promise<string>;
};

// Refetch this far before the token's `exp` to absorb clock skew and in-flight
// request time. Token TTL is ~25 min, so a long-running worker (or CI running
// many tests per worker) could otherwise outlive a token fetched at startup.
const EXPIRY_SKEW_MS = 30_000;

export type ApiTestConfig = { jwt: JwtConfig };

export function createApiTest(
	config: ApiTestConfig
): TestType<
	PlaywrightTestArgs & PlaywrightTestOptions,
	PlaywrightWorkerArgs & PlaywrightWorkerOptions & WorkerFixtures
> {
	return base.extend<Record<symbol, never>, WorkerFixtures>({
		getAuthToken: [
			async ({ playwright }, use) => {
				const request = await playwright.request.newContext();

				let token: string | undefined;
				let expiresAt = 0;

				const getAuthToken = async (): Promise<string> => {
					if (!token || Date.now() >= expiresAt - EXPIRY_SKEW_MS) {
						token = await getJwtToken(request, config.jwt);
						// No `exp` claim => treat as non-expiring for this worker.
						expiresAt = getTokenExpiryMs(token) ?? Number.POSITIVE_INFINITY;
					}

					return token;
				};

				try {
					await use(getAuthToken);
				} finally {
					await request.dispose();
				}
			},
			{ scope: 'worker' },
		],
	});
}

export { expect } from '@playwright/test';
