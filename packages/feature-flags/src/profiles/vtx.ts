import merge from 'lodash.merge';
import { FeatureFlagsClientName } from '..';
import { getFeatureFlags } from '../feature-flags';

const defaultFeatureFlags = {
	welshTranslation: {
		enabled: true,
		translatePassTestResult: true,
		translateFailTestResult: true,
		translatePrsTestResult: true,
	},
	issueDocsCentrally: {
		enabled: true,
	},
	recallsApi: {
		enabled: true,
	},
	automatedCt: {
		enabled: false,
	},
	abandonedCerts: {
		enabled: true,
	},

	/**
	 * Feature flags for the CVS test facility domain
	 */
	testFacilityDB: {
		enabled: true,

		// Feature flags for the test facility read/write operations
		readAurora: false,
		writeAurora: false,
	},
};

export type FeatureFlags = typeof defaultFeatureFlags;

export const getProfile = async (): Promise<FeatureFlags> => {
	const flags = await getFeatureFlags<FeatureFlags>(FeatureFlagsClientName.VTX);
	return merge(defaultFeatureFlags, flags) as FeatureFlags;
};
