type HTTPResponse = {
	url: string;
	status: number;
	statusText: string;
	headers: Record<string, string>;
	redirected: boolean;
	type: "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect";
	body?: unknown;
};

export class HTTPError extends Error {
	constructor(
		message: string,
		public response: HTTPResponse,
	) {
		super(message);
		this.name = "HTTPError";
		this.response = response;
	}
}

// biome-ignore lint/complexity/noStaticOnlyClass: makes sense for an HTTP utility to encompass all methods
export class HTTP {
	/**
	 * Performs an HTTP GET request.
	 * Note: This method will throw an HTTPError if the response is not ok (status code 200-299) to emulate Axios behaviour.
	 * @param url
	 * @param options
	 */
	static async get(url: string, options?: RequestInit): Promise<HTTPResponse> {
		const response = await fetch(url, { method: "GET", ...options });

		const serialisedResponse = await HTTP.serialise(response);

		if (!response.ok) {
			throw new HTTPError(
				`HTTP GET request failed with status ${response.status}`,
				serialisedResponse,
			);
		}

		return serialisedResponse;
	}

	/**
	 * Performs an HTTP POST request.
	 * Note: This method will throw an HTTPError if the response is not ok (status code 200-299) to emulate Axios behaviour.
	 * @param url
	 * @param body
	 * @param options
	 */
	static async post<T>(
		url: string,
		body: T,
		options?: RequestInit,
	): Promise<HTTPResponse> {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...options?.headers },
			body: JSON.stringify(body),
			...options,
		});

		const serialisedResponse = await HTTP.serialise(response);

		if (!response.ok) {
			throw new HTTPError(
				`HTTP POST request failed with status ${response.status}`,
				serialisedResponse,
			);
		}

		return serialisedResponse;
	}

	/**
	 * Performs an HTTP PUT request.
	 * Note: This method will throw an HTTPError if the response is not ok (status code 200-299) to emulate Axios behaviour.
	 * @param url
	 * @param body
	 * @param options
	 */
	static async put<T>(
		url: string,
		body: T,
		options?: RequestInit,
	): Promise<HTTPResponse> {
		const response = await fetch(url, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...options?.headers },
			body: JSON.stringify(body),
			...options,
		});

		const serialisedResponse = await HTTP.serialise(response);

		if (!response.ok) {
			throw new HTTPError(
				`HTTP PUT request failed with status ${response.status}`,
				serialisedResponse,
			);
		}

		return serialisedResponse;
	}

	/**
	 * Performs an HTTP DELETE request.
	 * Note: This method will throw an HTTPError if the response is not ok (status code 200-299) to emulate Axios behaviour.
	 * @param url
	 * @param options
	 */
	static async delete(
		url: string,
		options?: RequestInit,
	): Promise<HTTPResponse> {
		const response = await fetch(url, { method: "DELETE", ...options });

		const serialisedResponse = await HTTP.serialise(response);

		if (!response.ok) {
			throw new HTTPError(
				`HTTP DELETE request failed with status ${response.status}`,
				serialisedResponse,
			);
		}

		return serialisedResponse;
	}

	private static async serialise(response: Response): Promise<HTTPResponse> {
		let body: unknown;

		try {
			// Clone the response so we don't consume the original body
			body = await response.clone().json();
		} catch {
			// If JSON parsing fails, try text
			try {
				body = await response.clone().text();
			} catch {
				body = null;
			}
		}

		return {
			url: response.url,
			status: response.status,
			statusText: response.statusText,
			headers: Object.fromEntries(response.headers.entries()),
			redirected: response.redirected,
			type: response.type,
			body,
		};
	}
}
