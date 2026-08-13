import { getAppConfig } from '@aws-lambda-powertools/parameters/appconfig';

jest.mock('@aws-lambda-powertools/parameters/appconfig', () => ({
	getAppConfig: jest.fn(),
}));

import { FeatureFlagsClientName } from '../.';
import { defaultFeatureFlagConfig } from '../config';
import { getFeatureFlags } from '../feature-flags';

type FeatureFlags = {
	firstFlag: {
		enabled: boolean;
	};
};

describe('app config configuration', () => {
	it('should return feature flags using the default configuration', async () => {
		const expectedFlags = {
			firstFlag: {
				enabled: true,
			},
		};
		const expectedProfile = 'vtx-profile';

		getAppConfig.mockReturnValue(expectedFlags);

		const flags = await getFeatureFlags<FeatureFlags>(FeatureFlagsClientName.VTX);

		expect(flags).toEqual(expectedFlags);
		expect(getAppConfig).toHaveBeenCalledWith(expectedProfile, {
			...defaultFeatureFlagConfig,
			transform: 'json',
		});
	});
});
