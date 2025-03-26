import { gzipSync } from "node:zlib";
import { DataCompression } from "../compression";

describe("DataCompression", () => {
	const sampleObject = { key: "value", version: "1.0" };

	it("should compress and extract the original object", () => {
		const compressed = DataCompression.compress(sampleObject);
		const extracted =
			DataCompression.decompress<typeof sampleObject>(compressed);
		expect(extracted).toEqual(sampleObject);
	});

	it("should throw if input is not valid base64", () => {
		const invalidBase64 = "not-a-valid-base64-string!";
		expect(() => DataCompression.decompress(invalidBase64)).toThrow();
	});

	it("should throw if base64 is valid but not gzipped", () => {
		const notGzipped = Buffer.from(JSON.stringify(sampleObject)).toString(
			"base64",
		);
		expect(() => DataCompression.decompress(notGzipped)).toThrow();
	});

	it("should throw if unzipped data is not valid JSON", () => {
		const invalidJson = '{ this is: not "json" }';
		const gzipped = gzipSync(Buffer.from(invalidJson)).toString("base64");
		expect(() => DataCompression.decompress(gzipped)).toThrow();
	});
});
