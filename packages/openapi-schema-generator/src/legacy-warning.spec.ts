import { LambdaAPI, registerLambdaHandler, TypescriptToOpenApiSpec } from './index';

jest.mock('node:fs/promises', () => ({
	__esModule: true,
	default: { access: jest.fn().mockRejectedValue(new Error('No functions directory')) },
}));

test('warns once for each legacy API with an actionable replacement', async () => {
	const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
	const log = jest.spyOn(console, 'log').mockImplementation(() => {});
	try {
		for (let i = 0; i < 2; i += 1) {
			LambdaAPI({ path: '/example', method: 'GET', responses: {} });
			registerLambdaHandler(class Example {});
			await TypescriptToOpenApiSpec.generate(
				{ openapi: '3.0.0', info: { title: 'Test', version: '1' }, paths: {} },
				[]
			);
		}
		expect(warn).toHaveBeenCalledTimes(3);
		for (const api of ['TypescriptToOpenApiSpec.generate', 'LambdaAPI', 'registerLambdaHandler']) {
			expect(warn).toHaveBeenCalledWith(expect.stringContaining(`Legacy API ${api}`));
		}
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('@dvsa/openapi-schema-generator/inversify'));
	} finally {
		warn.mockRestore();
		log.mockRestore();
	}
});
