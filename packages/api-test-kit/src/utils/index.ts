import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { APIRequestContext, APIResponse } from '@playwright/test';

export type GetRequestOptions = NonNullable<Parameters<APIRequestContext['get']>[1]>;
export type PostRequestOptions = NonNullable<Parameters<APIRequestContext['post']>[1]>;
export type PutRequestOptions = NonNullable<Parameters<APIRequestContext['put']>[1]>;
export type PatchRequestOptions = NonNullable<Parameters<APIRequestContext['patch']>[1]>;
export type DeleteRequestOptions = NonNullable<Parameters<APIRequestContext['delete']>[1]>;

export type HttpMethod = 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH';
export type RequestOptions = Omit<NonNullable<Parameters<APIRequestContext['fetch']>[1]>, 'method'> & {
	method?: HttpMethod;
	token?: string;
};

export type JwtConfig = {
	fetchUrl: string;
	apiKey: string;
	username: string;
	password: string;
};

/** Pass an absolute URL, or a path resolved against the request context's baseURL. */
export async function getApiResponse(
	request: APIRequestContext,
	path: string,
	{ method = 'GET', token, headers, ...options }: RequestOptions = {}
): Promise<APIResponse> {
	// Explicit authorization headers override the token, regardless of casing.
	const hasAuthorization = Object.keys(headers ?? {}).some((name) => name.toLowerCase() === 'authorization');

	return request.fetch(path, {
		...options,
		method,
		headers: {
			...(token && !hasAuthorization ? { authorization: `Bearer ${token}` } : {}),
			...headers,
		},
	});
}

/** The caller owns the fixture directory; no paths are resolved inside the package. */
export function readJsonFixture<T = unknown>(filePath: string): T {
	return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

export function decodeBase64Gzip(payload: string): string {
	const base64Payload = payload.startsWith('"') ? (JSON.parse(payload) as string) : payload;

	return gunzipSync(Buffer.from(base64Payload, 'base64')).toString('utf8');
}

export async function parseJsonOrThrow(response: APIResponse, context: string): Promise<unknown> {
	const text = await response.text();

	if (!text) {
		throw new Error(`${context} returned an empty response body`);
	}

	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new Error(`${context} returned non-JSON body: ${text}`);
	}
}

/**
 * Reads the `exp` claim (seconds since epoch) from a JWT without verifying it.
 * Returns the expiry as epoch milliseconds, or undefined when the token has no
 * decodable `exp` (in which case callers should treat it as non-expiring).
 */
export function getTokenExpiryMs(token: string): number | undefined {
	const payload = token.split('.')[1];

	if (!payload) {
		return undefined;
	}

	try {
		const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };

		return typeof claims.exp === 'number' ? claims.exp * 1000 : undefined;
	} catch {
		return undefined;
	}
}

export async function getJwtToken(request: APIRequestContext, jwt: JwtConfig): Promise<string> {
	const response = await request.post(jwt.fetchUrl, {
		headers: {
			'x-api-key': jwt.apiKey,
		},
		data: {
			username: jwt.username,
			password: jwt.password,
		},
	});

	if (!response.ok()) {
		throw new Error(`JWT request failed [${response.status()}]`);
	}

	const body = await response.json();

	if (!body || typeof body !== 'object' || !('token' in body) || typeof body.token !== 'string' || !body.token) {
		throw new Error('JWT response must contain a non-empty token');
	}

	return body.token;
}
