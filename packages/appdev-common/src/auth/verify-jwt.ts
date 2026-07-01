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
	private static readonly DEFAULT_TENANT = "common";
	private static readonly MICROSOFT_LOGIN_BASE_URL =
		"https://login.microsoftonline.com";
	private static readonly jwksByTenant = new Map<
		string,
		ReturnType<typeof createRemoteJWKSet>
	>();

	/**
	 * Create a new instance of the JwtAuthoriser class
	 * @param clientIds - the client id(s) to validate the token against - can take a single string value or a comma-separated list in a string
	 * @param tenantId - the tenant id to validate the token against
	 */
	public constructor(
		clientIds: string | null = null,
		tenantId: string | null = null,
	) {
		this.clientIds = clientIds;
		this.tenantId = tenantId;
	}

	private static getTenantSegment(tenantId: string | null): string {
		return tenantId?.trim() || JwtAuthoriser.DEFAULT_TENANT;
	}

	private static getJwks(
		tenantId: string | null,
	): ReturnType<typeof createRemoteJWKSet> {
		const tenantSegment = JwtAuthoriser.getTenantSegment(tenantId);
		const cachedJwks = JwtAuthoriser.jwksByTenant.get(tenantSegment);

		if (cachedJwks) {
			return cachedJwks;
		}

		const jwks = createRemoteJWKSet(
			new URL(
				`${JwtAuthoriser.MICROSOFT_LOGIN_BASE_URL}/${tenantSegment}/discovery/keys`,
			),
		);

		JwtAuthoriser.jwksByTenant.set(tenantSegment, jwks);

		return jwks;
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

			const { payload } = await jwtVerify(
				token,
				JwtAuthoriser.getJwks(this.tenantId),
				opts,
			);

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
