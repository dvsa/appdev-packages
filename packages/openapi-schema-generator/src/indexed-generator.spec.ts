import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGenerator, RootlessError, SchemaGenerator, type ts } from 'ts-json-schema-generator';
import { createIndexedGenerator } from './indexed-generator';

describe('indexed schema generation', () => {
	const config = {
		path: join(process.cwd(), '__mocks__/models.ts'),
		tsconfig: join(process.cwd(), 'tsconfig.json'),
	};

	it('indexes project declarations once for multiple named schemas and subsequent lookups', () => {
		const types = ['Model1', 'Model2', 'Model19'];
		const expected = createGenerator(config).createSchema(types);
		// Count tree scans instead of asserting a machine-dependent time limit.
		const prototype = SchemaGenerator.prototype as unknown as {
			appendTypes: (files: readonly ts.SourceFile[], checker: ts.TypeChecker, types: Map<string, ts.Node>) => void;
		};
		const scans = jest.spyOn(prototype, 'appendTypes');
		try {
			const generator = createIndexedGenerator(config);
			expect(generator.createSchema(types)).toEqual(expected);
			expect(generator.createSchema(types)).toEqual(expected);
			expect(scans).toHaveBeenCalledTimes(1);
		} finally {
			scans.mockRestore();
		}
	});
});

describe('indexed schema selection compatibility', () => {
	let directory: string;
	let config: { path: string; tsconfig: string };

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'openapi-index-tests-'));
		const dependency = join(directory, 'node_modules/lookup-fixture');
		mkdirSync(dependency, { recursive: true });
		writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: 'lookup-fixture', types: 'index.d.ts' }));
		writeFileSync(
			join(dependency, 'index.d.ts'),
			'export interface External { external: number }; export interface Shared { dependency: boolean }'
		);
		writeFileSync(
			join(directory, 'models.ts'),
			`import type { External } from 'lookup-fixture';
			export interface Shared { local: string }
			export interface Model { shared: Shared; external: External }
			/** @internal */
			export interface Hidden { secret: string }
			export interface Generic<T> { value: T }
			export namespace Nested { export interface Item { value: number } }`
		);
		writeFileSync(join(directory, 'entry.ts'), "export * from './models';");
		writeFileSync(
			join(directory, 'tsconfig.json'),
			JSON.stringify({ compilerOptions: { types: [], skipLibCheck: true } })
		);
		config = { path: join(directory, 'entry.ts'), tsconfig: join(directory, 'tsconfig.json') };
	});

	afterAll(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	it('preserves project precedence after external lookup, re-exports and qualified names', () => {
		const types = ['External', 'Shared', 'Model', 'Nested.Item'];
		const indexed = createIndexedGenerator(config);
		expect(indexed.createSchema(types)).toEqual(createGenerator(config).createSchema(types));
		expect(indexed.createSchema('Shared').definitions?.Shared).toMatchObject({
			properties: { local: { type: 'string' } },
		});
	});

	it('keeps wildcard selection independent of the named indexes', () => {
		const indexed = createIndexedGenerator(config);
		indexed.createSchema('External');
		expect(indexed.createSchema('*')).toEqual(createGenerator(config).createSchema('*'));
		expect(indexed.createSchema()).toEqual(createGenerator(config).createSchema());
		expect(() => indexed.createSchema(['*', 'Model'])).toThrow("Cannot mix '*' with specific type names");
	});

	it('retains missing, internal and generic type errors without rescanning dependencies', () => {
		const prototype = SchemaGenerator.prototype as unknown as {
			appendTypes: (files: readonly ts.SourceFile[], checker: ts.TypeChecker, types: Map<string, ts.Node>) => void;
		};
		const scans = jest.spyOn(prototype, 'appendTypes');
		try {
			const indexed = createIndexedGenerator(config);
			for (const name of ['Missing', 'Hidden', 'Generic', 'Missing']) {
				expect(() => indexed.createSchema(name)).toThrow(new RootlessError(name));
			}
			expect(scans).toHaveBeenCalledTimes(2);
		} finally {
			scans.mockRestore();
		}
	});

	it('uses each generator configuration when selecting internal types', () => {
		const exposed = { ...config, expose: 'all' as const };
		expect(createIndexedGenerator(exposed).createSchema('Hidden')).toEqual(
			createGenerator(exposed).createSchema('Hidden')
		);
	});

	it('reads changed declarations on a new generation run', () => {
		const path = join(directory, 'changing.ts');
		writeFileSync(path, 'export interface Changing { value: string }');
		const first = createIndexedGenerator({ ...config, path }).createSchema('Changing');
		writeFileSync(path, 'export interface Changing { value: number }');
		const second = createIndexedGenerator({ ...config, path }).createSchema('Changing');
		expect(first.definitions?.Changing).toMatchObject({ properties: { value: { type: 'string' } } });
		expect(second.definitions?.Changing).toMatchObject({ properties: { value: { type: 'number' } } });
	});
});
