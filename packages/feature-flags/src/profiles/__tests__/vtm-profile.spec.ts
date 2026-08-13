jest.mock('@aws-lambda-powertools/parameters/appconfig', () => ({
	getAppConfig: jest.fn(),
}));

// import { getProfile } from '../vtm';

describe('app config configuration', () => {
	it('should use default flags', async () => {
		// const expectedFlags = {
		// };
		// getAppConfig.mockReturnValue(expectedFlags);
		// const flags = await getProfile();
		// expect(flags.<name>.enabled).toBe(false);
		// expect(flags.<name>.translatePassTestResult).toBe(false);
	});

	it('should override some flags with a partial response', async () => {
		// const expectedFlags = {
		//   welshTranslation: {
		//     enabled: true,
		//     translatePassTestResult: true,
		//   },
		// };
		// getAppConfig.mockReturnValue(expectedFlags);
		// const flags = await getProfile();
		// expect(flags.<name>.enabled).toBe(true);
		// expect(flags.<name>.translatePassTestResult).toBe(true);
		// expect(flags.<name>.translateFailTestResult).toBe(false);
	});
});
