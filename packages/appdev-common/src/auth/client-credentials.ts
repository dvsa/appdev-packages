import { stringify } from "node:querystring";
import { decodeJwt } from "jose";

export interface ClientCredentialsResponse {
	token_type: string;
	expires_in: number;
	ext_expires_in: number;
	access_token: string;
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
	 * @param debugMode - Whether to log debug messages
	 */
	constructor(
		private readonly tokenUrl: string,
		private readonly clientId: string,
		private readonly clientSecret: string,
		private readonly scope: string,
		private readonly debugMode: boolean = false,
	) {}

	/**
	 * Helper method to perform the client credentials flow and return the access token
	 * This method will check for the existence of the token and if it is expired, it will fetch a new one
	 * @returns {Promise<string>} - The access token
	 */
	public async getAccessToken(): Promise<string> {
		if (!ClientCredentials.accessToken || this.isAccessTokenExpired()) {
			const { access_token } = await this.fetchClientCredentials();

			if (this.debugMode)
				console.log("[DEBUG] New access token fetched:", access_token);

			ClientCredentials.accessToken = access_token;
		} else if (this.debugMode) {
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
			body: stringify({
				grant_type: ClientCredentials.grantType,
				client_id: this.clientId,
				client_secret: this.clientSecret,
				scope: this.scope,
			}),
		});

		if (!response.ok) {
			console.error("Error fetching client credentials", response);
			throw new Error("Failed to fetch client credentials");
		}

		return (await response.json()) as Promise<ClientCredentialsResponse>;
	}

	/**
	 * Check if the access token is expired
	 * @returns {boolean} - Whether the access token is expired
	 * @private
	 */
	private isAccessTokenExpired(): boolean {
		try {
			const decodedAccessToken = decodeJwt(ClientCredentials.accessToken);

			const currentTime = new Date().getTime() / 1000;

			// Check if exp exists before comparing as it can be undefined
			if (!decodedAccessToken?.exp) {
				return true;
			}
			return currentTime > decodedAccessToken.exp;
		} catch (err) {
			console.error("Error decoding access token:", err);
			return true;
		}
	}
}
