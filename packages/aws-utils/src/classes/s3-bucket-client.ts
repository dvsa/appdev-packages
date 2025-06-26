import {
	GetObjectCommand,
	type GetObjectCommandOutput,
	type GetObjectRequest,
	S3Client,
	type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import { captureAWSv3Client } from 'aws-xray-sdk';

export class S3Storage {
	private static readonly defaultConfig: Partial<S3ClientConfig> = {
		region: process.env.REGION || 'eu-west-1',
	};

	/**
	 * Get an S3 client
	 * @param {Partial<S3ClientConfig>} config - The S3 configuration object.
	 * @return {S3Client}
	 */
	static getClient(config: Partial<S3ClientConfig> = S3Storage.defaultConfig): S3Client {
		if (process.env.USE_CREDENTIALS === 'true') {
			config.credentials = fromIni();
		}

		const client = new S3Client(config);

		// If tracing is enabled, then capture the client with AWS X-Ray
		return process.env._X_AMZN_TRACE_ID ? captureAWSv3Client(client) : client;
	}

	/**
	 * Download method to retrieve an object from an AWS S3 bucket.
	 * - If process.env.USE_CREDENTIALS is true, credentials will be used from ~/.aws/credentials
	 * @param {GetObjectRequest} params - The parameters to send to the operation.
	 * @param {Partial<S3ClientConfig>} config - The S3 configuration object.
	 * @returns {Promise<GetObjectCommandOutput>}
	 */
	static async download(
		params: GetObjectRequest,
		config: Partial<S3ClientConfig> = S3Storage.defaultConfig
	): Promise<GetObjectCommandOutput> {
		return S3Storage.getClient(config).send(new GetObjectCommand(params));
	}
}
