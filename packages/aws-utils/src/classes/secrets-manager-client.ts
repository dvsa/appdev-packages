import {
	GetSecretValueCommand,
	type GetSecretValueCommandInput,
	SecretsManagerClient,
	type SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';
import { fromIni } from '@aws-sdk/credential-providers';
import { captureAWSv3Client } from 'aws-xray-sdk';
import { load as loadYaml } from 'js-yaml';

export class SecretsManager {
	private static readonly defaultConfig: Partial<SecretsManagerClientConfig> = {
		region: process.env.REGION || 'eu-west-1',
	};

	/**
	 * Get a Secrets Manager client
	 * @param {Partial<SecretsManagerClientConfig>} config - The Secrets Manager configuration object.
	 * @returns {SecretsManagerClient}
	 */
	static getClient(config: Partial<SecretsManagerClientConfig> = SecretsManager.defaultConfig): SecretsManagerClient {
		if (process.env.USE_CREDENTIALS === 'true') {
			config.credentials = fromIni();
		}

		const client = new SecretsManagerClient(config);

		// If tracing is enabled, then capture the client with AWS X-Ray
		return process.env._X_AMZN_TRACE_ID ? captureAWSv3Client(client) : client;
	}

	/**
	 * Get a JSON parsed SecretString from AWS Secrets Manager
	 * - If process.env.USE_CREDENTIALS is true, credentials will be used from ~/.aws/credentials
	 * @param {GetSecretValueCommandInput} params - The parameters to send to the operation.
	 * @param {Partial<SecretsManagerClientConfig>} config - The Secrets Manager configuration object.
	 * @returns {Promise<T>}
	 */
	static async get<T>(
		params: GetSecretValueCommandInput,
		config: Partial<SecretsManagerClientConfig> = SecretsManager.defaultConfig,
		parseOptions: { fromYaml: boolean } = { fromYaml: false }
	): Promise<T> {
		const secretValue = await SecretsManager.getClient(config).send(new GetSecretValueCommand(params));

		let secret: T;

		if (parseOptions.fromYaml) {
			secret = loadYaml(secretValue.SecretString || '') as T;
		} else {
			secret = JSON.parse(secretValue.SecretString || '');
		}

		if (!secret || Object.keys(secret).length === 0) {
			throw new Error(`Secret string '${params.SecretId}' was empty.`);
		}

		return Promise.resolve(secret as T);
	}
}
