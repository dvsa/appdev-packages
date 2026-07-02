const createRemoteJWKSetMock = jest.fn((url: URL) => ({ url }));
const jwtVerifyMock = jest.fn();

jest.mock("jose", () => ({
	createRemoteJWKSet: (url: URL) => createRemoteJWKSetMock(url),
	jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
}));

describe("JwtAuthoriser", () => {
	beforeEach(() => {
		jest.resetModules();
		createRemoteJWKSetMock.mockClear();
		jwtVerifyMock.mockReset();
		process.env.environment = "PRODUCTION";
	});

	it("should use a tenant-specific JWKS endpoint when tenantId is provided", async () => {
		jwtVerifyMock.mockResolvedValue({ payload: { sub: "user-1" } });

		const { JwtAuthoriser } = await import("../verify-jwt");

		await new JwtAuthoriser("client-id", "tenant-123").verify("token");

		expect(createRemoteJWKSetMock).toHaveBeenCalledWith(
			new URL("https://login.microsoftonline.com/tenant-123/discovery/keys"),
		);
		expect(jwtVerifyMock).toHaveBeenCalledWith(
			"token",
			{
				url: new URL(
					"https://login.microsoftonline.com/tenant-123/discovery/keys",
				),
			},
			expect.objectContaining({
				audience: ["client-id"],
				issuer: [
					"https://sts.windows.net/tenant-123/",
					"https://login.microsoftonline.com/tenant-123/v2.0",
				],
			}),
		);
	});

	it("should fall back to the common JWKS endpoint when tenantId is not provided", async () => {
		jwtVerifyMock.mockResolvedValue({ payload: { sub: "user-1" } });

		const { JwtAuthoriser } = await import("../verify-jwt");

		await new JwtAuthoriser("client-id").verify("token");

		expect(createRemoteJWKSetMock).toHaveBeenCalledWith(
			new URL("https://login.microsoftonline.com/common/discovery/keys"),
		);
		expect(jwtVerifyMock).toHaveBeenCalledWith(
			"token",
			{
				url: new URL("https://login.microsoftonline.com/common/discovery/keys"),
			},
			expect.objectContaining({
				audience: ["client-id"],
			}),
		);
	});
});
