import { stringify } from "node:querystring";
import { type JWTPayload, decodeJwt } from "jose";

export interface ClientCredentialsResponse {
	token_type: string;
	expires_in: number;
	ext_expires_in: number;
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

export class ClientCredentials {
	private static accessToken: string;
	private static readonly grantType = "client_credentials";

	/**
	 * Create a new instance of the ClientCredentials class
	 * @param tokenUrl - The URL to fetch the access token from
	 * @param clientId - The client id
	 * @param clientSecret - The client secret
	 * @param scope - The scope of the access token
	 * @param resource
	 * @param options
	 */
	constructor(
		private readonly tokenUrl: string,
		private readonly clientId: string,
		private readonly clientSecret: string,
		private readonly scope: string | undefined,
		private readonly resource: string | undefined,
		private readonly options: Options = {
			debugMode: false,
			forceFreshAuth: false,
			expirySkewSeconds: 30,
		},
	) {}

	/**
	 * Helper method to perform the client credentials flow and return the access token
	 * This method will check for the existence of the token and if it is expired, it will fetch a new one
	 * @returns {Promise<string>} - The access token
	 */
	public async getAccessToken(): Promise<string> {
		if (
			this.options?.forceFreshAuth ||
			!ClientCredentials.accessToken ||
			ClientCredentials.isAccessTokenExpired(
				this.options.expirySkewSeconds ?? 30,
			)
		) {
			const { access_token } = await this.fetchClientCredentials();

			if (this.options?.debugMode)
				console.log("[DEBUG] New access token fetched:", access_token);

			ClientCredentials.accessToken = access_token;
		} else if (this.options?.debugMode) {
			console.log(
				"[DEBUG] Using existing access token:",
				ClientCredentials.accessToken,
			);
		}
		return ClientCredentials.accessToken;
	}

	/**
	 * Fetch the client credentials from the token URL
	 * @returns {Promise<ClientCredentialsResponse>} - The response from the token URL
	 * @private
	 */
	private async fetchClientCredentials(): Promise<ClientCredentialsResponse> {
		const response = await fetch(this.tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: this.resource
				? stringify({
						grant_type: ClientCredentials.grantType,
						client_id: this.clientId,
						client_secret: this.clientSecret,
						scope: this.scope,
						resource: this.resource,
					})
				: stringify({
						grant_type: ClientCredentials.grantType,
						client_id: this.clientId,
						client_secret: this.clientSecret,
						scope: this.scope,
					}),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error(
				"Error fetching client credentials",
				response.status,
				errorBody,
			);
			throw new Error("Failed to fetch client credentials");
		}

		return (await response.json()) as Promise<ClientCredentialsResponse>;
	}

	/**
	 * Check if the access token is expired
	 * @returns {boolean} - Whether the access token is expired
	 * @private
	 */
	private static isAccessTokenExpired(skewSeconds: number): boolean {
		let decodedAccessToken: JWTPayload;

		try {
			decodedAccessToken = decodeJwt(ClientCredentials.accessToken);
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
