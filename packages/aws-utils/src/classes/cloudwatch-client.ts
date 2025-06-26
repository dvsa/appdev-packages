import {
	CloudWatchLogsClient,
	type CloudWatchLogsClientConfig,
	StartQueryCommand,
	type StartQueryRequest,
} from '@aws-sdk/client-cloudwatch-logs';
import { fromIni } from '@aws-sdk/credential-providers';
import { captureAWSv3Client } from 'aws-xray-sdk';

export class CloudWatchClient {
	private static readonly defaultConfig: Partial<CloudWatchLogsClientConfig> = {
		region: process.env.REGION || 'eu-west-1',
	};

	static getClient(config: Partial<CloudWatchLogsClientConfig> = CloudWatchClient.defaultConfig) {
		if (process.env.USE_CREDENTIALS === 'true') {
			config.credentials = fromIni();
		}

		const client = new CloudWatchLogsClient(config);

		// If tracing is enabled, then capture the client with AWS X-Ray
		return process.env._X_AMZN_TRACE_ID ? captureAWSv3Client(client) : client;
	}

	static startQuery(
		params: StartQueryRequest,
		config: Partial<CloudWatchLogsClientConfig> = CloudWatchClient.defaultConfig
	) {
		return CloudWatchClient.getClient(config).send(new StartQueryCommand(params));
	}
}
