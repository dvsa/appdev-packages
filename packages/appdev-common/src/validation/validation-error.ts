import { HttpStatus } from "../api/http-status-codes";

export class ValidationError extends Error {
	private readonly statusCode: number;
	private readonly details: unknown;

	constructor(
		statusCode = HttpStatus.BAD_REQUEST,
		message = "Validation failed",
		details: unknown | null = null,
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
				details: this.details,
				statusCode: this.statusCode,
			},
		};
	}
}
