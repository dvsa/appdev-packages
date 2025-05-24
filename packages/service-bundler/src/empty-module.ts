// @ts-nocheck
const noop =
	(name) =>
	(...args) => {
		return (..._) => {}; // Safe decorator shape: () => () => {}
	};

export const OpenAPI = noop('OpenAPI');
export const LambdaAPI = noop('LambdaAPI');
export const registerLambdaHandler = (target) => {
	return target;
};
export default {};
