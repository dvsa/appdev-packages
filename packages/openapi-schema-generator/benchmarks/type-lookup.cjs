// Run with npm run benchmark:type-lookup. Each sample uses a fresh process;
// timings cover generator construction and schema creation, excluding harness loading.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');

function canonical(value) {
	if (Array.isArray(value)) return value.map(canonical);
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

if (process.argv[2] === '--sample') {
	const [, , , directory, variant, countArgument] = process.argv;
	const count = Number(countArgument);
	const { createGenerator } = require('ts-json-schema-generator');
	// Compile only this adapter so both variants run identical JS dependencies.
	const filename = path.resolve(__dirname, '../src/indexed-generator.ts');
	const { code } = require('@swc/core').transformFileSync(filename, {
		jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
		module: { type: 'commonjs' },
	});
	const adapter = new Module(filename, module);
	adapter.filename = filename;
	adapter.paths = Module._nodeModulePaths(path.dirname(filename));
	adapter._compile(code, filename);
	const factory = variant === 'baseline' ? createGenerator : adapter.exports.createIndexedGenerator;
	const names = Array.from({ length: count }, (_, index) => `Model${index * Math.floor(2000 / count)}`);
	const start = performance.now();
	const generator = factory({
		path: path.join(directory, 'index.ts'),
		tsconfig: path.join(directory, 'tsconfig.json'),
	});
	const constructed = performance.now();
	const schema = generator.createSchema(names);
	const finished = performance.now();
	process.stdout.write(JSON.stringify({
		variant,
		count,
		constructMs: constructed - start,
		schemaMs: finished - constructed,
		totalMs: finished - start,
		hash: createHash('sha256').update(JSON.stringify(canonical(schema))).digest('hex'),
	}));
} else {
	const directory = fs.mkdtempSync(path.join(tmpdir(), 'openapi-lookup-benchmark-'));
	try {
		fs.writeFileSync(path.join(directory, 'tsconfig.json'), JSON.stringify({
			compilerOptions: { strict: true, types: [], skipLibCheck: true, target: 'ES2022' },
		}));
		fs.writeFileSync(path.join(directory, 'shared.ts'),
			'export interface Shared { id: string; tags: string[]; state: "active" | "inactive" }');
		const exports = [];
		for (let file = 0; file < 20; file++) {
			const declarations = ["import type { Shared } from './shared';"];
			for (let model = file * 100; model < (file + 1) * 100; model++) {
				declarations.push(`export interface Model${model} {
					name: string; count: number; enabled: boolean; shared: Shared; optional?: string;
				}`);
			}
			fs.writeFileSync(path.join(directory, `models-${file}.ts`), declarations.join('\n'));
			exports.push(`export * from './models-${file}';`);
		}
		fs.writeFileSync(path.join(directory, 'index.ts'), exports.join('\n'));
		const results = [];
		console.log(`Runtime: ${process.versions.bun ? `Bun ${process.versions.bun}` : `Node ${process.version}`}`);
		console.log(`Generator: ${require('ts-json-schema-generator/package.json').version}; TypeScript: ${require('ts-json-schema-generator').ts.version}`);
		console.log('2,000 interfaces across 20 files; 5 fresh-process samples per variant/count; type checking enabled.');
		for (const count of [1, 100, 500]) {
			for (let round = 0; round < 5; round++) {
				// Alternate order to reduce systematic cache/order bias.
				for (const variant of round % 2 ? ['indexed', 'baseline'] : ['baseline', 'indexed']) {
					results.push(JSON.parse(execFileSync(process.execPath,
						[__filename, '--sample', directory, variant, String(count)],
						{ encoding: 'utf8', timeout: 60000 })));
				}
			}
			const samples = results.filter((result) => result.count === count);
			assert.equal(new Set(samples.map((result) => result.hash)).size, 1, 'Schema outputs differ');
			const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
			for (const variant of ['baseline', 'indexed']) {
				const rows = samples.filter((sample) => sample.variant === variant);
				console.log(JSON.stringify({
					count, variant,
					constructMs: Math.round(median(rows.map((row) => row.constructMs))),
					schemaMs: Math.round(median(rows.map((row) => row.schemaMs))),
					totalMs: Math.round(median(rows.map((row) => row.totalMs))),
				}));
			}
		}
		console.log('All baseline/indexed schema hashes match.');
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
}
