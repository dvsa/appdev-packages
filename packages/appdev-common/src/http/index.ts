export class HTTPError extends Error {
	constructor(
		message: string,
		public response: Response,
	) {
		super(message);
		this.name = "HTTPError";
		this.response = response;
	}
}

// biome-ignore lint/complexity/noStaticOnlyClass: makes sense for an HTTP utility to encompass all methods
export class HTTP {
	static async get(url: string, options?: RequestInit): Promise<Response> {
		const response = await fetch(url, { method: "GET", ...options });

		if (!response.ok) {
			throw new HTTPError(
				`HTTP GET request failed with status ${response.status}`,
				response,
			);
		}

		return response;
	}

	static async post<T>(
		url: string,
		body: T,
		options?: RequestInit,
	): Promise<Response> {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...options?.headers },
			body: JSON.stringify(body),
			...options,
		});

		if (!response.ok) {
			throw new HTTPError(
				`HTTP POST request failed with status ${response.status}`,
				response,
			);
		}

		return response;
	}

	static async put<T>(
		url: string,
		body: T,
		options?: RequestInit,
	): Promise<Response> {
		const response = await fetch(url, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...options?.headers },
			body: JSON.stringify(body),
			...options,
		});

		if (!response.ok) {
			throw new HTTPError(
				`HTTP PUT request failed with status ${response.status}`,
				response,
			);
		}

		return response;
	}

	static async delete(url: string, options?: RequestInit): Promise<Response> {
		const response = await fetch(url, { method: "DELETE", ...options });

		if (!response.ok) {
			throw new HTTPError(
				`HTTP DELETE request failed with status ${response.status}`,
				response,
			);
		}

		return response;
	}
}
