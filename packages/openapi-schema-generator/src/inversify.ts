import 'reflect-metadata';
import { glob } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SwaggerUiProvider } from '@inversifyjs/http-open-api';
import type { OpenApi3Dot1Object, OpenApi3Dot1PathItemObject } from '@inversifyjs/open-api-types/v3Dot1';
import type { Container } from 'inversify';
import { type ZodType, z } from 'zod';
import type { SchemaPath } from './type-schemas';

export type { SchemaPath } from './type-schemas';

export interface LambdaOpenApi {
	path: string;
	pathItem: OpenApi3Dot1PathItemObject;
}

export interface InversifyOpenApiOptions {
	/** Service metadata, shared schemas, servers and other OpenAPI settings. */
	openApiObject: OpenApi3Dot1Object;
	/** The application's container, with its dependencies already configured. */
	container: Container;
	cwd?: string;
	/** Set a discovery glob to false to skip that source. */
	modelsGlob?: string | false;
	controllersGlob?: string | false;
	functionsGlob?: string | false;
	/**
	 * TypeScript interfaces and type aliases to document alongside Zod schemas, as in the
	 * legacy `pathsToInterfaces`. Paths may be files or globs, relative to `cwd`. The
	 * TypeScript compiler is only loaded when this is non-empty.
	 */
	typeSchemas?: SchemaPath[];
	/** tsconfig used for `typeSchemas`. Defaults to `<cwd>/tsconfig.json`. */
	tsconfig?: string;
	/** Run TypeScript diagnostics while generating `typeSchemas`. Defaults to false; type check in lint/CI. */
	typeCheck?: boolean;
}

function addSchema(schemas: Record<string, unknown>, key: string, schema: unknown, source: string): void {
	if (!key || Object.hasOwn(schemas, key)) {
		throw new Error(`Duplicate or empty schema name "${key}" (from ${source}). Rename one of them.`);
	}
	schemas[key] = schema;
}

const isZodType = (value: unknown): value is ZodType =>
	!!value &&
	typeof value === 'object' &&
	'_zod' in value &&
	typeof (value as { safeParse?: unknown }).safeParse === 'function' &&
	typeof (value as { parse?: unknown }).parse === 'function';

const toSchemaName = (exportName: string): string => {
	const stripped = exportName.replace(/Schema$/i, '');
	return stripped.charAt(0).toUpperCase() + stripped.slice(1);
};

async function importAllFrom(pattern: string | false, cwd: string) {
	const results: Array<{ file: string; module: Record<string, unknown> }> = [];
	if (pattern === false) return results;
	const files: string[] = [];
	for await (const file of glob(pattern, { cwd })) files.push(resolve(cwd, file));
	for (const file of files.sort()) {
		const module = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
		results.push({ file, module });
	}
	return results;
}

/** Build-time discovery for Inversify HTTP controllers, Zod 4 (including Mini), and standalone Lambdas. */
export class InversifyToOpenApiSpec {
	static async generate(options: InversifyOpenApiOptions): Promise<OpenApi3Dot1Object> {
		const {
			container,
			openApiObject,
			cwd = process.cwd(),
			modelsGlob = 'src/domain/models/**/*.ts',
			controllersGlob = 'src/proxy/resources/*.ts',
			functionsGlob = 'src/functions/*/index.ts',
			typeSchemas = [],
			tsconfig,
			typeCheck = false,
		} = options;
		const schemas: Record<string, unknown> = { ...openApiObject.components?.schemas };

		if (typeSchemas.length > 0) {
			// Lazy: keeps the TypeScript compiler out of Zod-only generation.
			const { generateTypeSchemas } = await import('./type-schemas');
			const generated = generateTypeSchemas(typeSchemas, { cwd, tsconfig, skipTypeCheck: !typeCheck });
			for (const [key, schema] of Object.entries(generated)) {
				addSchema(schemas, key, schema, 'TypeScript typeSchemas');
			}
		}

		for (const { file, module } of await importAllFrom(modelsGlob, cwd)) {
			for (const [exportName, value] of Object.entries(module)) {
				if (!isZodType(value)) continue;
				addSchema(
					schemas,
					toSchemaName(exportName),
					z.toJSONSchema(value, { target: 'openapi-3.0' }),
					`"${exportName}" in ${relative(cwd, file)}`
				);
			}
		}

		for (const { module } of await importAllFrom(controllersGlob, cwd)) {
			for (const value of Object.values(module)) {
				if (typeof value !== 'function' || !value.prototype) continue;
				const ctor = value as new (...args: never[]) => unknown;
				if (!container.isBound(ctor)) container.bind(ctor).toSelf().inSingletonScope();
			}
		}

		const lambdaPaths: LambdaOpenApi[] = [];
		for (const { file, module } of await importAllFrom(functionsGlob, cwd)) {
			const meta = module.openApi;
			if (meta === undefined) continue;
			if (
				!meta ||
				typeof meta !== 'object' ||
				!('path' in meta) ||
				typeof meta.path !== 'string' ||
				!meta.path.startsWith('/') ||
				!('pathItem' in meta) ||
				!meta.pathItem ||
				typeof meta.pathItem !== 'object' ||
				Array.isArray(meta.pathItem)
			) {
				throw new Error(`Invalid openApi export in ${relative(cwd, file)} — needs { path, pathItem }.`);
			}
			lambdaPaths.push(meta as LambdaOpenApi);
		}

		const provider = new SwaggerUiProvider({
			api: {
				openApiObject: {
					...openApiObject,
					paths: { ...openApiObject.paths },
					components: { ...openApiObject.components, schemas: schemas as never },
				},
				path: '/docs',
			},
			logger: false,
		});
		provider.provide(container);
		const spec = provider.openApiObject;
		spec.paths ??= {};
		for (const { path, pathItem } of lambdaPaths) {
			spec.paths[path] = { ...spec.paths[path], ...pathItem };
		}
		return spec;
	}
}
