import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/empty-module.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	treeshake: true,
	minify: true,
});
