import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ScanCommand, type ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDb } from '../dynamo-db-client';

// Mock the AWS SDK dependencies
jest.mock('@aws-sdk/client-dynamodb', () => ({
	...jest.requireActual('@aws-sdk/client-dynamodb'),
	DynamoDBClient: jest.fn(),
}));

jest.mock('@aws-sdk/credential-providers', () => ({
	...jest.requireActual('@aws-sdk/credential-providers'),
	fromEnv: jest.fn().mockReturnValue('envCredentials'),
	fromIni: jest.fn().mockReturnValue('iniCredentials'),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
	...jest.requireActual('@aws-sdk/lib-dynamodb'),
	DynamoDBDocumentClient: {
		from: jest.fn(() => jest.fn()),
	},
}));

jest.mock('aws-xray-sdk', () => ({
	captureAWSv3Client: jest.fn((client) => client),
}));

describe('DynamoDb', () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		originalEnv = process.env;
		process.env = { ...originalEnv }; // Copy the original process.env
	});

	afterEach(() => {
		process.env = originalEnv; // Restore the original process.env
		jest.clearAllMocks();
	});

	describe('getClient', () => {
		it('should use credentials from ini file when USE_CREDENTIALS is true', () => {
			process.env.USE_CREDENTIALS = 'true';
			DynamoDb.getClient({});
			expect(DynamoDBClient).toHaveBeenCalledWith(
				expect.objectContaining({
					credentials: 'iniCredentials',
				})
			);
		});

		it('should use credentials from environment when IS_OFFLINE is true', () => {
			process.env.IS_OFFLINE = 'true';
			process.env.DDB_OFFLINE_ENDPOINT = 'http://localhost:8000';
			DynamoDb.getClient({});
			expect(DynamoDBClient).toHaveBeenCalledWith(
				expect.objectContaining({
					credentials: 'envCredentials',
					endpoint: 'http://localhost:8000',
				})
			);
		});

		it('should use default client config when no environment variables are set and no config passed', () => {
			DynamoDb.getClient();
			expect(DynamoDBClient).toHaveBeenCalledWith({ region: 'eu-west-1' });
		});

		it('should use the config when provided', () => {
			DynamoDb.getClient({ region: 'some-region' });
			expect(DynamoDBClient).toHaveBeenCalledWith({ region: 'some-region' });
		});
	});

	describe('fullScan', () => {
		const tableName = 'testTable';
		const mockParams: Partial<ScanCommandInput> = {
			TableName: tableName,
		};
		let mockSend: jest.Mock;

		beforeEach(() => {
			mockSend = jest.fn();
			(DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
				send: mockSend,
			});
		});

		it('should scan all items in a single request', async () => {
			const items = [{ id: '1' }, { id: '2' }];
			mockSend.mockResolvedValueOnce({
				Items: items,
				LastEvaluatedKey: undefined, // Indicates that this is the last page of data
			});

			const result = await DynamoDb.fullScan(mockParams);

			expect(result).toEqual(items);
			expect(mockSend).toHaveBeenCalledWith(expect.any(ScanCommand));
			expect(mockSend).toHaveBeenCalledTimes(1);
		});

		it('should handle paginated results', async () => {
			const firstPageItems = [{ id: '1' }];
			const secondPageItems = [{ id: '2' }];

			mockSend
				.mockResolvedValueOnce({
					Items: firstPageItems,
					LastEvaluatedKey: { id: { S: '1' } },
				})
				.mockResolvedValueOnce({
					Items: secondPageItems,
					LastEvaluatedKey: undefined,
				});

			const result = await DynamoDb.fullScan(mockParams);

			expect(result).toEqual([...firstPageItems, ...secondPageItems]);
			expect(mockSend).toHaveBeenCalledTimes(2);
		});

		it('should throw an error when the scan fails', async () => {
			const error = new Error('Scan failed');
			mockSend.mockRejectedValueOnce(error);

			await expect(DynamoDb.fullScan(mockParams)).rejects.toThrow(error);
		});
	});
});
