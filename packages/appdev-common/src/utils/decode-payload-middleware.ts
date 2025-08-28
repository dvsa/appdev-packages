import type { NextFunction, Request, Response } from "express";
import { HttpStatus } from "../api/http-status-codes";
import { DataCompression } from "./compression";

/**
 * Middleware to decode base64+gzip encoded request payloads and turn them into their JSON equivalent
 * @param {Request} request - Express request object
 * @param {Response} response - Express response object
 * @param {NextFunction} next - Next function to pass control to the next middleware
 * @constructor
 */
export const DecodeBase64GzipPayload = (
	request: Request,
	response: Response,
	next: NextFunction,
) => {
	const compressionHeaderValue = "base64+gzip";

	try {
		if (
			typeof request.body === "string" &&
			request.header("X-Payload-Encoding") === compressionHeaderValue
		) {
			request.body = DataCompression.decompress(request.body);
		}
	} catch (err) {
		return response.status(HttpStatus.BAD_REQUEST).send({
			error: "Bad request",
			message: err instanceof Error ? err.message : JSON.stringify(err),
		});
	}

	next();
};
