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
	private static readonly grant_type = "client_credentials";

	constructor(
		private readonly tokenUrl: string,
		private readonly clientId: string,
		private readonly clientSecret: string,
		private readonly scope: string,
		private readonly debugMode: boolean = false,
	) {}

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

	private async fetchClientCredentials(): Promise<ClientCredentialsResponse> {
		const response = await fetch(this.tokenUrl, {
			method: "POST",
			body: stringify({
				grant_type: ClientCredentials.grant_type,
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
