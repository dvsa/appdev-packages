import type { Logger } from "@aws-lambda-powertools/logger";
import type { APIGatewayProxyResult } from "aws-lambda";
import type { Request, Response } from "express";
import { HttpStatus } from "../api/http-status-codes";
import { DataCompression } from "./compression";

/**
 * Interceptor to encode the response payload if requested by the client
 * @param {Request, Response} request, response - Express request & response object
 * @param {Partial<APIGatewayProxyResult>} content - API Gateway Proxy Result content
 * @param {Logger} logger - Logger instance
 * @constructor
 */
export const EncodePayloadInterceptor = (
	{ response, request }: { response: Response; request: Request },
	content: Partial<APIGatewayProxyResult>,
	logger: Logger,
) => {
	const compressionHeaderValue = "base64+gzip";

	for (const [header, value] of Object.entries(content?.headers || {})) {
		response.setHeader(header, value as string);
	}

	if (content.statusCode) {
		response.status(content.statusCode);
	}

	// if there's no-body, return the response
	if (!content.body) {
		return response;
	}

	const didRequestCompressed =
		request?.headers?.["x-accept-encoding"] === compressionHeaderValue;

	const shouldCompress =
		didRequestCompressed && content.statusCode === HttpStatus.OK;

	// Parse the body if it's a string
	const bodyData =
		typeof content.body === "string" ? JSON.parse(content.body) : content.body;

	if (shouldCompress) {
		logger.debug("Compressing response data");

		try {
			const compressedData = DataCompression.compress(bodyData);

			// Check if compressed data is actually smaller
			const originalSize = Buffer.byteLength(JSON.stringify(bodyData), "utf8");
			const compressedSize = Buffer.byteLength(
				JSON.stringify(compressedData),
				"utf8",
			);

			if (compressedSize >= originalSize) {
				logger.debug("Compression not beneficial, using original data");
				response.json(bodyData);
			} else {
				// Set the content encoding headers
				response.setHeader("Access-Control-Expose-Headers", "content-encoding");
				response.setHeader("content-encoding", compressionHeaderValue);

				response.json(compressedData);
			}
		} catch (err) {
			logger.error("Error compressing response data", { err });
			response.json(bodyData);
		}
	} else {
		response.json(bodyData);
	}

	return response;
};
