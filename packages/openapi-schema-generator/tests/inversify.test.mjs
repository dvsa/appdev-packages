import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { Container } from 'inversify';
import { InversifyToOpenApiSpec } from '../dist/inversify.mjs';

const directories = [];
afterEach(async () => {
	await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fixture(files) {
	// Keep imports resolvable through the workspace node_modules.
	const cwd = await mkdtemp(join(import.meta.dirname, '.fixture-'));
	directories.push(cwd);
	for (const [name, content] of Object.entries(files)) {
		await mkdir(join(cwd, name, '..'), { recursive: true });
		await writeFile(join(cwd, name), content);
	}
	return cwd;
}

function options(cwd, overrides = {}) {
	return {
		cwd,
		container: new Container(),
		openApiObject: { openapi: '3.1.0', info: { title: 'Test', version: '1' } },
		modelsGlob: 'models/*.mjs',
		controllersGlob: 'controllers/*.mjs',
		functionsGlob: 'functions/*.mjs',
		...overrides,
	};
}

test('combines Zod Mini, decorated controllers and standalone methods, retaining seed metadata', async () => {
	const cwd = await fixture({
		'models/user.mjs': `import * as z from 'zod/mini'; export const userSchema = z.object({ name: z.string() }); export const helper = {};`,
		'controllers/users.mjs': `import { Controller, Get } from '@inversifyjs/http-core';
      import { OasResponse } from '@inversifyjs/http-open-api';
      export class Users { get() {} }
      Controller('/backport-users')(Users);
      Get('')(Users.prototype, 'get', Object.getOwnPropertyDescriptor(Users.prototype, 'get'));
      OasResponse(200, { description: 'OK' })(Users.prototype, 'get', Object.getOwnPropertyDescriptor(Users.prototype, 'get'));`,
		'functions/delete.mjs': `export const openApi = { path: '/backport-users', pathItem: { delete: { responses: { 204: { description: 'Deleted' } } } } };`,
		'functions/event-only.mjs': `export const handler = () => {};`,
	});
	const opts = options(cwd);
	opts.openApiObject.servers = [{ url: 'https://example.com' }];
	opts.openApiObject.components = {
		schemas: { Existing: { type: 'string' } },
		securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
	};
	const spec = await InversifyToOpenApiSpec.generate(opts);
	assert.equal(spec.components.schemas.User.properties.name.type, 'string');
	assert.equal(spec.components.schemas.Existing.type, 'string');
	assert.equal(spec.components.securitySchemes.bearer.scheme, 'bearer');
	assert.deepEqual(spec.servers, opts.openApiObject.servers);
	assert.equal(spec.paths['/backport-users'].get.responses['200'].description, 'OK');
	assert.equal(spec.paths['/backport-users'].delete.responses['204'].description, 'Deleted');
	assert.equal(opts.openApiObject.components.schemas.User, undefined);
});

test('accepts full Zod and rejects collisions after schema name normalisation', async () => {
	const cwd = await fixture({
		'models/a.mjs': `import { z } from 'zod'; export const userSchema = z.string(); export const User = z.number();`,
	});
	await assert.rejects(InversifyToOpenApiSpec.generate(options(cwd)), /Duplicate or empty schema name "User"/);
});

test('rejects collisions with a supplied schema', async () => {
	const cwd = await fixture({ 'models/a.mjs': `import { z } from 'zod'; export const userSchema = z.string();` });
	const opts = options(cwd);
	opts.openApiObject.components = { schemas: { User: { type: 'number' } } };
	await assert.rejects(InversifyToOpenApiSpec.generate(opts), /schema name "User"/);
});

for (const metadata of ['null', '{}', '{ path: "users", pathItem: {} }', '{ path: "/users", pathItem: [] }']) {
	test(`rejects malformed standalone metadata: ${metadata}`, async () => {
		const cwd = await fixture({ 'functions/bad.mjs': `export const openApi = ${metadata};` });
		await assert.rejects(InversifyToOpenApiSpec.generate(options(cwd)), /Invalid openApi export in functions/);
	});
}

test('propagates import failures', async () => {
	const cwd = await fixture({ 'functions/broken.mjs': `throw new Error('broken import');` });
	await assert.rejects(InversifyToOpenApiSpec.generate(options(cwd)), /broken import/);
});

test('supports absent directories, explicit opt-outs and CommonJS exports', async () => {
	const cwd = await fixture({});
	const opts = options(cwd, { controllersGlob: false });
	const spec = await InversifyToOpenApiSpec.generate(opts);
	assert.deepEqual(spec.paths, {});
	const { createRequire } = await import('node:module');
	const require = createRequire(import.meta.url);
	assert.equal(typeof require('../dist/inversify.cjs').InversifyToOpenApiSpec.generate, 'function');
});

const tsconfig = JSON.stringify({ compilerOptions: { strict: true, module: 'esnext', moduleResolution: 'bundler' } });

test('merges TypeScript type schemas with Zod schemas and rewrites references', async () => {
	const cwd = await fixture({
		'tsconfig.json': tsconfig,
		'types/vehicle.ts': `export interface Vehicle { vin: string; owner: Owner; tags?: string[] }
      export interface Owner { name: string }
      export type Status = 'active' | 'archived';`,
		'models/user.mjs': `import * as z from 'zod/mini'; export const userSchema = z.object({ name: z.string() });`,
	});
	const spec = await InversifyToOpenApiSpec.generate(options(cwd, { typeSchemas: [{ path: 'types/*.ts' }] }));
	const { User, Vehicle, Owner, Status } = spec.components.schemas;
	assert.equal(User.properties.name.type, 'string');
	assert.deepEqual(Vehicle.required, ['vin', 'owner']);
	assert.equal(Vehicle.properties.owner.$ref, '#/components/schemas/Owner');
	assert.equal(Owner.properties.name.type, 'string');
	assert.deepEqual(Status.enum, ['active', 'archived']);
});

test('generates only the named type and its references', async () => {
	const cwd = await fixture({
		'tsconfig.json': tsconfig,
		'types/vehicle.ts': `export interface Vehicle { owner: Owner } export interface Owner { name: string } export interface Unused { x: number }`,
	});
	const spec = await InversifyToOpenApiSpec.generate(
		options(cwd, { typeSchemas: [{ path: 'types/vehicle.ts', interfaceName: 'Vehicle' }] })
	);
	assert.deepEqual(Object.keys(spec.components.schemas).sort(), ['Owner', 'Vehicle']);
});

test('rejects collisions between TypeScript and Zod schemas', async () => {
	const cwd = await fixture({
		'tsconfig.json': tsconfig,
		'types/user.ts': `export interface User { id: string }`,
		'models/user.mjs': `import * as z from 'zod/mini'; export const userSchema = z.object({ name: z.string() });`,
	});
	await assert.rejects(
		InversifyToOpenApiSpec.generate(options(cwd, { typeSchemas: [{ path: 'types/user.ts' }] })),
		/Duplicate or empty schema name "User"/
	);
});

test('reports type errors only when typeCheck is enabled', async () => {
	const cwd = await fixture({
		'tsconfig.json': tsconfig,
		'types/bad.ts': `export interface Bad { n: number } export const x: number = 'nope';`,
	});
	const typeSchemas = [{ path: 'types/bad.ts', interfaceName: 'Bad' }];
	const spec = await InversifyToOpenApiSpec.generate(options(cwd, { typeSchemas }));
	assert.equal(spec.components.schemas.Bad.properties.n.type, 'number');
	await assert.rejects(
		InversifyToOpenApiSpec.generate(options(cwd, { typeSchemas, typeCheck: true })),
		/Type check error/
	);
});

test('renames generic instantiations to valid component names and rewrites their refs', async () => {
	const cwd = await fixture({
		'tsconfig.json': tsconfig,
		'types/page.ts': `export interface Page<T> { items: T[] } export interface Item { id: string }
      export interface Listing { page: Page<Item> }`,
	});
	const spec = await InversifyToOpenApiSpec.generate(
		options(cwd, { typeSchemas: [{ path: 'types/page.ts', interfaceName: 'Listing' }] })
	);
	const { schemas } = spec.components;
	assert.ok(
		Object.keys(schemas).every((name) => /^[A-Za-z0-9._-]+$/.test(name)),
		Object.keys(schemas).join()
	);
	assert.equal(schemas.Listing.properties.page.$ref, '#/components/schemas/Page_Item');
	assert.equal(schemas.Page_Item.properties.items.items.$ref, '#/components/schemas/Item');
});
