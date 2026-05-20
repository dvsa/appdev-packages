import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { HttpStatus } from "../api/http-status-codes";
import { ValidationError } from "./validation-error";

const ajv = new Ajv({ removeAdditional: true, allErrors: true });
addFormats(ajv);
ajv.addKeyword("tsEnumNames");

const validatorCache = new WeakMap<object, ValidateFunction>();

function getValidator(schema: object): ValidateFunction {
	let validator = validatorCache.get(schema);

	if (!validator) {
		validator = ajv.compile(schema);
		validatorCache.set(schema, validator);
	}

	return validator;
}

export function validateJsonSchema(schema: object, data: unknown): void {
	const validateFunction = getValidator(schema);

	if (!validateFunction(data)) {
		throw new ValidationError(
			HttpStatus.BAD_REQUEST,
			"Validation failed",
			[...(validateFunction.errors ?? [])], // copy before next call overwrites
		);
	}
}
