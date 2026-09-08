import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { createProgram } from 'ts-json-schema-generator';
import { type SchemaPath, TypescriptToOpenApiSpec } from './index';

jest.mock('ts-json-schema-generator', () => {
	const actual = jest.requireActual<typeof import('ts-json-schema-generator')>('ts-json-schema-generator');

	return {
		...actual,
		createProgram: jest.fn(actual.createProgram),
	};
});

describe('TypescriptToOpenApiSpec', () => {
	const openAPIObject: OpenAPIObject = {
		openapi: '3.0.0',
		info: { title: 'Test API', version: '1.0.0' },
		paths: {},
	};

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('builds one TypeScript generator for multiple named schemas', async () => {
		const modelsPath = join(process.cwd(), '__mocks__/models.ts');
		const moreModelsPath = join(process.cwd(), '__mocks__/more-models.ts');

		const result = await TypescriptToOpenApiSpec.generate(openAPIObject, [
			{ path: modelsPath, interfaceName: 'Model1' },
			{ path: modelsPath, interfaceName: 'Model2' },
			{ path: moreModelsPath, interfaceName: 'Model20' },
		]);

		expect(createProgram).toHaveBeenCalledTimes(1);
		expect(result.components?.schemas).toEqual(
			expect.objectContaining({
				Model1: expect.any(Object),
				Model2: expect.any(Object),
				Model20: expect.any(Object),
				Model21: expect.any(Object),
			})
		);
		expect(result.components?.schemas?.Model1).toEqual(
			expect.objectContaining({
				properties: expect.objectContaining({
					propMod3: { $ref: '#/components/schemas/Model3' },
				}),
			})
		);
	});

	it('builds one TypeScript generator for multiple wildcard schema files', async () => {
		const result = await TypescriptToOpenApiSpec.generate(openAPIObject, [
			{ path: join(process.cwd(), '__mocks__/models.ts') },
			{ path: join(process.cwd(), '__mocks__/more-models.ts') },
		]);

		expect(createProgram).toHaveBeenCalledTimes(1);
		expect(result.components?.schemas).toEqual(
			expect.objectContaining({
				Model1: expect.any(Object),
				Model2: expect.any(Object),
				Model20: expect.any(Object),
				Model21: expect.any(Object),
			})
		);
	});

	it('shares compiler work across fragmented same-path entries', async () => {
		const modelsPath = join(process.cwd(), '__mocks__/models.ts');
		const paths = ['Model1', 'Model2', 'Model19', 'Model1'].map((interfaceName) => ({
			path: modelsPath,
			interfaceName,
		}));
		const expectedSchemas = {};
		for (const path of paths) {
			const individual = await TypescriptToOpenApiSpec.generate(openAPIObject, [path]);
			Object.assign(expectedSchemas, individual.components?.schemas);
		}
		jest.clearAllMocks();

		const result = await TypescriptToOpenApiSpec.generate(openAPIObject, paths);

		expect(result.components?.schemas).toEqual(expectedSchemas);
		expect(createProgram).toHaveBeenCalledTimes(1);
	});

	it('reuses the program for adjacent repeated names', async () => {
		const schemaPath = { path: join(process.cwd(), '__mocks__/models.ts'), interfaceName: 'Model2' };
		const single = await TypescriptToOpenApiSpec.generate(openAPIObject, [schemaPath]);
		jest.clearAllMocks();
		expect(await TypescriptToOpenApiSpec.generate(openAPIObject, [schemaPath, schemaPath, schemaPath])).toEqual(single);
		expect(createProgram).toHaveBeenCalledTimes(1);
	});

	it('preserves wildcard boundaries and empty input', async () => {
		const modelsPath = join(process.cwd(), '__mocks__/models.ts');
		const wildcardPath = join(process.cwd(), '__mocks__/more-models.ts');
		const paths = [
			...['Model1', 'Model2', 'Model19', 'Model1'].map((interfaceName) => ({ path: modelsPath, interfaceName })),
			{ path: wildcardPath },
			{ path: wildcardPath, interfaceName: '*' },
			{ path: modelsPath, interfaceName: 'Model2' },
		];
		const result = await TypescriptToOpenApiSpec.generate(openAPIObject, paths);
		expect(createProgram).toHaveBeenCalledTimes(3);
		expect(result.components?.schemas).toHaveProperty('Model20');
		expect(result.components?.schemas).toHaveProperty('Model19');
		jest.clearAllMocks();
		expect((await TypescriptToOpenApiSpec.generate(openAPIObject, [])).components?.schemas).toEqual({});
		expect(createProgram).not.toHaveBeenCalled();
	});

	it.each([false, true])(
		'preserves last-entry precedence for conflicting declarations (reversed: %s)',
		async (reverse) => {
			const directory = mkdtempSync(join(tmpdir(), 'openapi-batch-collisions-'));
			try {
				const files = ['first', 'second'].map((source) => {
					const path = join(directory, `${source}.ts`);
					writeFileSync(
						path,
						`export interface Collision { source: '${source}'; child: Shared }
					export interface Shared { ${source}: string }`
					);
					return { path, interfaceName: 'Collision' };
				});
				if (reverse) files.reverse();
				const paths = [
					files[0],
					...['Model2', 'Model19'].map((interfaceName) => ({
						path: join(process.cwd(), '__mocks__/models.ts'),
						interfaceName,
					})),
					files[1],
				];
				const expectedSchemas = await generateIndividually(paths);
				jest.clearAllMocks();
				const result = await TypescriptToOpenApiSpec.generate(openAPIObject, paths);
				expect(result.components?.schemas).toEqual(expectedSchemas);
				expect(createProgram).toHaveBeenCalledTimes(3);
			} finally {
				rmSync(directory, { recursive: true, force: true });
			}
		}
	);

	it.each([false, true])('preserves conflicting child definitions (through a barrel: %s)', async (barrel) => {
		const directory = mkdtempSync(join(tmpdir(), 'openapi-batch-fallback-'));
		try {
			const unique = ['First', 'Second'].map((name) => {
				const path = join(directory, `${name}.ts`);
				writeFileSync(
					path,
					`export interface ${name} { child: Shared }
					export interface Shared { ${name.toLowerCase()}: string }`
				);
				return { path, interfaceName: name };
			});
			if (barrel) {
				const path = join(directory, 'barrel.ts');
				// Load both declarations without a duplicate re-export diagnostic.
				writeFileSync(path, "export { First } from './First'; export { Second } from './Second';");
				for (const entry of unique) entry.path = path;
			}
			const repeated = { path: join(process.cwd(), '__mocks__/models.ts'), interfaceName: 'Model2' };
			const paths = [repeated, ...unique, repeated];
			const expectedSchemas = await generateIndividually(paths);
			jest.clearAllMocks();
			const result = await TypescriptToOpenApiSpec.generate(openAPIObject, paths);
			expect(result.components?.schemas).toEqual(expectedSchemas);
			expect(createProgram).toHaveBeenCalledTimes(barrel ? 3 : 4);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	async function generateIndividually(paths: SchemaPath[]) {
		const schemas = {};
		for (const path of paths) {
			const result = await TypescriptToOpenApiSpec.generate(openAPIObject, [path]);
			Object.assign(schemas, result.components?.schemas);
		}
		return schemas;
	}
});
