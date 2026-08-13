import { getAppConfig } from '@aws-lambda-powertools/parameters/appconfig';

jest.mock('@aws-lambda-powertools/parameters/appconfig', () => ({
	getAppConfig: jest.fn(),
}));

import { getProfile } from '../vta';

describe('app config configuration', () => {
	beforeEach(() => {
		getAppConfig.mockReset();
	});

	it('should use default flags', async () => {
		const expectedFlags = {};

		getAppConfig.mockReturnValueOnce(expectedFlags);

		const flags = await getProfile();

		expect(flags.iva.enabled).toBe(false);
		expect(flags.adr.enabled).toBe(false);
	});

	it('should override some flags with a partial response', async () => {
		const expectedFlags = {
			iva: {
				enabled: true,
			},
		};

		getAppConfig.mockReturnValueOnce(expectedFlags);

		const flags = await getProfile();

		expect(flags.iva.enabled).toBe(true);
		expect(flags.adr.enabled).toBe(false);
	});
});
