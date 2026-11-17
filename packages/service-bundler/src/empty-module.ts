/**
 * No-op replacement for packages that are only relevant at build/docs time
 * (OpenAPI generators). When rspack aliases these packages to this
 * module the lambda bundle stays lean and the decorator call sites remain
 * safely no-op at runtime.
 */

const noop =
	(_name: string) =>
	(..._args: unknown[]) => {
		return (..._: unknown[]) => {};
	};

// Legacy exports (kept for downstream compatibility)
export const OpenAPI = noop('OpenAPI');
export const LambdaAPI = noop('LambdaAPI');
export const registerLambdaHandler = (target: unknown) => target;

// @inversifyjs/http-open-api decorators
export const OasDeprecated = noop('OasDeprecated');
export const OasDescription = noop('OasDescription');
export const OasExternalDocs = noop('OasExternalDocs');
export const OasOperationId = noop('OasOperationId');
export const OasParameter = noop('OasParameter');
export const OasRequestBody = noop('OasRequestBody');
export const OasResponse = noop('OasResponse');
export const OasSchema = noop('OasSchema');
export const OasSchemaProperty = noop('OasSchemaProperty');
export const OasSchemaOptionalProperty = noop('OasSchemaOptionalProperty');
export const OasSecurity = noop('OasSecurity');
export const OasServer = noop('OasServer');
export const OasSummary = noop('OasSummary');
export const OasTag = noop('OasTag');
export const SwaggerUiProvider = class {};
export const BaseSwaggerUiController = class {};

export default {};
