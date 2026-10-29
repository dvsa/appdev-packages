import { randomBytes } from 'node:crypto';
import MyBatis, { type Format, type Params } from 'mybatis-mapper';

/**
 * mybatis-mapper renders `#{}` values into the SQL text as quoted, escaped literals. Its escaping (backslash-escape,
 * then double every quote) can be broken out of, so the session must handle the values itself.
 *
 * mybatis-mapper has no placeholder mode, so each `#{a.b}` in a copy of the namespace is rewritten to
 * `${__mybatisBind.a__dot__b}`. Reading that property from the `__mybatisBind` proxy resolves the whole path against the
 * live parameters (including the current `<foreach>` item), records the value and returns a unique token. `<if>`/`<when>`
 * tests still see the real parameters. After rendering, the caller replaces each token: with a driver placeholder (and
 * binds the value), or with the driver's own escaping of the value.
 *
 * This relies on mybatis-mapper internals (`getMapper()` being its live store, `${}` values inserted verbatim), which
 * is why the dependency is pinned to an exact version.
 */

const BIND_KEY = '__mybatisBind';
const BOUND_NAMESPACE_SUFFIX = '::bound';
// mybatis-mapper builds a RegExp from the reference, so the separator must be plain word characters
const PATH_SEPARATOR = '__dot__';
// Same pattern mybatis-mapper uses, so no #{} is left for it to inline (a name with '$' then fails as not converted)
const PARAMETER_REFERENCE = /#\{([a-zA-Z0-9._$]+)\}/g;
const REWRITTEN_REFERENCE = /\$\{__mybatisBind\.([a-zA-Z0-9_$]+)\}/g;

type MapperNode = { type?: string; content?: string; children?: MapperNode[] };

export type BindValue = string | Date | Buffer | null;

// Rewritten copies keyed by the original statement, so createMapper reloading a file is picked up
const rewrittenStatements = new WeakMap<MapperNode[], MapperNode[]>();

/**
 * Renders a statement, replacing each `#{}` value with the text returned by `replace`.
 *
 * @param {string} namespace - Namespace of the mapper
 * @param {string} mapperId - Mapper ID
 * @param {Params} params - Query parameters
 * @param {Format} format - mybatis-mapper format options
 * @param {(value: BindValue, position: number) => string} replace - SQL for the nth value (1-based), e.g. a placeholder
 * @return {string} - The rendered SQL
 */
export function renderBoundStatement(
	namespace: string,
	mapperId: string,
	params: Params,
	format: Format,
	replace: (value: BindValue, position: number) => string
): string {
	const recorded: BindValue[] = [];
	// A per-render nonce stops text from ${} values or the SQL itself being mistaken for a token
	const tokenPrefix = `__MYBATIS_BIND_${randomBytes(6).toString('hex')}_`;

	let rendered: string;
	try {
		rendered = withBindingProxy(
			params,
			(root) => bindingProxy(root, recorded, tokenPrefix),
			(renderParams) => MyBatis.getStatement(syncBoundNamespace(namespace), mapperId, renderParams, format)
		);
	} catch (err) {
		throw new Error(toUserFacing((err as Error).message), { cause: err });
	}

	let position = 0;
	return rendered.replace(new RegExp(`${tokenPrefix}(\\d+)__`, 'g'), (_token, index: string) =>
		replace(recorded[Number(index)], ++position)
	);
}

/**
 * Escapes `%`, `_` and `\` so a value matches literally inside a MySQL `LIKE` pattern (default escape character),
 * e.g. `LIKE CONCAT('%', #{name}, '%')` with `name: escapeLikePattern(input)`.
 *
 * @param {string} value - Text to match literally
 * @return {string} - The escaped text
 */
export function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Brings the bound copy of a namespace up to date with the original, rewriting only statements not seen before.
 * The original namespace is left untouched for anything calling mybatis-mapper directly.
 */
function syncBoundNamespace(namespace: string): string {
	const mappers = MyBatis.getMapper() as unknown as Record<string, Record<string, MapperNode[]>>;
	const boundNamespace = `${namespace}${BOUND_NAMESPACE_SUFFIX}`;
	const original = mappers[namespace];

	if (original) {
		const copy: Record<string, MapperNode[]> = {};
		for (const [id, statement] of Object.entries(original)) {
			let rewritten = rewrittenStatements.get(statement);
			if (!rewritten) {
				rewritten = structuredClone(statement);
				rewritten.forEach(rewriteReferences);
				rewrittenStatements.set(statement, rewritten);
			}
			copy[id] = rewritten;
		}
		mappers[boundNamespace] = copy;
	}

	return boundNamespace;
}

/**
 * Renders with the caller's own parameters object, as mybatis-mapper always has (so getters, inherited properties and
 * `<foreach>`/`<bind>` writes behave as before), with the proxy attached for the duration as a hidden property.
 */
function withBindingProxy<T>(
	params: Params,
	makeProxy: (root: Params) => object,
	render: (renderParams: Params) => T
): T {
	// A frozen or sealed object can't take the property, so render from a copy (the proxy reads from that copy too)
	const renderParams = Object.isExtensible(params) ? params : { ...params };

	Object.defineProperty(renderParams, BIND_KEY, {
		value: makeProxy(renderParams),
		configurable: true,
		enumerable: false,
	});
	try {
		return render(renderParams);
	} finally {
		delete (renderParams as Record<string, unknown>)[BIND_KEY];
	}
}

function rewriteReferences(node: MapperNode) {
	if (node.type === 'text' && node.content) {
		node.content = node.content.replace(
			PARAMETER_REFERENCE,
			(_reference, path: string) => `\${${BIND_KEY}.${path.split('.').join(PATH_SEPARATOR)}}`
		);
	}
	node.children?.forEach(rewriteReferences);
}

// Put the caller's own names back into mybatis-mapper errors
function toUserFacing(message: string): string {
	return message
		.replace(REWRITTEN_REFERENCE, (_reference, path: string) => `#{${path.split(PATH_SEPARATOR).join('.')}}`)
		.replaceAll(BOUND_NAMESPACE_SUFFIX, '');
}

function bindingProxy(root: Params, recorded: BindValue[], tokenPrefix: string): object {
	return new Proxy(
		{},
		{
			get(_target, property) {
				if (typeof property !== 'string') {
					return undefined;
				}

				const value = resolve(root, property.split(PATH_SEPARATOR));

				// Leave undefined (and functions) alone so mybatis-mapper still reports the parameter as not converted
				if (value === undefined || typeof value === 'function') {
					return undefined;
				}

				recorded.push(toBindValue(value));
				return `${tokenPrefix}${recorded.length - 1}__`;
			},
		}
	);
}

function resolve(root: unknown, path: string[]): unknown {
	return path.reduce<unknown>(
		(value, key) => (value === null || value === undefined ? undefined : (value as Record<string, unknown>)[key]),
		root
	);
}

function toBindValue(value: unknown): BindValue {
	if (value === null || typeof value === 'string') {
		return value;
	}
	// Dates and binary are passed as they are; mybatis-mapper's JSON-quoted form for them never matched anything
	if (value instanceof Date || Buffer.isBuffer(value)) {
		return value;
	}
	// Objects and arrays are stringified, as mybatis-mapper does for JSON fields
	if (typeof value === 'object') {
		return JSON.stringify(value);
	}
	// Numbers and booleans stay the text mybatis-mapper sent: a number compared to a VARCHAR column stops it using its
	// index, and a native boolean behaves differently from 'true'/'false' on both MySQL and Oracle
	return String(value);
}
