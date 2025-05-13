import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts', 'src/empty-module.ts'],
	format: ['esm', 'cjs'],
	dts: {
		entry: './src/index.ts', // only index needs d.ts
	},
	treeshake: true,
	minify: true,
	esbuildOptions(options) {
		options.alias = {
			'libphonenumber-js/max': 'libphonenumber-js/min',
			'routing-controllers-openapi': 'service-bundler/src/empty-module.ts',
			yaml: 'service-bundler/src/empty-module.ts',
		};
	},
});
