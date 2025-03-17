import type { ErrorObject } from "ajv";
import { HttpStatus } from "../api/http-status-codes";

type ValidationErrorDetails = Partial<ErrorObject[]> | string | null;

export class ValidationError extends Error {
	private readonly statusCode: number;
	private readonly details: ValidationErrorDetails;

	constructor(
		statusCode = HttpStatus.BAD_REQUEST,
		message = "Validation failed",
		details: ValidationErrorDetails = null,
	) {
		super(message);
		this.statusCode = statusCode;
		this.details = details;
		this.name = "ValidationError";

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ValidationError);
		}
	}

	public toJSON() {
		return {
			error: {
				name: this.name,
				message: this.message,
				details: this.unwrapErrorDetails(this.details),
				statusCode: this.statusCode,
			},
		};
	}

	private unwrapErrorDetails = (
		details: ValidationErrorDetails,
	): ValidationErrorDetails => {
		if (Array.isArray(details)) {
			return details.map((error) => {
				if (
					error &&
					typeof error === "object" &&
					"keyword" in error &&
					error.keyword === "enum"
				) {
					return `${error.instancePath.replace("/", "")} ${error.message}: ${error.params?.allowedValues.join(", ")}`;
				}
				return error?.message || error;
			}) as ValidationErrorDetails;
		}

		return details;
	};
}
