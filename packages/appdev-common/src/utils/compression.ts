import { gunzipSync, gzipSync } from "node:zlib";

// biome-ignore lint/complexity/noStaticOnlyClass: Valid use case for a static class
export class DataCompression {
	/**
	 * Extracts a compressed (in base64) string using gunzip into a JSON object
	 * @template T
	 * @param {string} compressedData
	 * @returns {T}
	 */
	static decompress<T>(compressedData: string): T {
		const gzippedBytes = Buffer.from(compressedData, "base64");
		const unzippedJson = gunzipSync(gzippedBytes).toString();
		return JSON.parse(unzippedJson);
	}

	/**
	 * Compresses (with gzip) a JSON object into a base64 string
	 * @template T
	 * @param {T} data
	 * @returns {string}
	 */
	static compress<T>(data: T): string {
		const jsonString = JSON.stringify(data);
		const gzippedData = gzipSync(Buffer.from(jsonString));
		return gzippedData.toString("base64");
	}
}
