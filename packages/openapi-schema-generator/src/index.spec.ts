import { join } from 'node:path';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { createProgram } from 'ts-json-schema-generator';
import { TypescriptToOpenApiSpec } from './index';

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
});
