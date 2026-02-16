import { GetWebIdentityTokenCommand, STSClient } from "@aws-sdk/client-sts";
import { type JWTPayload, decodeJwt } from "jose";

export interface AzureTokenResponse {
	token_type: string;
	expires_in: number;
	ext_expires_in?: number;
	access_token: string;
}

interface Options {
	/**
	 *
	 * Whether to log debug messages & tokens during the token retrieval process.
	 * Useful for troubleshooting and understanding the flow of operations.
	 *
	 * Use with Caution, this could leak secrets!
	 */
	debugMode?: boolean;
	/**
	 * Whether to skip any token caching and force fresh retrievals
	 *
	 */
	forceFreshAuth?: boolean;
	/**
	 * Treat token as expired if it has less than this many seconds remaining.
	 * Helps avoid clock skew / in-flight expiry. (Default 30 secs)
	 */
	expirySkewSeconds?: number;
}

export class AwsOIDCAzureTokenClient {
	private static accessToken: string;
	private static readonly stsClient = new STSClient();

	/**
	 * Create a new instance of the AwsToAzureFederatedCredentials class
	 * @param tenantId - The Azure AD tenant ID
	 * @param clientId - The Azure AD application (client) ID
	 * @param tokenDurationSeconds - Duration for the AWS token (default: 300)
	 * @param options - Credentials options
	 */
	constructor(
		private readonly tenantId: string,
		private readonly clientId: string,
		private readonly tokenDurationSeconds: number = 300,
		private readonly options: Options = {
			debugMode: false,
			forceFreshAuth: false,
			expirySkewSeconds: 30,
		},
	) {}

	/**
	 * Returns an Azure AD access token for the configured application.
	 *
	 * Uses an in-memory cached token when it’s still valid; otherwise it obtains a fresh token
	 * by exchanging an AWS OIDC web identity JWT against the Azure v2 token endpoint.
	 *
	 * @returns {Promise<string>} - The Azure access token
	 */
	public async getAccessToken(): Promise<string> {
		if (
			this.options?.forceFreshAuth ||
			!AwsOIDCAzureTokenClient.accessToken ||
			AwsOIDCAzureTokenClient.isAccessTokenExpired(
				this.options.expirySkewSeconds ?? 30,
			)
		) {
			const { access_token } = await this.fetchFederatedCredentials();

			if (this.options?.debugMode) {
				console.log("[DEBUG] New Azure access token fetched:", access_token);
			}

			AwsOIDCAzureTokenClient.accessToken = access_token;
		} else if (this.options?.debugMode) {
			console.log(
				"[DEBUG] Using existing Azure access token:",
				AwsOIDCAzureTokenClient.accessToken,
			);
		}

		return AwsOIDCAzureTokenClient.accessToken;
	}

	/**
	 * Fetch the AWS JWT and exchange it for an Azure token
	 * @returns {Promise<AzureTokenResponse>} - The Azure token response
	 * @internal
	 */
	private async fetchFederatedCredentials(): Promise<AzureTokenResponse> {
		const stsResponse = await AwsOIDCAzureTokenClient.stsClient.send(
			new GetWebIdentityTokenCommand({
				Audience: [this.clientId],
				SigningAlgorithm: "RS256",
				DurationSeconds: this.tokenDurationSeconds,
			}),
		);

		const awsJwt = stsResponse?.WebIdentityToken;

		if (!awsJwt) {
			throw new Error("STS did not return a WebIdentityToken");
		}

		if (this.options?.debugMode) {
			console.log("[DEBUG] AWS JWT obtained", awsJwt);
		}

		const searchParams = new URLSearchParams({
			grant_type: "client_credentials",
			client_id: this.clientId,
			client_assertion_type:
				"urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
			client_assertion: awsJwt,
			scope: `api://${this.clientId}/.default`,
		});

		const response = await fetch(
			`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: searchParams.toString(),
			},
		);

		if (!response.ok) {
			throw new Error(
				`Azure token endpoint error: HTTP ${response.status} - ${await response.text()}`,
			);
		}

		return await response.json();
	}

	/**
	 * Check if the access token is expired
	 * @returns {boolean} - Whether the access token is expired
	 * @internal
	 */
	private static isAccessTokenExpired(skewSeconds: number): boolean {
		let decodedAccessToken: JWTPayload;

		try {
			decodedAccessToken = decodeJwt(AwsOIDCAzureTokenClient.accessToken);
		} catch (err) {
			console.error("Error decoding access token:", err);
			return true;
		}

		const currentTime = Math.floor(Date.now() / 1000);

		const exp = decodedAccessToken?.exp;
		if (!exp) return true;

		// treat as expired if we're within the skew window
		return currentTime >= exp - skewSeconds;
	}
}
