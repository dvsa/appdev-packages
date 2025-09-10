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

		expect(flags.welshTranslation.enabled).toBe(true);
		expect(flags.welshTranslation.translatePassTestResult).toBe(true);
		expect(flags.welshTranslation.translateFailTestResult).toBe(true);
		expect(flags.welshTranslation.translatePrsTestResult).toBe(true);
		expect(flags.issueDocsCentrally.enabled).toBe(true);
		expect(flags.recallsApi.enabled).toBe(true);
		expect(flags.automatedCt.enabled).toBe(false);
		expect(flags.abandonedCerts.enabled).toBe(true);
		expect(flags.specialistDefects.enabled).toBe(false);
		expect(flags.specialistDefects.adasImNumbers).toEqual([29]);
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
			recallsApi: {
				enabled: true,
			},
			automatedCt: {
				enabled: true,
			},
			abandonedCerts: {
				enabled: true,
			},
			specialistDefects: {
				enabled: true,
				adasImNumbers: [29, 99],
			},
		};

		getAppConfig.mockReturnValue(expectedFlags);

		const flags = await getProfile();

		expect(flags.welshTranslation.enabled).toBe(true);
		expect(flags.welshTranslation.translatePassTestResult).toBe(true);
		expect(flags.welshTranslation.translateFailTestResult).toBe(true);
		expect(flags.welshTranslation.translatePrsTestResult).toBe(true);
		expect(flags.issueDocsCentrally.enabled).toBe(false);
		expect(flags.recallsApi.enabled).toBe(true);
		expect(flags.automatedCt.enabled).toBe(true);
		expect(flags.abandonedCerts.enabled).toBe(true);
		expect(flags.specialistDefects.enabled).toBe(true);
		expect(flags.specialistDefects.adasImNumbers).toEqual([29, 99]);
	});
});
