export const CompressionHeaders = {
	// The common compression value used to indicate / check the compression type
	compressionValue: 'base64+gzip',

	// When sending compressed data TO the server
	outbound: {
		request: 'X-Payload-Encoding', // Tells server the request body is compressed
	},

	// When receiving compressed data FROM the server
	inbound: {
		request: 'x-accept-encoding', // Tells server we accept compressed responses
		response: 'Content-Encoding', // Server tells us the response body is compressed
	},
} as const;
