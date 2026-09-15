import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type APIRequestContext, request as apiRequest } from '@playwright/test';
import { getApiResponse, getJwtToken, type HttpMethod } from './index';

let server: Server;
let request: APIRequestContext;
let baseURL: string;

beforeAll(async () => {
	server = createServer(async (req, res) => {
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(Buffer.from(chunk));
		const body = Buffer.concat(chunks).toString();
		res.setHeader('content-type', 'application/json');
		if (req.url === '/auth') {
			const credentials = JSON.parse(body);
			if (
				req.method === 'POST' &&
				req.headers['x-api-key'] === 'test-key' &&
				credentials.username === 'test-user' &&
				credentials.password === 'test-password'
			) {
				res.end(JSON.stringify({ token: 'test-token' }));
			} else {
				res.statusCode = 401;
				res.end(JSON.stringify({ error: 'invalid credentials' }));
			}
		} else if (req.url === '/missing-token') {
			res.end('{}');
		} else {
			res.end(JSON.stringify({ method: req.method, path: req.url, headers: req.headers, body }));
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	request = await apiRequest.newContext({ baseURL });
});

afterAll(async () => {
	await request?.dispose();
	await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

it.each<HttpMethod>(['GET', 'PUT', 'POST', 'DELETE', 'PATCH'])(
	'sends %s with path, params, headers and body',
	async (method) => {
		const response = await getApiResponse(request, '/items/123', {
			method,
			token: 'test-token',
			params: { active: true },
			headers: { 'x-test': 'custom' },
			data: { name: 'updated' },
		});
		expect(await response.json()).toMatchObject({
			method,
			path: '/items/123?active=true',
			headers: { authorization: 'Bearer test-token', 'x-test': 'custom' },
			body: JSON.stringify({ name: 'updated' }),
		});
	}
);

it('defaults to GET and does not add authorization without a token', async () => {
	const body = await (await getApiResponse(request, `${baseURL}/public`)).json();
	expect(body.method).toBe('GET');
	expect(body.path).toBe('/public');
	expect(body.headers.authorization).toBeUndefined();
});

it.each(['authorization', 'Authorization'])('lets an explicit %s header override the token', async (header) => {
	const response = await getApiResponse(request, '/items', {
		token: 'test-token',
		headers: { [header]: 'Bearer deliberately-invalid' },
	});
	expect((await response.json()).headers.authorization).toBe('Bearer deliberately-invalid');
});

const credentials = { apiKey: 'test-key', username: 'test-user', password: 'test-password' };

it('authenticates using the supplied URL and credentials', async () => {
	await expect(getJwtToken(request, { ...credentials, fetchUrl: `${baseURL}/auth` })).resolves.toBe('test-token');
});

it('rejects unsuccessful authentication', async () => {
	await expect(getJwtToken(request, { ...credentials, fetchUrl: `${baseURL}/auth`, apiKey: 'wrong' })).rejects.toThrow(
		'JWT request failed [401]'
	);
});

it('rejects a response without a token', async () => {
	await expect(getJwtToken(request, { ...credentials, fetchUrl: `${baseURL}/missing-token` })).rejects.toThrow(
		'JWT response must contain a non-empty token'
	);
});
