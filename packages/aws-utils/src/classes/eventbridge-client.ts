import { EventBridgeClient, type EventBridgeClientConfig } from '@aws-sdk/client-eventbridge';

import { fromIni } from '@aws-sdk/credential-providers';
import { captureAWSv3Client } from 'aws-xray-sdk';

export class Eventbridge {
	private static readonly defaultConfig: Partial<EventBridgeClientConfig> = {
		region: process.env.REGION || 'eu-west-1',
	};

	static getClient(config: Partial<EventBridgeClientConfig> = Eventbridge.defaultConfig) {
		if (process.env.USE_CREDENTIALS === 'true') {
			config.credentials = fromIni();
		}

		const client = new EventBridgeClient(config);

		// If tracing is enabled, then capture the client with AWS X-Ray
		return process.env._X_AMZN_TRACE_ID ? captureAWSv3Client(client) : client;
	}
}
