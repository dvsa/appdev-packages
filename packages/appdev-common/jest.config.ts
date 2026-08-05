import type { Config } from "jest";

const config: Config = {
	testEnvironment: "node",
	transform: {
		"^.+\\.(t|j)sx?$": [
			"@swc/jest",
			{
				jsc: {
					parser: { syntax: "typescript", tsx: true, decorators: true },
					transform: { legacyDecorator: true, decoratorMetadata: true },
					target: "es2022",
					keepClassNames: true,
					externalHelpers: false,
				},
				module: { type: "commonjs" },
				sourceMaps: false,
			},
		],
	},
};

export default config;
