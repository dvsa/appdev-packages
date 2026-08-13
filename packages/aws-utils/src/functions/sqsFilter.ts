import { unmarshall } from '@aws-sdk/util-dynamodb';

// biome-ignore lint/suspicious/noExplicitAny: Not updating to use explicit types as unusre at this moment
export const processRecord = (recordBody: any, eventName = 'MODIFY') => {
	if (recordBody.eventName === eventName && recordBody.dynamodb && recordBody.dynamodb.NewImage) {
		return unmarshall(recordBody.dynamodb.NewImage);
	}
	// biome-ignore lint/suspicious/noConsole: intentional info logging
	console.warn(`process filtered to undefined, record is ${JSON.stringify(recordBody)}`);
	return undefined;
};
