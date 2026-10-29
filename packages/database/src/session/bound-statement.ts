import MyBatis, { type Format, type Params } from 'mybatis-mapper';

/**
 * mybatis-mapper renders `#{}` values into the SQL text as quoted, escaped literals. Its escaping (backslash-escape,
 * then double every quote) can be broken out of, so values must be bound instead.
 *
 * mybatis-mapper has no placeholder mode, so each `#{path}` in a copy of the mapper is rewritten to
 * `${__mybatisBind.path}`. `__mybatisBind` is a proxy that, when read, records the live value at that path (including
 * the current `<foreach>` item) and returns a unique token. `<if>`/`<when>` tests still see the real parameters. After
 * rendering, each token is swapped for a placeholder and its value is passed to the driver.
 */

const BIND_KEY = '__mybatisBind';
const BOUND_NAMESPACE_SUFFIX = '::bound';
const PARAMETER_REFERENCE = /#\{([a-zA-Z0-9._$]+)\}/g;
const TOKEN = /__MYBATIS_BIND_(\d+)__/g;

type MapperNode = { type?: string; content?: string; children?: MapperNode[] };

export type BindValue = string | null;

export type BoundStatement = { sql: string; values: BindValue[] };

/**
 * Registers (once) a copy of the namespace whose `#{}` references are rewritten for binding.
 * The original namespace is left untouched for anything calling mybatis-mapper directly.
 *
 * @param {string} namespace - Namespace of the mapper
 * @return {string} - The namespace to render bound statements from
 */
export function registerBoundNamespace(namespace: string): string {
	const mappers = MyBatis.getMapper() as unknown as Record<string, Record<string, MapperNode[]>>;
	const boundNamespace = `${namespace}${BOUND_NAMESPACE_SUFFIX}`;

	if (mappers[namespace]) {
		const copy = structuredClone(mappers[namespace]);
		for (const statement of Object.values(copy)) {
			statement.forEach(rewriteReferences);
		}
		mappers[boundNamespace] = copy;
	}

	return boundNamespace;
}

/**
 * Renders a statement with every `#{}` value replaced by a placeholder.
 *
 * @param {string} boundNamespace - Namespace returned by {@link registerBoundNamespace}
 * @param {string} mapperId - Mapper ID
 * @param {Params} params - Query parameters
 * @param {(position: number) => string} placeholder - Placeholder for the nth bound value (1-based)
 * @param {Format} format - mybatis-mapper format options
 * @return {BoundStatement} - SQL with placeholders, and the values in placeholder order
 */
export function renderBoundStatement(
	boundNamespace: string,
	mapperId: string,
	params: Params,
	placeholder: (position: number) => string,
	format: Format
): BoundStatement {
	const recorded: BindValue[] = [];
	// Shallow copy: mybatis-mapper writes <foreach> items and <bind> results onto the parameters it is given
	const renderParams: Record<string, unknown> = { ...params };
	renderParams[BIND_KEY] = bindingProxy(renderParams, [], recorded);

	const rendered = MyBatis.getStatement(boundNamespace, mapperId, renderParams as Params, format);

	if (recorded.length > 0 && rendered.includes('?')) {
		throw new Error(`Statement ${mapperId} contains a literal '?', which cannot be used alongside bound parameters`);
	}

	const values: BindValue[] = [];
	const sql = rendered.replace(TOKEN, (_token, index: string) => {
		values.push(recorded[Number(index)]);
		return placeholder(values.length);
	});

	return { sql, values };
}

function rewriteReferences(node: MapperNode) {
	if (node.type === 'text' && node.content) {
		node.content = node.content.replace(PARAMETER_REFERENCE, `\${${BIND_KEY}.$1}`);
	}
	node.children?.forEach(rewriteReferences);
}

function bindingProxy(root: Record<string, unknown>, path: string[], recorded: BindValue[]): object {
	const record = (value: BindValue) => {
		recorded.push(value);
		return `__MYBATIS_BIND_${recorded.length - 1}__`;
	};

	return new Proxy(
		{},
		{
			get(_target, property) {
				// A whole object referenced as #{obj} is stringified in the SQL, as mybatis-mapper does for JSON fields
				if (property === Symbol.toPrimitive) {
					return () => record(JSON.stringify(resolve(root, path)));
				}
				if (typeof property !== 'string') {
					return undefined;
				}

				const childPath = [...path, property];
				const value = resolve(root, childPath);

				// Leave undefined alone so mybatis-mapper still reports the parameter as not converted
				if (value === undefined) {
					return undefined;
				}
				if (isPlainObject(value)) {
					return bindingProxy(root, childPath, recorded);
				}

				return record(toBindValue(value));
			},
		}
	);
}

// Same value mybatis-mapper would have put between the quotes, without the escaping
function toBindValue(value: unknown): BindValue {
	if (value === null) {
		return null;
	}
	return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function resolve(root: Record<string, unknown>, path: string[]): unknown {
	return path.reduce<unknown>(
		(value, key) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined),
		root
	);
}

function isPlainObject(value: unknown): boolean {
	return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}
