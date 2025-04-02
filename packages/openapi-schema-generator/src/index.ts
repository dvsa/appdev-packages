import 'reflect-metadata';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import type { OpenAPIObject, OperationObject, PathItemObject, SchemaObject } from 'openapi3-ts/oas30';
import type { MetadataArgsStorage, RoutingControllersOptions } from 'routing-controllers';
import { routingControllersToSpec } from 'routing-controllers-openapi';
import {
	type TypeChecker,
	type Node as TypescriptNode,
	createProgram,
	forEachChild,
	isClassDeclaration,
	isEnumDeclaration,
	isInterfaceDeclaration,
	isLiteralTypeNode,
	isPropertyDeclaration,
	isPropertySignature,
	isStringLiteral,
	isTypeAliasDeclaration,
	isUnionTypeNode,
	isVariableDeclaration,
	isVariableStatement,
} from 'typescript';

type OpenAPIDataType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface OpenAPISchemaObjectBase extends SchemaObject {
	type?: OpenAPIDataType;
}

interface OpenAPIObjectSchemaObject extends OpenAPISchemaObjectBase {
	type: 'object';
	properties: Record<string, SchemaObject>;
	required?: string[];
}

interface OpenAPIArraySchemaObject extends OpenAPISchemaObjectBase {
	type: 'array';
	items: SchemaObject;
}

interface OpenAPIEnumSchemaObject<T> extends OpenAPISchemaObjectBase {
	enum: T[];
}

interface OpenAPIRefSchemaObject extends OpenAPISchemaObjectBase {
	$ref: string;
}

type LambdaAPIOptions = OperationObject & {
	path: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
};

type SpecificOpenAPISchemaObject =
	| OpenAPIObjectSchemaObject
	| OpenAPIArraySchemaObject
	| OpenAPIRefSchemaObject
	| OpenAPIEnumSchemaObject<unknown>;

export interface SchemaPath {
	path: string;
	interfaceName?: string;
}

type ProxyArgs = { storage: MetadataArgsStorage; app: RoutingControllersOptions };

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
		const [namedSchemas, unnamedSchemas] = await Promise.all([
			TypescriptToOpenApiSpec.generateNamedSchemas(pathsToInterfaces),
			TypescriptToOpenApiSpec.generateUnnamedSchemas(pathsToInterfaces),
		]);

		let finalSpec: OpenAPIObject = {
			...openAPIObject,
			paths: {},
			components: {
				...openAPIObject.components,
				// @ts-ignore
				schemas: {
					...openAPIObject.components?.schemas,
					...namedSchemas,
					...unnamedSchemas,
				},
			},
		};

		// Process proxied APIs if available
		if (extra?.proxyArgs?.storage && extra?.proxyArgs?.app) {
			extra?.verboseLogging && console.log('Generating spec for proxied APIs...');

			const proxySpec = routingControllersToSpec(extra.proxyArgs.storage, extra.proxyArgs.app, {
				...openAPIObject,
				components: {
					// @ts-ignore
					schemas: {
						...validationMetadatasToSchemas({ refPointerPrefix: '#/components/schemas/' }),
						...namedSchemas,
						...unnamedSchemas,
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
						...finalSpec.components?.schemas,
						...proxySpec.components?.schemas,
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

		// Log summary of the generated spec
		extra?.verboseLogging &&
			console.log(`OpenAPI spec generation complete with ${Object.keys(finalSpec.paths || {}).length} total paths`);

		// Convert the merged spec to a JSON string
		return finalSpec;
	}

	/**
	 * Generate OpenAPI schemas for all interfaces in a file
	 * @param paths
	 */
	private static async generateNamedSchemas(paths: SchemaPath[]): Promise<Record<string, unknown>> {
		const results = await Promise.all(
			// loop over the paths and generate the schema for each interface
			paths
				// we only want to run the `generateByName` method for paths that have an interfaceName specified
				.filter(({ interfaceName }) => !!interfaceName)
				// create an array of promises to generate the schema for each interface
				.map(({ path: modelPath, interfaceName }) =>
					TypescriptToOpenApiSpec.generateByName(modelPath, interfaceName as string)
				)
		);

		// merge the results into a single object
		return results.reduce((acc, curr) => Object.assign(acc, curr), {});
	}

	/**
	 * Generate OpenAPI schemas for all interfaces in a file
	 * @param paths
	 */
	private static async generateUnnamedSchemas(paths: SchemaPath[]): Promise<Record<string, unknown>> {
		const results = await Promise.all(
			// loop over the paths and generate the schema for each file path
			paths
				// we only want to generate every interface in a file if no interfaceName is specified
				.filter(({ interfaceName }) => !interfaceName)
				// create an array of promises to generate the schema for all the file contents
				.map(({ path: modelPath }) => TypescriptToOpenApiSpec.generateMany(modelPath))
		);

		// merge the results into a single object
		return results.reduce((acc, curr) => Object.assign(acc, curr), {});
	}

	/**
	 * Generate many OpenAPI schemas from TypeScript interfaces
	 */
	static async generateMany(pathToFile: string): Promise<OpenAPIObjectSchemaObject> {
		const definitions = TypescriptToOpenApiSpec.extractDefinitions(pathToFile);
		const schemas = Object.fromEntries(
			Object.entries(definitions).map(([name, def]) => [name, TypescriptToOpenApiSpec.dictToOpenAPI(def)])
		);
		return TypescriptToOpenApiSpec.dereferenceArrays(schemas) as unknown as OpenAPIObjectSchemaObject;
	}

	/**
	 * Generate a single OpenAPI schema from a TypeScript interface
	 * @param pathToFile
	 * @param interfaceName
	 */
	static async generateByName(pathToFile: string, interfaceName: string): Promise<OpenAPIObjectSchemaObject> {
		const definitions = TypescriptToOpenApiSpec.extractDefinitions(pathToFile, interfaceName);

		const referencedModels = TypescriptToOpenApiSpec.findReferencedModels(
			definitions[interfaceName],
			definitions,
			new Set([interfaceName])
		);

		const schemas = Object.fromEntries(
			Object.entries(definitions)
				.map(([name, def]) => [name, TypescriptToOpenApiSpec.dictToOpenAPI(def)])
				.filter(([name]) => typeof name === 'string' && referencedModels.has(name))
		);
		return TypescriptToOpenApiSpec.dereferenceArrays(schemas) as unknown as OpenAPIObjectSchemaObject;
	}

	/**
	 * Recursively find all referenced models in a schema
	 * e.g.
	 * - interface A { prop: B }
	 * - interface B { prop: C }
	 * - This will return a set containing A, B, and C definitions
	 * @param schema
	 * @param definitions
	 * @param referencedModels
	 * @private
	 */
	private static findReferencedModels(
		schema: SchemaObject,
		definitions: Record<string, SchemaObject>,
		referencedModels: Set<string> = new Set()
	): Set<string> {
		const primitiveTypes = [
			'string',
			'number',
			'boolean',
			'any',
			'unknown',
			'null',
			'undefined',
			'void',
			'never',
			'object',
			'array',
		] as const;

		for (const [, value] of Object.entries(schema ?? {})) {
			if (!primitiveTypes.includes(value)) {
				if (value && !referencedModels.has(value)) {
					// Clean up union types by taking the first non-undefined type
					const cleanValue = value.toString().split('|')[0].trim();
					referencedModels.add(cleanValue);

					if (definitions[cleanValue]) {
						TypescriptToOpenApiSpec.findReferencedModels(definitions[cleanValue], definitions, referencedModels);
					}
				}
			}
		}

		return referencedModels;
	}

	/**
	 * Dereference arrays in the schema
	 * @param {Record<string, SpecificOpenAPISchemaObject>} obj
	 * @returns {Record<string, SpecificOpenAPISchemaObject>}
	 * @private
	 */
	private static dereferenceArrays(
		obj: Record<string, SpecificOpenAPISchemaObject>
	): Record<string, SpecificOpenAPISchemaObject> {
		const result: Record<string, SpecificOpenAPISchemaObject> = {};

		for (const [key, value] of Object.entries(obj)) {
			if ('$ref' in value && typeof value.$ref === 'string') {
				const refValue = value.$ref;
				if (refValue.endsWith('[]')) {
					result[key] = {
						type: 'array',
						items: { $ref: refValue.slice(0, -2) },
					};
				} else {
					result[key] = value;
				}
			} else if (value.type === 'object' && value.properties) {
				result[key] = {
					...value,
					properties: TypescriptToOpenApiSpec.dereferenceArrays(
						value.properties as Record<string, SpecificOpenAPISchemaObject>
					),
				};
			} else if (value.type === 'array' && value.items) {
				result[key] = {
					...value,
					// @ts-ignore
					items: TypescriptToOpenApiSpec.dereferenceArrays({ item: value.items }).item,
				};
			} else {
				result[key] = value;
			}
		}

		return result;
	}

	/**
	 * Convert TypeScript interface to OpenAPI schema
	 * @param {Record<string, string>} interfaceObj
	 * @returns {OpenAPIObjectSchemaObject}
	 * @private
	 */
	private static dictToOpenAPI(
		interfaceObj: Record<string, string>
	): OpenAPIObjectSchemaObject | OpenAPIEnumSchemaObject<unknown> {
		const properties: Record<string, SchemaObject> = {};
		const required: string[] = [];

		for (const [key, value] of Object.entries(interfaceObj)) {
			const isRequired = !key.endsWith('?');
			const propertyName = isRequired ? key : key.slice(0, -1);
			let val = typeof value === 'string' ? value.replace(' | undefined', '') : value;

			if (Array.isArray(val)) {
				const arrayVal: unknown[] = val;

				const calcType = arrayVal.every((val) => typeof val === 'boolean')
					? 'boolean'
					: arrayVal.every((val) => typeof val === 'number')
						? 'number'
						: 'string';

				return {
					type: calcType,
					enum: val,
				};
			}

			// Handle union types by taking the first non-undefined type
			if (typeof val === 'string' && val.includes('|')) {
				val = val.split('|')[0].trim();
			}

			if (isRequired) {
				required.push(propertyName);
			}

			properties[propertyName] = TypescriptToOpenApiSpec.typeToSchemaObject(val);
		}

		return {
			type: 'object',
			properties,
			required: required.length > 0 ? required : undefined,
		};
	}

	/**
	 * Convert TypeScript type to OpenAPI schema object
	 * @param {string} value
	 * @returns {SchemaObject | OpenAPIRefSchemaObject}
	 * @private
	 */
	private static typeToSchemaObject(value: string | unknown): SchemaObject | OpenAPIRefSchemaObject {
		if (typeof value === 'string' && value.endsWith('[]')) {
			return {
				type: 'array',
				items: TypescriptToOpenApiSpec.typeToSchemaObject(value.slice(0, -2)),
			};
		}

		switch (value) {
			case 'string':
			case 'number':
			case 'boolean':
				return { type: value };
			default:
				return { $ref: `#/components/schemas/${value}` };
		}
	}

	/**
	 * Extract definition from the TypeScript file and convert to a dictionary
	 * @param {string} filePath
	 * @param {string} interfaceName - optional name if only requesting a single interface to be converted
	 * @returns {Record<string, Record<string, string>>}
	 * @private
	 */
	private static extractDefinitions(filePath: string, interfaceName?: string): Record<string, Record<string, string>> {
		const program = createProgram([filePath], {});
		const sourceFile = program.getSourceFile(filePath);
		const definitions: Record<string, Record<string, string>> = {};

		if (sourceFile) {
			const typeChecker = program.getTypeChecker();
			TypescriptToOpenApiSpec.visitNode(sourceFile, typeChecker, definitions);
		}

		if (interfaceName && !definitions[interfaceName]) {
			throw new Error(`Interface ${interfaceName} not found in ${filePath}`);
		}

		return definitions;
	}

	/**
	 * Visit each node in the TypeScript AST and extract interfaces
	 * @param {TypescriptNode} node
	 * @param {TypeChecker} typeChecker
	 * @param {Record<string, Record<string, string>>} definition
	 * @private
	 */
	private static visitNode(
		node: TypescriptNode,
		typeChecker: TypeChecker,
		definition: Record<string, Record<string, string | string[]>>
	): void {
		if (isEnumDeclaration(node)) {
			const name = node.name.getText();
			definition[name] = {
				enum: node.members.map((member) => {
					const initializer = member.initializer;
					if (initializer && isStringLiteral(initializer)) {
						return initializer.text;
					}
					return member.name.getText();
				}),
			};
		} else if (isClassDeclaration(node) || isInterfaceDeclaration(node)) {
			const symbol = node.name ? typeChecker.getSymbolAtLocation(node.name) : null;

			if (symbol) {
				const name = symbol.getName();
				definition[name] = definition[name] ?? {};

				// Handle inheritance
				if (node.heritageClauses) {
					for (const heritage of node.heritageClauses) {
						for (const type of heritage.types) {
							const baseTypeName = type.expression.getText();
							if (definition[baseTypeName]) {
								// Merge base interface properties
								definition[name] = {
									...definition[baseTypeName],
									...definition[name],
								};
							}
						}
					}
				}

				for (const member of node.members) {
					if ((isPropertySignature(member) || isPropertyDeclaration(member)) && member.type) {
						const propertyName = member.name.getText() + (member.questionToken ? '?' : '');
						definition[name][propertyName] = member.type.getText();
					}
				}
			}
		} else if (isTypeAliasDeclaration(node)) {
			const name = node.name.getText();
			definition[name] = definition[name] ?? {};

			if (isUnionTypeNode(node.type)) {
				definition[name] = {
					enum: node.type.types.map((t) =>
						isLiteralTypeNode(t) ? t.literal.getText().replace(/['"]/g, '') : t.getText()
					),
				};
			}
		}
		// Add handling for const declarations
		else if (isVariableStatement(node)) {
			const declaration = node.declarationList.declarations[0];

			if (declaration && isVariableDeclaration(declaration)) {
				const name = declaration.name.getText();

				if (name) {
					definition[name] = {
						enum: Object.values(typeChecker.getTypeAtLocation(declaration).getProperties()).map((prop) =>
							prop.getName()
						),
					};
				}
			}
		}

		forEachChild(node, (n) => TypescriptToOpenApiSpec.visitNode(n, typeChecker, definition));
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

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function registerLambdaHandler(target: any) {
	// Check if handler is already registered to avoid duplicates
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
