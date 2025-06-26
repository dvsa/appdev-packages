import { SESClient, type SESClientConfig, SendEmailCommand, type SendEmailCommandOutput } from '@aws-sdk/client-ses';
import { fromIni } from '@aws-sdk/credential-providers';
import { captureAWSv3Client } from 'aws-xray-sdk';

export interface SendPayload {
	to: string[];
	from: string;
	subject: string;
	htmlBody: string;
	textBody: string;
	/**
	 * Carbon Copy
	 */
	cc?: string[];
	/**
	 * Blind carbon Copy
	 */
	bcc?: string[];
}

export class SimpleEmailService {
	private static readonly defaultConfig: Partial<SESClientConfig> = {
		region: process.env.REGION || 'eu-west-1',
	};

	/**
	 * Get an SES client
	 * - If process.env.USE_CREDENTIALS is true, credentials will be used from ~/.aws/credentials
	 * @param {Partial<SESClientConfig>} config - The SES configuration object.
	 * @returns {SESClient}
	 */
	static getClient(config: Partial<SESClientConfig> = SimpleEmailService.defaultConfig): SESClient {
		if (process.env.USE_CREDENTIALS === 'true') {
			config.credentials = fromIni();
		}

		const client = new SESClient(config);

		// If tracing is enabled, then capture the client with AWS X-Ray
		return process.env._X_AMZN_TRACE_ID ? captureAWSv3Client(client) : client;
	}

	/**
	 * Send an email using AWS SES using a pre-defined template
	 * @param {SendPayload} payload - The parameters to send to the operation.
	 * @param {Partial<SESClientConfig>} config - The SES configuration object.
	 * @returns {Promise<SendEmailCommandOutput>}
	 */
	static async send(
		payload: SendPayload,
		config: Partial<SESClientConfig> = SimpleEmailService.defaultConfig
	): Promise<SendEmailCommandOutput> {
		return SimpleEmailService.getClient(config).send(
			new SendEmailCommand({
				Source: payload.from,
				Destination: {
					ToAddresses: payload.to,
					BccAddresses: payload.bcc || [],
					CcAddresses: payload.cc || [],
				},
				Message: {
					Subject: {
						Charset: 'UTF-8',
						Data: payload.subject,
					},
					Body: {
						Html: {
							Charset: 'UTF-8',
							Data: `<h1>${payload.htmlBody}</h1>`,
						},
						Text: {
							Charset: 'UTF-8',
							Data: payload.textBody,
						},
					},
				},
			})
		);
	}
}
