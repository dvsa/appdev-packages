import { HttpStatus } from '../api/http-status-codes';

type RoleInfo = { required: string[]; actual: string[] };

export class AuthError extends Error {
	private readonly statusCode: number;
	private readonly code: string;
	private readonly roleInfo?: RoleInfo;

	constructor(
		statusCode = HttpStatus.UNAUTHORIZED,
		message = 'Authorization failed',
		code = 'UNAUTHORIZED',
		roleInfo: RoleInfo | undefined = undefined
	) {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
		this.name = 'AuthError';
		this.roleInfo = roleInfo ?? undefined;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AuthError);
		}
	}

	public toJSON() {
		return {
			error: {
				name: this.name,
				code: this.code,
				message: this.message,
				statusCode: this.statusCode,
				roleInfo: this.roleInfo,
			},
		};
	}
}
