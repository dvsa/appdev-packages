import { getAppConfig } from '@aws-lambda-powertools/parameters/appconfig';

jest.mock('@aws-lambda-powertools/parameters/appconfig', () => ({
	getAppConfig: jest.fn(),
}));

describe('app config configuration', () => {
	it('should return feature flags using the environment configuration', async () => {
		// config.ts reads process.env at module load; swc/jest hoists static imports
		// above top-level statements, so set env first then dynamically import.
		process.env.BRANCH = 'prod';
		process.env.FEATURE_FLAGS_APP_NAME = 'cvs';
		process.env.FEATURE_FLAGS_MAX_AGE = '10';

		const { FeatureFlagsClientName } = await import('../.');
		const { getFeatureFlags } = await import('../feature-flags');

		const expectedFlags = {
			firstFlag: {
				enabled: true,
			},
		};

		(getAppConfig as jest.Mock).mockReturnValue(expectedFlags);

		const flags = await getFeatureFlags(FeatureFlagsClientName.VTX);

		expect(flags).toEqual(expectedFlags);
		expect(getAppConfig).toHaveBeenCalledWith('vtx-profile', {
			environment: 'prod',
			application: 'cvs',
			maxAge: 10,
			transform: 'json',
			requestTimeout: 10000,
		});
	});
});
