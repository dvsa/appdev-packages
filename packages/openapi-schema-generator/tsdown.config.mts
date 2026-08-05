import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  treeshake: true,
  minify: true,
  // typescript is used at runtime by ts-json-schema-generator (AST walking);
  // keep it external so the consumer's typescript is used, not a bundled copy.
  external: ['typescript'],
});
