import { LambdaClient, type LambdaClientConfig } from '@aws-sdk/client-lambda';
import { fromIni } from '@aws-sdk/credential-providers';
import { captureAWSv3Client } from 'aws-xray-sdk';

export class LambdaInvoke {
	private static readonly defaultConfig: Partial<LambdaClientConfig> = {
		region: 'eu-west-1',
	};

	/**
	 * Get a Lambda client
	 * @param {Partial<LambdaClientConfig>} config - The lambda configuration object.
	 * @return {LambdaClient}
	 */
	static getClient(config: Partial<LambdaClientConfig> = LambdaInvoke.defaultConfig): LambdaClient {
		if (process.env.USE_CREDENTIALS === 'true') {
			config.credentials = fromIni();
		}

		const client = new LambdaClient(config);

		// If tracing is enabled, then capture the client with AWS X-Ray
		return process.env._X_AMZN_TRACE_ID ? captureAWSv3Client(client) : client;
	}
}
