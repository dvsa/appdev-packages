import type { APIGatewayEvent, Context } from 'aws-lambda';

export interface APIGatewayModel {
	event: APIGatewayEvent;
	context: Context;
}
