import { clearCaches } from '@aws-lambda-powertools/parameters';
import { Uint8ArrayBlobAdapter } from '@smithy/util-stream';

import {
	AppConfigDataClient,
	GetLatestConfigurationCommand,
	GetLatestConfigurationCommandOutput,
	StartConfigurationSessionCommand,
} from '@aws-sdk/client-appconfigdata';

import { mockClient } from 'aws-sdk-client-mock';
import { FeatureFlagsClientName } from '..';
import 'aws-sdk-client-mock-jest';
import { getFeatureFlags } from '../feature-flags';

describe('feature flag caching', () => {
	const initialFeatureFlags = {
		firstFlag: {
			enabled: true,
		},
		secondFlag: {
			enabled: false,
		},
	};

	const changedFeatureFlags = {
		firstFlag: {
			enabled: true,
		},
		secondFlag: {
			enabled: true,
		},
	};

	// biome-ignore lint/suspicious/noExplicitAny: any for tests
	const client = mockClient(AppConfigDataClient as any) as any;

	beforeEach(() => {
		const token = 'FAKE_TOKEN';
		const getLatestConfigurationCommandOutput = {
			ConfigurationToken: token,
			$metadata: {
				httpStatusCode: 200,
			},
		};

		jest.clearAllMocks();
		client.on(StartConfigurationSessionCommand).resolves({ InitialConfigurationToken: token });
		client
			.on(GetLatestConfigurationCommand)
			.resolvesOnce({
				...getLatestConfigurationCommandOutput,
				Configuration: Uint8ArrayBlobAdapter.fromString(JSON.stringify(initialFeatureFlags)),
			} as GetLatestConfigurationCommandOutput)
			.resolvesOnce({
				...getLatestConfigurationCommandOutput,
				Configuration: Uint8ArrayBlobAdapter.fromString(JSON.stringify(changedFeatureFlags)),
			});
	});

	it('should return cached feature flags from app config', async () => {
		const firstFlags = await getFeatureFlags(FeatureFlagsClientName.VTX);
		const secondFlags = await getFeatureFlags(FeatureFlagsClientName.VTX);
		const thirdFlags = await getFeatureFlags(FeatureFlagsClientName.VTX);

		// Any second call to the underlying client should return a cache value until it epires.
		// This proves we aren't hitting AWS every time we fetch the app config.

		expect(firstFlags).toEqual(initialFeatureFlags);
		expect(secondFlags).toEqual(initialFeatureFlags);
		expect(thirdFlags).toEqual(initialFeatureFlags);

		expect(client.commandCalls(StartConfigurationSessionCommand)).toHaveLength(1);
		expect(client.commandCalls(GetLatestConfigurationCommand)).toHaveLength(1);
	});

	it('should fetch feature flags from aws when the cache clears', async () => {
		const firstFlags = await getFeatureFlags(FeatureFlagsClientName.VTX);

		// Force the internal app config cache to clear.
		// This proves we are hitting AWS again when the cache has expired locally.
		clearCaches();

		const secondFlags = await getFeatureFlags(FeatureFlagsClientName.VTX);
		const thirdFlags = await getFeatureFlags(FeatureFlagsClientName.VTX);

		expect(firstFlags).toEqual(initialFeatureFlags);
		expect(secondFlags).toEqual(changedFeatureFlags);
		expect(thirdFlags).toEqual(changedFeatureFlags);

		expect(client.commandCalls(StartConfigurationSessionCommand)).toHaveLength(2);
		expect(client.commandCalls(GetLatestConfigurationCommand)).toHaveLength(2);
	});
});
