import {
	type JWTPayload,
	type JWTVerifyOptions,
	createRemoteJWKSet,
	jwtVerify,
} from "jose";
import { HttpStatus } from "../api/http-status-codes";
import { AuthError } from "./auth-errors";

export class JwtAuthoriser {
	private readonly clientIds: string | null;
	private readonly tenantId: string | null;
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
	 * @param clientIds - the client ids to validate the token against
	 * @param tenantId - the tenant id to validate the token against
	 */
	public constructor(
		clientIds: string | null = null,
		tenantId: string | null = null,
	) {
		this.clientIds = clientIds;
		this.tenantId = tenantId;
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

			// audience validation is handled automatically if present in token
			if (this.clientIds?.length) {
				opts.audience = this.clientIds
					.split(",")
					.map((id) => id.trim())
					.filter(Boolean);
			}

			// issuer validation is handled automatically if present in token
			if (this.tenantId) {
				opts.issuer = [
					`https://sts.windows.net/${this.tenantId}/`,
					`https://login.microsoftonline.com/${this.tenantId}/v2.0`,
				];
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
