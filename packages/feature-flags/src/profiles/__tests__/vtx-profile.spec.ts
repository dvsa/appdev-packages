const getAppConfig = jest.fn();

jest.mock('@aws-lambda-powertools/parameters/appconfig', () => ({
	getAppConfig,
}));

import { getProfile } from '../vtx';

describe('app config configuration', () => {
	it('should use default flags', async () => {
		const expectedFlags = {};

		getAppConfig.mockReturnValue(expectedFlags);

		const flags = await getProfile();

		expect(flags.welshTranslation.enabled).toBe(false);
		expect(flags.welshTranslation.translatePassTestResult).toBe(false);
		expect(flags.issueDocsCentrally.enabled).toBe(true);
	});

	it('should override some flags with a partial response', async () => {
		const expectedFlags = {
			welshTranslation: {
				enabled: true,
				translatePassTestResult: true,
			},
			issueDocsCentrally: {
				enabled: false,
			},
		};

		getAppConfig.mockReturnValue(expectedFlags);

		const flags = await getProfile();

		expect(flags.welshTranslation.enabled).toBe(true);
		expect(flags.welshTranslation.translatePassTestResult).toBe(true);
		expect(flags.welshTranslation.translateFailTestResult).toBe(false);
		expect(flags.issueDocsCentrally.enabled).toBe(false);
	});
});
