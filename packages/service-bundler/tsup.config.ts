import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts', 'src/empty-module.ts'],
	format: ['esm', 'cjs'],
	dts: {
		entry: './src/index.ts', // only index needs d.ts
	},
	treeshake: true,
	minify: true
});
