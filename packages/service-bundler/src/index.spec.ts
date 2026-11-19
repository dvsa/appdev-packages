import { readdir, readFile } from 'node:fs/promises';
import { rspack } from '@rspack/core';
import { ServicePackager } from './index';

jest.mock('node:fs', () => ({
	existsSync: jest.fn(() => true),
	readdirSync: jest.fn(() => [{ name: 'example', isDirectory: () => true }]),
}));
jest.mock('node:fs/promises', () => ({
	readdir: jest.fn(async () => [{ name: 'index.mjs', isDirectory: () => false }]),
	readFile: jest.fn(async () => 'export const handler = () => {};'),
}));
jest.mock('@rspack/core', () => ({
	DefinePlugin: jest.fn(),
	rspack: jest.fn((_options, callback) =>
		callback(null, { hasErrors: () => false, toString: () => '', toJson: () => ({ modules: [] }) })
	),
}));
jest.mock('fs-extra', () => ({ copy: jest.fn() }));
jest.mock('zip-lib', () => ({ archiveFolder: jest.fn() }));

beforeEach(() => {
	jest.clearAllMocks();
	jest.mocked(readdir).mockResolvedValue([{ name: 'index.mjs', isDirectory: () => false }] as never);
	jest.spyOn(console, 'log').mockImplementation(() => {});
	jest.mocked(readFile).mockResolvedValue('export const handler = () => {};');
});
afterEach(() => jest.restoreAllMocks());

test('stubs both OpenAPI stacks and excludes both HTTP stacks from standalone bundles', async () => {
	await new ServicePackager({ nodeMajorVersion: '24', handlerFileName: 'index.ts' }).build();
	const [proxy, standalone] = jest.mocked(rspack).mock.calls.map(([options]) => options);
	expect(proxy.resolve.alias).toMatchObject({
		'@inversifyjs/http-open-api': '@dvsa/service-bundler/empty-module.js',
		'@dvsa/openapi-schema-generator': '@dvsa/service-bundler/empty-module.js',
		'routing-controllers-openapi': '@dvsa/service-bundler/empty-module.js',
	});
	expect(standalone.externals).toEqual(
		expect.arrayContaining(['hono', '@hono/aws-lambda', 'express', 'routing-controllers'])
	);
	expect(standalone.externals.some((entry) => entry instanceof RegExp && entry.test('hono/cors'))).toBe(true);
	expect(standalone.externals.some((entry) => entry instanceof RegExp && entry.test('@inversifyjs/http-core'))).toBe(
		true
	);
});

for (const dependency of ['hono', '@inversifyjs/http-hono', 'routing-controllers']) {
	test(`rejects a standalone artifact referencing ${dependency}`, async () => {
		jest.mocked(readFile).mockResolvedValue(`import '${dependency}';`);
		await expect(new ServicePackager({ nodeMajorVersion: '24' }).build()).rejects.toThrow('references');
	});
}

test('checks dependencies inside nested chunks', async () => {
	jest
		.mocked(readdir)
		.mockImplementation(
			async (dir) =>
				[
					String(dir).endsWith('chunks')
						? { name: 'chunk.mjs', isDirectory: () => false }
						: { name: 'chunks', isDirectory: () => true },
				] as never
		);
	jest.mocked(readFile).mockResolvedValue('import "hono/cors";');
	await expect(new ServicePackager({ nodeMajorVersion: '24' }).build()).rejects.toThrow('chunk.mjs');
});

test('warns about legacy modules with upgrade guidance, once per dependency', async () => {
	const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
	jest.mocked(rspack).mockImplementation((_options, callback) => {
		callback(null, {
			hasErrors: () => false,
			toString: () => '',
			toJson: () => ({
				modules: [
					{ name: './node_modules/express/index.js' },
					{ modules: [{ name: './node_modules/typedi/index.js' }] },
					{ name: 'empty-module.mjs', reasons: [{ userRequest: 'routing-controllers-openapi' }] },
				],
			}),
		} as never);
		return null as never;
	});
	await new ServicePackager({ nodeMajorVersion: '24' }).build();
	expect(warn).toHaveBeenCalledTimes(3);
	expect(warn).toHaveBeenCalledWith(expect.stringContaining('Legacy dependency "express"'));
	expect(warn).toHaveBeenCalledWith(expect.stringContaining('upgrade to Inversify HTTP, Hono and Zod'));
});
