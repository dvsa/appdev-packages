// @ts-nocheck
const noop =
	(name) =>
	(...args) => {
		console.warn(`[noop] ${name}() called from dummy module`, args);
		return (..._) => {}; // Safe decorator shape: () => () => {}
	};

export const OpenAPI = noop('OpenAPI');
export const LambdaAPI = noop('LambdaAPI');
export const registerLambdaHandler = (target) => {
	console.warn('[noop] registerLambdaHandler() called from dummy module');
	return target;
};
export default {};
