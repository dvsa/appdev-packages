import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { NextFunction, Response } from "express";
import { HttpStatus } from "../api/http-status-codes";

interface ValidateRequestBodyOptions {
	isArray?: boolean;
	errorDetails?: boolean;
}

const ajv = new Ajv({ removeAdditional: true, allErrors: true });
addFormats(ajv);
ajv.addKeyword("tsEnumNames");

/**
 * Decorator tp validate an express request body against a specified schema
 * @param {object} schema - the json schema you wish to use as the validator
 * @param {ValidateRequestBodyOptions} opts
 * - isArray: whether the body is expected to be an array
 * - errorDetails: whether to return detailed error messages (Note: errors are logged regardless of this setting)
 */
export function ValidateRequestBody<T>(
	schema: object,
	opts: ValidateRequestBodyOptions = { isArray: false, errorDetails: false },
) {
	return (_target: T, _propertyKey: string, descriptor: PropertyDescriptor) => {
		const originalMethod = descriptor.value;

		descriptor.value = async function (
			body: T,
			res: Response,
			next: NextFunction,
		) {
			// just to be safe, check the bodies existence before attempting to validate it
			if (!body) {
				return res
					.status(HttpStatus.BAD_REQUEST)
					.json({ message: "No request body detected" });
			}

			const payload = Buffer.isBuffer(body)
				? JSON.parse(body.toString("utf-8"))
				: body;

			// Create the appropriate schema based on whether we're validating an array or a single object
			const schemaToValidate = opts?.isArray
				? { type: "array", items: schema }
				: schema;

			const validateFunction = ajv.compile(schemaToValidate);

			// validate the request body against the schema passed in
			const isValid = validateFunction(payload);

			// if an error exists, then return a 400 with details
			if (!isValid) {
				console.error(validateFunction.errors);

				const response = {
					message: "Validation error",
				};

				if (opts?.errorDetails) {
					Object.assign(response, { errors: validateFunction.errors });
				}

				return res.status(HttpStatus.BAD_REQUEST).json(response);
			}

			// proceed with attached method if schema is valid
			return originalMethod.apply(this, [body, res, next]);
		};
	};
}
