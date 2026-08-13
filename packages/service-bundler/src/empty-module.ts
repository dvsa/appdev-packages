// biome-ignore-all lint/suspicious/noConsole: intentional logging

/**
 * This file is an empty module that provides a no-operation (noop) function.
 *
 * The methods contained within the file have no relevance in a bundled context, meaning they're not relevant
 * when running on lambda e.g. code to generate OpenAPI documentation.
 *
 * This setup has therefore been implemented to replace calls to these methods with a noop functions, ensuring we're
 * bundling only the necessary code for the lambda function.
 *
 * When bundled, these methods will have minimal impact on the final bundle size and will not throw errors.
 *
 * @param _name
 */

// @ts-nocheck
const noop =
	(_name) =>
	(..._args) => {
		return (..._) => {}; // Safe decorator shape: () => () => {}
	};

export const OpenAPI = noop('OpenAPI');
export const LambdaAPI = noop('LambdaAPI');
export const registerLambdaHandler = (target) => {
	return target;
};
export default {};
