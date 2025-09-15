import 'reflect-metadata';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import type { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import type { OpenAPIObject, OperationObject, PathItemObject } from 'openapi3-ts/oas30';
import type { MetadataArgsStorage, RoutingControllersOptions } from 'routing-controllers';
import type { routingControllersToSpec } from 'routing-controllers-openapi';
import { type Config, createGenerator } from 'ts-json-schema-generator';

type LambdaAPIOptions = OperationObject & {
	path: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
};

export interface SchemaPath {
	path: string;
	interfaceName?: string;
}

type ProxyArgs = {
	storage: MetadataArgsStorage;
	app: RoutingControllersOptions;
	validationMetadatasToSchemasFn: typeof validationMetadatasToSchemas;
	routingControllersToSpecFn: typeof routingControllersToSpec;
};

export class TypescriptToOpenApiSpec {
	/**
	 * Function to generate combined OpenAPI spec from proxied APIs and Lambda functions
	 * Handles three scenarios:
	 * 1. Only proxied APIs
	 * 2. Only Lambda functions
	 * 3. Both proxied APIs and Lambda functions
	 *
	 * @param openAPIObject Base OpenAPI object with info, version, etc.
	 * @param pathsToInterfaces Array of schema paths to generate models from
	 * @param extra
	 * @returns Merged OpenAPI spec
	 */
	static async generate(
		openAPIObject: OpenAPIObject,
		pathsToInterfaces: SchemaPath[],
		extra?: { proxyArgs?: ProxyArgs; additionalSchemas?: Record<string, unknown>; verboseLogging?: boolean }
	): Promise<OpenAPIObject> {
		console.log('Starting OpenAPI spec generation...');

		// Generate schemas from TypeScript interfaces
		const config = await TypescriptToOpenApiSpec.generateDefinitions(pathsToInterfaces);

		let finalSpec: OpenAPIObject = {
			...openAPIObject,
			paths: {},
			components: {
				...openAPIObject.components,
				schemas: {
					...openAPIObject.components?.schemas,
					...config.definitions,
				},
			},
		};

		// Process proxied APIs if available
		if (extra?.proxyArgs?.storage && extra?.proxyArgs?.app) {
			extra?.verboseLogging && console.log('Generating spec for proxied APIs...');

			const proxySpec = extra.proxyArgs.routingControllersToSpecFn(extra.proxyArgs.storage, extra.proxyArgs.app, {
				...openAPIObject,
				components: {
					schemas: {
						...extra.proxyArgs.validationMetadatasToSchemasFn({ refPointerPrefix: '#/components/schemas/' }),
						...config.definitions,
					},
				},
			});

			finalSpec = {
				...finalSpec,
				...proxySpec,
				paths: { ...proxySpec.paths },
				components: {
					...finalSpec.components,
					...proxySpec.components,
					// @ts-ignore
					schemas: {
						...(finalSpec.components?.schemas ?? {}),
						...(proxySpec.components?.schemas ?? {}),
					},
				},
			};

			extra?.verboseLogging &&
				console.log(`Found ${Object.keys(proxySpec.paths || {}).length} paths from proxied APIs`);
		} else {
			extra?.verboseLogging && console.log('No proxied APIs configuration provided, skipping');
		}

		// Process Lambda functions if they exist
		let lambdaHandlersRegistered = false;

		try {
			const functionsDir = join(process.cwd(), 'src/functions');

			const dirExists = await fs
				.access(functionsDir)
				.then(() => true)
				.catch(() => false);

			if (dirExists) {
				extra?.verboseLogging && console.log('Importing Lambda handlers...');

				const handlers = await fs.readdir(functionsDir, { withFileTypes: true });
				const handlerDirs = handlers.filter((h) => h.isDirectory());

				extra?.verboseLogging && console.log(`Found ${handlerDirs.length} potential Lambda handler directories`);

				for (const handler of handlerDirs) {
					try {
						const handlerPath = `@/src/functions/${handler.name}/index`;
						extra?.verboseLogging && console.log(`Importing handler: ${handlerPath}`);

						require(handlerPath);
						lambdaHandlersRegistered = true;
					} catch (err) {
						console.error(`Error importing handler ${handler.name}:`, err);
					}
				}
			} else {
				extra?.verboseLogging && console.log('No Lambda functions directory found at src/functions, skipping');
			}
		} catch (error) {
			console.error('Error processing Lambda functions:', error);
		}

		// Get registered Lambda handlers and generate their spec
		if (lambdaHandlersRegistered) {
			const registeredHandlers = getRegisteredLambdaHandlers();
			extra?.verboseLogging && console.log(`Found ${registeredHandlers.length} registered Lambda handlers`);

			if (registeredHandlers.length > 0) {
				const lambdaSpec = generateLambdaOpenAPISpec(registeredHandlers);
				extra?.verboseLogging &&
					console.log(`Generated spec for Lambda handlers with ${Object.keys(lambdaSpec.paths || {}).length} paths`);

				// Merge Lambda paths with existing paths
				const mergedPaths = { ...finalSpec.paths };

				for (const path of Object.keys(lambdaSpec.paths || {})) {
					if (path in mergedPaths) {
						// Path exists in both specs, merge the HTTP methods
						mergedPaths[path] = {
							...mergedPaths[path],
							...lambdaSpec.paths[path],
						};
						extra?.verboseLogging && console.log(`Merged methods for path: ${path}`);
					} else {
						// Path only exists in Lambda spec, add it
						mergedPaths[path] = lambdaSpec.paths[path];
						extra?.verboseLogging && console.log(`Added new path from Lambda: ${path}`);
					}
				}

				// Update the final spec with merged paths and components
				finalSpec = {
					...finalSpec,
					paths: mergedPaths,
					components: {
						...finalSpec.components,
						schemas: {
							...(finalSpec.components?.schemas ?? {}),
							...(lambdaSpec.components?.schemas ?? {}),
						},
					},
				};
			}
		} else {
			extra?.verboseLogging && console.log('No Lambda handlers were registered, skipping Lambda spec generation');
		}

		if (extra?.additionalSchemas) {
			finalSpec = {
				...finalSpec,
				components: {
					...finalSpec.components,
					// @ts-ignore
					schemas: {
						...(finalSpec.components?.schemas ?? {}),
						...(extra.additionalSchemas ?? {}),
					},
				},
			};
		}

		// Transform #/definitions/ references to #/components/schemas/ for OpenAPI 3.x compliance
		finalSpec = TypescriptToOpenApiSpec.transformReferences(finalSpec);

		// Log summary of the generated spec
		extra?.verboseLogging &&
			console.log(`OpenAPI spec generation complete with ${Object.keys(finalSpec.paths || {}).length} total paths`);

		// Convert the merged spec to a JSON string
		return finalSpec;
	}

	/**
	 * Recursively transform all #/definitions/ references to #/components/schemas/
	 * This ensures OpenAPI 3.x compliance since ts-json-schema-generator uses JSON Schema format
	 */
	private static transformReferences<T>(obj: T): T {
		if (obj === null || obj === undefined) {
			return obj;
		}

		if (typeof obj === 'string') {
			// Transform the reference
			return obj.replace(/#\/definitions\//g, '#/components/schemas/') as T;
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => TypescriptToOpenApiSpec.transformReferences(item)) as T;
		}

		if (typeof obj === 'object') {
			// biome-ignore lint/suspicious/noExplicitAny: Allowed for doc gen
			const transformed: any = {};

			for (const [key, value] of Object.entries(obj)) {
				transformed[key] = TypescriptToOpenApiSpec.transformReferences(value);
			}
			return transformed;
		}

		return obj;
	}

	private static async generateDefinitions(paths: SchemaPath[]) {
		const results = paths.map(({ path, interfaceName }) => {
			const config: Config = {
				path,
				tsconfig: `${process.cwd()}/tsconfig.json`,
				type: interfaceName ?? '*',
			};
			return config;
		});

		return results.reduce(
			(acc, config) => {
				const generator = createGenerator(config);
				const schema = generator.createSchema(config.type);

				return {
					// biome-ignore lint/performance/noAccumulatingSpread: <explanation>
					...acc,
					definitions: {
						...acc.definitions,
						...schema.definitions,
					},
				};
			},
			{ definitions: {} }
		);
	}
}

declare global {
	interface LambdaHandlerMetadata {
		name: string;
		// biome-ignore lint/complexity/noBannedTypes: Needs to be Function
		constructor: Function;
		endpoints?: Array<{
			method: string;
			path: string;
			handler: string;
			options: LambdaAPIOptions;
		}>;
	}

	var lambdaHandlers: LambdaHandlerMetadata[];
}

if (typeof global.lambdaHandlers === 'undefined') {
	global.lambdaHandlers = [];
}

export function LambdaAPI(options: LambdaAPIOptions) {
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be any
	return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		// Store metadata on the class for later extraction
		if (!Reflect.hasMetadata('openapi:endpoints', target.constructor)) {
			Reflect.defineMetadata('openapi:endpoints', [], target.constructor);
		}

		const endpoints = Reflect.getMetadata('openapi:endpoints', target.constructor);

		endpoints.push({
			method: options.method?.toLowerCase(),
			path: options.path,
			handler: propertyKey,
			options,
		});

		return descriptor;
	};
}

/**
 * Class decorator to register a Lambda handler for OpenAPI generation
 * This needs to be applied to the handler class
 */

// biome-ignore lint/suspicious/noExplicitAny: Classes are too Dynamic to predict types / no need to fight typechecker
export function registerLambdaHandler(target: any) {
	// Check if the handler is already registered to avoid duplicates
	if (!global.lambdaHandlers.some((h) => h === target)) {
		global.lambdaHandlers.push(target);
	}

	return target;
}

/**
 * Generates OpenAPI spec for Lambda handlers
 */
function generateLambdaOpenAPISpec(lambdaHandlers: LambdaHandlerMetadata[]): OpenAPIObject {
	const spec = {
		paths: {},
		components: {
			schemas: {},
			securitySchemes: {},
		},
	} as OpenAPIObject;

	// If no handlers are registered, return empty spec
	if (lambdaHandlers.length === 0) {
		return spec;
	}

	for (const handlerClass of lambdaHandlers) {
		const endpoints = Reflect.getMetadata('openapi:endpoints', handlerClass as object) || [];

		for (const endpoint of endpoints) {
			const { method, path, options } = endpoint;

			if (!spec.paths[path]) {
				spec.paths[path] = {};
			}

			const pathItem = spec.paths[path] as PathItemObject;

			const operation: OperationObject = {
				parameters: options.parameters || [],
				responses: options.responses,
				summary: options.summary,
				tags: options.tags,
				description: options.description,
				servers: options.servers,
			};

			// Add request body if present
			if (options.requestBody) {
				operation.requestBody = options.requestBody;
			}

			pathItem[method] = operation;
		}
	}

	return spec;
}

/**
 * Get the current list of registered Lambda handlers
 */
function getRegisteredLambdaHandlers(): LambdaHandlerMetadata[] {
	return global.lambdaHandlers || [];
}
