import {
	type JWTPayload,
	type JWTVerifyOptions,
	createRemoteJWKSet,
	jwtVerify,
} from "jose";
import { HttpStatus } from "../api/http-status-codes";
import { AuthError } from "./auth-errors";

export class JwtAuthoriser {
	private readonly clientId: string | null;
	private static readonly ENV = process.env.environment?.toUpperCase() ?? "";
	private static readonly tokenExpiryEnvExclusionList = [
		"DEVELOPMENT",
		"NON-PROD",
	];
	private static readonly JWKS_URI = new URL(
		"https://login.microsoftonline.com/common/discovery/keys",
	);
	private static JWKS = createRemoteJWKSet(JwtAuthoriser.JWKS_URI);

	/**
	 * Create a new instance of the JwtAuthoriser class
	 * @param clientId - the client id to validate the token against
	 */
	public constructor(clientId: string | null = null) {
		this.clientId = clientId;
	}

	/**
	 * Validate a JWT and return the decoded payload
	 * @param {string} token - the JWT token to validate
	 * @returns {Promise<JWTPayload>}
	 */
	public async verify(token: string): Promise<JWTPayload> {
		try {
			const opts: JWTVerifyOptions = {
				clockTolerance: 10,
				algorithms: ["RS256"],
			};

			// issuer validation is handled automatically if present in token
			if (this.clientId) {
				opts.audience = this.clientId;
			}

			if (
				JwtAuthoriser.tokenExpiryEnvExclusionList.includes(JwtAuthoriser.ENV)
			) {
				opts.maxTokenAge = Number.POSITIVE_INFINITY;
			}

			const { payload } = await jwtVerify(token, JwtAuthoriser.JWKS, opts);

			return payload;
		} catch (err) {
			const error = err as { code?: string };

			const code = "code" in error ? error.code : "";

			throw new AuthError(
				HttpStatus.UNAUTHORIZED,
				(err as Error).message,
				code,
			);
		}
	}
}
