import { type AttributeValue, DynamoDBClient, type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { fromEnv, fromIni } from '@aws-sdk/credential-providers';
import {
	DynamoDBDocumentClient,
	QueryCommand,
	type QueryCommandInput,
	ScanCommand,
	type ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { captureAWSv3Client } from 'aws-xray-sdk';

export class DynamoDb {
	private static readonly defaultConfig: Partial<DynamoDBClientConfig> = {
		region: process.env.REGION || 'eu-west-1',
	};

	/**
	 * Get a DynamoDB client
	 * - If `process.env.USE_CREDENTIALS` is `true`, credentials will be read from `~/.aws/credentials`
	 * - If `process.env.IS_OFFLINE` is `true`, credentials will be used from .env / serverless.yml file
	 * - If `process.env.IS_OFFLINE` is `true`, ensure the `DDB_OFFLINE_ENDPOINT` env var is set to the local DynamoDB endpoint
	 * @param {Partial<DynamoDBClientConfig>} clientConfig
	 * @returns {DynamoDBClient}
	 */
	static getClient(clientConfig: Partial<DynamoDBClientConfig> = DynamoDb.defaultConfig): DynamoDBDocumentClient {
		if (process.env.USE_CREDENTIALS === 'true') {
			clientConfig.credentials = fromIni();

			// If using `serverless-offline`
		} else if (process.env.IS_OFFLINE === 'true') {
			clientConfig.credentials = fromEnv();
			clientConfig.endpoint = process.env.DDB_OFFLINE_ENDPOINT;
		}

		const client = new DynamoDBClient(clientConfig);

		// If tracing is enabled, then capture the client with AWS X-Ray
		const dynamoDBClient = process.env._X_AMZN_TRACE_ID ? captureAWSv3Client(client) : client;

		return DynamoDBDocumentClient.from(dynamoDBClient);
	}

	/**
	 * Perform a full scan of a DynamoDB table
	 * @template T
	 * @param {ScanCommandInput} scanParams - TableName and ExclusiveStartKey are defined so any additional parameters can be passed here
	 * @param {Partial<DynamoDBClientConfig>} clientConfig - Defaults to the `eu-west-1` region
	 * @return {Promise<T[]>}
	 */
	static async fullScan<T>(
		scanParams: Partial<ScanCommandInput> = {},
		clientConfig: Partial<DynamoDBClientConfig> = DynamoDb.defaultConfig
	): Promise<T[]> {
		// @TODO: This should be able to be simplified by using recursiveFetch
		// e.g. return DynamoDb.recursiveFetch(ScanCommand, scanParams, clientConfig);

		const rows: T[] = [];

		let lastEvaluatedKey: Record<string, AttributeValue> | undefined = undefined;

		const client = DynamoDb.getClient(clientConfig);

		const params = {
			ExclusiveStartKey: lastEvaluatedKey,
			...scanParams,
		} as ScanCommandInput;

		do {
			const data = await client.send(new ScanCommand(params));

			if (data.Items) rows.push(...(data.Items as T[]));

			lastEvaluatedKey = data.LastEvaluatedKey;
			params.ExclusiveStartKey = data.LastEvaluatedKey;
		} while (lastEvaluatedKey);

		return rows;
	}

	/**
	 * Perform a recursive fetch of a DynamoDB table using either the Query or Scan command
	 * @template T
	 * @param {typeof QueryCommand | typeof ScanCommand} command - The command to use for fetching data
	 * @param {Partial<QueryCommandInput | ScanCommandInput>} inputParams - The parameters to send to the operation
	 * @param {Partial<DynamoDBClientConfig>} clientConfig - Defaults to the `eu-west-1` region
	 * @return {Promise<T[]>}
	 */
	static async recursiveFetch<T>(
		command: typeof QueryCommand | typeof ScanCommand,
		inputParams: Partial<QueryCommandInput | ScanCommandInput>,
		clientConfig: Partial<DynamoDBClientConfig> = DynamoDb.defaultConfig
	): Promise<T[]> {
		const rows: T[] = [];

		let lastEvaluatedKey: Record<string, AttributeValue> | undefined = undefined;

		const client = DynamoDb.getClient(clientConfig);

		const params = {
			ExclusiveStartKey: lastEvaluatedKey,
			...inputParams,
		} as QueryCommandInput | ScanCommandInput;

		do {
			const data = await client.send(new command(params));

			if (data.Items) rows.push(...(data.Items as T[]));

			lastEvaluatedKey = data.LastEvaluatedKey;
			params.ExclusiveStartKey = data.LastEvaluatedKey;
		} while (lastEvaluatedKey);

		return rows;
	}
}
