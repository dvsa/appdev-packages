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

		// these flags control the /test-station/{+proxy}
		testStationReadDDB: true,
		testStationReadAurora: false,

		// the only write that occurs in "test stations" are via the put-test-station, therefore no need for distinct flags
		testStationWriteDDB: true,
		testStationWriteAurora: false,

		// these flags control the /activities/{+proxy}
		activityReadDDB: true,
		activityReadAurora: false,
		activityWriteDDB: true,
		activityWriteAurora: false,
	},
};

export type FeatureFlags = typeof defaultFeatureFlags;

export const getProfile = async (): Promise<FeatureFlags> => {
	const flags = await getFeatureFlags<FeatureFlags>(FeatureFlagsClientName.VTX);
	return merge(defaultFeatureFlags, flags) as FeatureFlags;
};
