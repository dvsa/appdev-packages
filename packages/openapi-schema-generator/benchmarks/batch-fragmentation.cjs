// Compare fragmented generation with/without compiler reuse. Both variants use
// the same batching rules and current indexed generator.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');

// Previous generation loop, retained as the baseline without a Git dependency.
async function originalDefinitions(paths) {
	const definitions = {};
	for (const batch of this.createSchemaBatches(paths)) {
		const combinedPath = this.combinePaths(batch.map(({ path }) => path));
		if (combinedPath === undefined) {
			for (const entry of batch) Object.assign(definitions, this.generateDefinitionBatch([entry]));
			continue;
		}
		try {
			Object.assign(definitions, this.generateDefinitionBatch(batch, combinedPath));
		} catch (error) {
			if (batch.length === 1) throw error;
			for (const entry of batch) Object.assign(definitions, this.generateDefinitionBatch([entry]));
		}
	}
	return { definitions };
}

function canonical(value) {
	if (Array.isArray(value)) return value.map(canonical);
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function compile(name, replacements = {}) {
	const filename = path.resolve(__dirname, `../src/${name}.ts`);
	const compiled = new Module(filename, module);
	compiled.filename = filename;
	compiled.paths = Module._nodeModulePaths(path.dirname(filename));
	compiled.require = function (request) {
		return Object.hasOwn(replacements, request) ? replacements[request] : Module.prototype.require.call(this, request);
	};
	const { code } = require('@swc/core').transformFileSync(filename, {
		jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
		module: { type: 'commonjs' },
	});
	compiled._compile(code, filename);
	return compiled.exports;
}

async function main() {
	if (process.argv[2] === '--sample') {
		const [, , , directory, variant, scenario] = process.argv;
		let programs = 0;
		const upstream = require('ts-json-schema-generator');
		const instrumented = {
			...upstream,
			createProgram(config) { programs++; return upstream.createProgram(config); },
		};
		const indexed = compile('indexed-generator', { 'ts-json-schema-generator': instrumented });
		const { TypescriptToOpenApiSpec: api } = compile('index', {
			'./indexed-generator': indexed,
			'ts-json-schema-generator': instrumented,
		});
		if (variant === 'baseline') api.generateDefinitions = originalDefinitions;
		const unique = Array.from({ length: 25 }, (_, index) => `Model${index}`);
		const scenarios = {
			unique,
			'duplicate-tail': [...unique, 'Model0'],
			interspersed: [...unique.slice(0, 13), 'Model0', ...unique.slice(13), 'Model0'],
			'all-repeated': Array(6).fill('Model0'),
		};
		const inputs = scenarios[scenario].map((interfaceName) => ({
			path: path.join(directory, 'index.ts'), interfaceName,
		}));
		process.chdir(directory);
		console.log = () => {};
		const started = performance.now();
		const spec = await api.generate({ openapi: '3.0.0', info: { title: 'Benchmark', version: '1' }, paths: {} }, inputs);
		const elapsedMs = performance.now() - started;
		process.stdout.write(JSON.stringify({
			variant, scenario, inputs: inputs.length, programs, elapsedMs,
			hash: createHash('sha256').update(JSON.stringify(canonical(spec))).digest('hex'),
		}));
		return;
	}

	const directory = fs.mkdtempSync(path.join(tmpdir(), 'openapi-batch-benchmark-'));
	try {
		fs.writeFileSync(path.join(directory, 'tsconfig.json'), JSON.stringify({
			compilerOptions: { strict: true, types: [], skipLibCheck: true, target: 'ES2022' },
		}));
		const exports = [];
		for (let file = 0; file < 5; file++) {
			const declarations = [];
			for (let model = file * 100; model < (file + 1) * 100; model++) {
				declarations.push(`export interface Model${model} { name: string; count: number; optional?: string }`);
			}
			fs.writeFileSync(path.join(directory, `models-${file}.ts`), declarations.join('\n'));
			exports.push(`export * from './models-${file}';`);
		}
		fs.writeFileSync(path.join(directory, 'index.ts'), exports.join('\n'));
		console.log(`Runtime: ${process.versions.bun ? `Bun ${process.versions.bun}` : `Node ${process.version}`}`);
		console.log(`Generator: ${require('ts-json-schema-generator/package.json').version}; TypeScript: ${require('ts-json-schema-generator').ts.version}`);
		console.log('500 interfaces across 5 files; 5 fresh processes per variant/scenario; type checking enabled.');
		for (const scenario of ['unique', 'duplicate-tail', 'interspersed', 'all-repeated']) {
			const samples = [];
			for (let round = 0; round < 5; round++) {
				for (const variant of round % 2 ? ['improved', 'baseline'] : ['baseline', 'improved']) {
					samples.push(JSON.parse(execFileSync(process.execPath,
						[__filename, '--sample', directory, variant, scenario],
						{ encoding: 'utf8', timeout: 60000 })));
				}
			}
			assert.equal(new Set(samples.map((sample) => sample.hash)).size, 1, 'OpenAPI outputs differ');
			for (const variant of ['baseline', 'improved']) {
				const rows = samples.filter((sample) => sample.variant === variant);
				assert.equal(new Set(rows.map((sample) => sample.programs)).size, 1);
				const sorted = rows.map((row) => row.elapsedMs).sort((a, b) => a - b);
				console.log(JSON.stringify({
					scenario, variant, inputs: rows[0].inputs, programs: rows[0].programs,
					medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]),
				}));
			}
		}
		console.log('All baseline/improved OpenAPI hashes match. Timings exclude process startup and harness loading.');
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
