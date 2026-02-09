#!/usr/bin/env node

/**
 * Generates JSDoc comments for Drizzle schema files.
 * Parses the schema definitions and creates a readable table summary
 * that survives TypeScript compilation into .d.ts files.
 *
 * Usage: node scripts/generate-schema-docs.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', 'src');
const MARKER = '@generated-schema-doc';

function findSchemaFiles(dir) {
	const results = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findSchemaFiles(fullPath));
		} else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && entry.name !== 'index.ts') {
			const content = readFileSync(fullPath, 'utf-8');
			if (content.includes('.table(')) {
				results.push(fullPath);
			}
		}
	}
	return results;
}

/**
 * Join multi-line column definitions into single lines.
 * Handles cases like:
 *   lastUpdatedDatetime: datetime('col', { mode: 'string', fsp: 3 }).default(
 *       sql`(CURRENT_TIMESTAMP(3))`
 *   ),
 */
function joinContinuationLines(lines) {
	const result = [];
	for (const line of lines) {
		if (/^\t{2}\w+:\s/.test(line)) {
			result.push(line);
		} else if (result.length > 0) {
			result[result.length - 1] += ' ' + line.trim();
		}
	}
	return result;
}

function parseColumnDef(definition) {
	const type = definition.match(/^(\w+)\(/)?.[1] || 'unknown';
	let typeStr = type;

	switch (type) {
		case 'varchar': {
			const length = definition.match(/length:\s*(\d+)/)?.[1];
			typeStr = length ? `varchar(${length})` : 'varchar';
			break;
		}
		case 'bigint':
			typeStr = definition.includes('unsigned') ? 'bigint unsigned' : 'bigint';
			break;
		case 'int':
			typeStr = 'int';
			break;
		case 'text':
			typeStr = 'text';
			break;
		case 'decimal': {
			const precision = definition.match(/precision:\s*(\d+)/)?.[1];
			const scale = definition.match(/scale:\s*(\d+)/)?.[1];
			typeStr = precision && scale ? `decimal(${precision},${scale})` : 'decimal';
			break;
		}
		case 'datetime': {
			const fsp = definition.match(/fsp:\s*(\d+)/)?.[1];
			typeStr = fsp ? `datetime(${fsp})` : 'datetime';
			break;
		}
		case 'mysqlEnum': {
			const values = definition.match(/\[([^\]]+)\]/)?.[1];
			if (values) {
				const cleaned = values.replace(/'/g, '').split(',').map((v) => v.trim()).join(', ');
				typeStr = `enum(${cleaned})`;
			} else {
				typeStr = 'enum';
			}
			break;
		}
	}

	const constraints = [];
	if (definition.includes('.primaryKey()')) constraints.push('PK');
	if (definition.includes('.autoincrement()')) constraints.push('AUTO INC');
	if (definition.includes('.notNull()')) constraints.push('NOT NULL');

	const defaultMatch = definition.match(/\.default\(([^)]+(?:\([^)]*\))?)\)/);
	if (defaultMatch) {
		let val = defaultMatch[1].trim();
		if (val.includes('CURRENT_TIMESTAMP')) val = 'CURRENT_TIMESTAMP';
		else if (val.startsWith("'") || val.startsWith('"')) val = val.replace(/['"]/g, '');
		constraints.push(`default: ${val}`);
	}

	const nullable = !definition.includes('.primaryKey()') && !definition.includes('.notNull()');

	return { type: typeStr, constraints, nullable };
}

function parseSchema(content) {
	const schemaMatch = content.match(/formatSchemaName\(['"](\w+)['"]\)/);
	const schemaName = schemaMatch?.[1] || 'unknown';

	const tableMatch = content.match(/\.table\(\s*\n?\s*['"](\w+)['"]/);
	const tableName = tableMatch?.[1] || 'unknown';

	const columns = [];
	const lines = content.split('\n');
	let inColumns = false;
	let depth = 0;
	let foundTable = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.includes('.table(')) {
			foundTable = true;
			continue;
		}
		if (!foundTable) continue;

		const opens = (line.match(/\{/g) || []).length;
		const closes = (line.match(/\}/g) || []).length;

		if (!inColumns && opens > 0 && depth === 0) {
			inColumns = true;
			depth += opens - closes;
			continue;
		}

		if (inColumns) {
			depth += opens - closes;
			if (depth <= 0) break;

			// Collect all lines in the columns block, then process
			const remaining = lines.slice(i);
			const columnLines = [];
			let d = depth;
			for (const l of remaining) {
				const o = (l.match(/\{/g) || []).length;
				const c = (l.match(/\}/g) || []).length;
				d += o - c;
				if (d < 1) break;
				columnLines.push(l);
			}

			const joined = joinContinuationLines(columnLines);
			for (const colLine of joined) {
				const colMatch = colLine.match(/^\t{2}(\w+):\s+(.+?)(?:,\s*)?$/);
				if (colMatch) {
					const [, name, def] = colMatch;
					columns.push({ name, ...parseColumnDef(def) });
				}
			}
			break;
		}
	}

	return { schemaName, tableName, columns };
}

function generateJSDoc(schema) {
	const { schemaName, tableName, columns } = schema;

	const colW = Math.max(6, ...columns.map((c) => c.name.length));
	const typeW = Math.max(4, ...columns.map((c) => c.type.length));
	const nullW = 8; // "Nullable"
	const constW = Math.max(11, ...columns.map((c) => c.constraints.join(', ').length));

	const pad = (s, w) => s.padEnd(w);
	const row = (col, type, nullable, constr) =>
		` * | ${pad(col, colW)} | ${pad(type, typeW)} | ${pad(nullable, nullW)} | ${pad(constr, constW)} |`;
	const sep = ` * | ${'-'.repeat(colW)} | ${'-'.repeat(typeW)} | ${'-'.repeat(nullW)} | ${'-'.repeat(constW)} |`;

	return [
		'/**',
		` * ${MARKER}`,
		` * Schema: \`${schemaName}\` | Table: \`${tableName}\``,
		' *',
		row('Column', 'Type', 'Nullable', 'Constraints'),
		sep,
		...columns.map((c) => row(c.name, c.type, c.nullable ? 'Yes' : 'No', c.constraints.join(', '))),
		' */',
	].join('\n');
}

function removeExistingDoc(content) {
	return content.replace(new RegExp(`/\\*\\*\\n\\s*\\* ${MARKER}[\\s\\S]*?\\*/\\n`, 'g'), '');
}

function main() {
	const files = findSchemaFiles(SRC_DIR);
	console.log(`Found ${files.length} schema file(s)\n`);

	for (const file of files) {
		const rel = relative(SRC_DIR, file);
		let content = readFileSync(file, 'utf-8');
		content = removeExistingDoc(content);

		const schema = parseSchema(content);
		if (schema.columns.length === 0) {
			console.log(`  SKIP  ${rel} (no columns found)`);
			continue;
		}

		const jsdoc = generateJSDoc(schema);
		content = content.replace(/^(export const)/m, `${jsdoc}\n$1`);

		writeFileSync(file, content, 'utf-8');
		console.log(`  DONE  ${rel} (${schema.tableName}: ${schema.columns.length} columns)`);
	}

	console.log('\nComplete!');
}

main();
