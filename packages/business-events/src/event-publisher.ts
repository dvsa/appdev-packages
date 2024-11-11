import { SNSClient, SNSClientConfig } from '@aws-sdk/client-sns';
import { fromIni } from '@aws-sdk/credential-providers';
import { captureAWSv3Client } from 'aws-xray-sdk';
import { BusinessEvent } from './business-event';
import { BusinessEventValidator } from './business-event-validator';

/**
 * Publishes business events for a software system.
 */
export class BusinessEventPublisher {
  private static readonly defaultConfig: Partial<SNSClientConfig> = {
    region: 'eu-west-1',
  };

  /**
   * Get an SNS client
   * - If process.env.USE_CREDENTIALS is true, credentials will be used from ~/.aws/credentials
   * @param {Partial<SNSClientConfig>} config - The SNS configuration object.
   * @returns {SNSClient}
   */
  static getClient(
    config: Partial<SNSClientConfig> = BusinessEventPublisher.defaultConfig
  ): SNSClient {
    if (process.env.USE_CREDENTIALS === 'true') {
      config.credentials = fromIni();
    }

    // If tracing is enabled, then capture the client with AWS X-Ray
    return process.env._X_AMZN_TRACE_ID
      ? captureAWSv3Client(new SNSClient(config))
      : new SNSClient(config);
  }

  /**
   * Publishes a business event to an SNS topic.
   * @param payload The event to publish.
   * @param config The SNS client configuration to use for publishing.
   */
  static async publish(
    payload: BusinessEvent,
    config: Partial<SNSClientConfig> = BusinessEventPublisher.defaultConfig
  ) {
    try {
      const validator = new BusinessEventValidator(payload);
      validator.validate();
      if (validator.error) {
        throw new Error(validator.message);
      }

      return this.getClient(config).send(payload.command);
    } catch (error) {
      console.error(error);
    }
  }
}
