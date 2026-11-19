import { isAbsolute, parse, resolve } from 'node:path';
import { type Config, createProgram, DEFAULT_CONFIG } from 'ts-json-schema-generator';
import { createIndexedGenerator } from './indexed-generator';

export interface SchemaPath {
	/** File or glob containing the TypeScript declarations. Relative paths resolve from `cwd`. */
	path: string;
	/** Exported interface or type alias to generate. Omit to generate every exported declaration. */
	interfaceName?: string;
}

export interface TypeSchemaOptions {
	/** Base directory for relative paths and the default `tsconfig.json`. Defaults to `process.cwd()`. */
	cwd?: string;
	/** tsconfig used to resolve imports and path aliases. Defaults to `<cwd>/tsconfig.json`. */
	tsconfig?: string;
	/**
	 * Skip TypeScript diagnostics while building the program. Schema generation only needs
	 * the type graph, and type checking is usually the slowest step. Defaults to `false`.
	 */
	skipTypeCheck?: boolean;
}

type Schemas = Record<string, unknown>;

/**
 * Generate OpenAPI component schemas from TypeScript interfaces and type aliases.
 * Referenced declarations are included, and `$ref`s point at `#/components/schemas/`.
 */
export function generateTypeSchemas(paths: SchemaPath[], options: TypeSchemaOptions = {}): Schemas {
	const cwd = options.cwd ?? process.cwd();
	const settings: Required<TypeSchemaOptions> = {
		cwd,
		tsconfig: resolve(cwd, options.tsconfig ?? 'tsconfig.json'),
		skipTypeCheck: options.skipTypeCheck ?? false,
	};
	const resolved = paths.map((entry) => ({
		...entry,
		path: isAbsolute(entry.path) ? entry.path : resolve(cwd, entry.path),
	}));
	return toComponentNames(transformReferences(generateDefinitions(resolved, settings)));
}

const COMPONENT_PREFIX = '#/components/schemas/';
const VALID_COMPONENT_NAME = /^[A-Za-z0-9._-]+$/;

/**
 * OpenAPI component names must match `^[a-zA-Z0-9._-]+$`, but generic instantiations
 * produce names such as `Page<User>`. Rename those (`Page_User`) and rewrite their refs.
 */
function toComponentNames(schemas: Schemas): Schemas {
	const renames = new Map<string, string>();
	const taken = new Set(Object.keys(schemas).filter((name) => VALID_COMPONENT_NAME.test(name)));
	for (const name of Object.keys(schemas)) {
		if (VALID_COMPONENT_NAME.test(name)) continue;
		const base = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'Schema';
		let candidate = base;
		for (let i = 2; taken.has(candidate); i++) candidate = `${base}_${i}`;
		taken.add(candidate);
		renames.set(name, candidate);
	}
	if (renames.size === 0) return schemas;

	const rewrite = (value: unknown): unknown => {
		if (typeof value === 'string' && value.startsWith(COMPONENT_PREFIX)) {
			const target = decodeURIComponent(value.slice(COMPONENT_PREFIX.length));
			const renamed = renames.get(target);
			return renamed ? COMPONENT_PREFIX + renamed : value;
		}
		if (Array.isArray(value)) return value.map(rewrite);
		if (value && typeof value === 'object') {
			return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]));
		}
		return value;
	};
	return Object.fromEntries(
		Object.entries(schemas).map(([name, schema]) => [renames.get(name) ?? name, rewrite(schema)])
	);
}

/** Rewrite JSON Schema `#/definitions/` references to OpenAPI `#/components/schemas/`. */
export function transformReferences<T>(obj: T): T {
	if (typeof obj === 'string') {
		return obj.replace(/#\/definitions\//g, '#/components/schemas/') as T;
	}
	if (Array.isArray(obj)) {
		return obj.map((item) => transformReferences(item)) as T;
	}
	if (obj && typeof obj === 'object') {
		const transformed: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			transformed[key] = transformReferences(value);
		}
		return transformed as T;
	}
	return obj;
}

export function generateDefinitions(paths: SchemaPath[], settings: Required<TypeSchemaOptions>): Schemas {
	const definitions: Schemas = {};
	let previousPath: string | undefined;
	let previousProgram: Config['tsProgram'];

	for (const batch of createSchemaBatches(paths)) {
		if (batch.length === 1) {
			const path = batch[0].path;
			if (path !== previousPath || !previousProgram) {
				previousProgram = createProgram({
					...DEFAULT_CONFIG,
					path,
					tsconfig: settings.tsconfig,
					skipTypeCheck: settings.skipTypeCheck,
				});
				previousPath = path;
			}
			// Share compiler work, but retain a fresh parser/formatter and an ordered
			// schema merge per entry. Even a barrel can contain conflicting child names.
			Object.assign(definitions, generateDefinitionBatch(batch, settings, path, previousProgram));
			continue;
		}

		previousPath = undefined;
		previousProgram = undefined;
		const combinedPath = combinePaths(batch.map(({ path }) => path));

		if (combinedPath === undefined) {
			for (const schemaPath of batch) {
				Object.assign(definitions, generateDefinitionBatch([schemaPath], settings));
			}
			continue;
		}

		try {
			Object.assign(definitions, generateDefinitionBatch(batch, settings, combinedPath));
		} catch {
			// Files that cannot share a TypeScript program (for example, because they
			// declare conflicting globals) retain the original per-entry behaviour.
			for (const schemaPath of batch) {
				Object.assign(definitions, generateDefinitionBatch([schemaPath], settings));
			}
		}
	}

	return definitions;
}

function generateDefinitionBatch(
	paths: SchemaPath[],
	settings: Required<TypeSchemaOptions>,
	combinedPath = paths[0].path,
	tsProgram?: Config['tsProgram']
): Schemas {
	const types = paths.map(({ interfaceName }) => interfaceName ?? '*');
	const type = types[0] === '*' ? '*' : types.length === 1 ? types[0] : types;
	const config: Config = {
		path: combinedPath,
		tsProgram,
		tsconfig: settings.tsconfig,
		skipTypeCheck: settings.skipTypeCheck,
		type,
	};
	return (createIndexedGenerator(config).createSchema(type).definitions ?? {}) as Schemas;
}

function createSchemaBatches(paths: SchemaPath[]): SchemaPath[][] {
	const batches: SchemaPath[][] = [];
	let start = 0;

	while (start < paths.length) {
		const wildcardBatch = (paths[start].interfaceName ?? '*') === '*';
		let end = start + 1;

		while (end < paths.length && ((paths[end].interfaceName ?? '*') === '*') === wildcardBatch) {
			end += 1;
		}

		const batch = paths.slice(start, end);
		const types = batch.map(({ interfaceName }) => interfaceName ?? '*');

		if (!wildcardBatch && new Set(types).size !== types.length) {
			batches.push(...batch.map((schemaPath) => [schemaPath]));
		} else {
			batches.push(batch);
		}

		start = end;
	}

	return batches;
}

function combinePaths(paths: string[]): string | undefined {
	const uniquePaths = [...new Set(paths)];

	if (uniquePaths.length === 1) {
		return uniquePaths[0];
	}

	// Commas delimit brace alternatives, so retain the single-file path for uncommon
	// patterns or filenames containing one rather than changing their meaning.
	if (uniquePaths.some((path) => path.includes(','))) {
		return undefined;
	}

	const absolutePaths = uniquePaths.map((path) => resolve(path));
	const roots = new Set(absolutePaths.map((path) => parse(path).root));

	if (roots.size !== 1) {
		return undefined;
	}

	const root = parse(absolutePaths[0]).root;
	const normalisedRoot = root.replaceAll('\\', '/');
	const alternatives = absolutePaths.map((path) => path.slice(root.length).replaceAll('\\', '/'));

	return `${normalisedRoot}{${alternatives.join(',')}}`;
}
