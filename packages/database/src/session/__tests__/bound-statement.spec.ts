import path from 'node:path';
import MyBatis from 'mybatis-mapper';
import { escape as mysqlEscape } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { escapeLikePattern, MyBatisSession } from '../mybatis-session';

const mapper = path.join(__dirname, 'fixtures', 'bound-mapper.xml');
const extraMapper = path.join(__dirname, 'fixtures', 'bound-mapper-extra.xml');
const injection = "' OR 1=1 -- ";

// Collapse whitespace, including the spaces the SQL formatter puts inside some parentheses
const flatten = (sql: string) => sql.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();

jest.mock('oracledb', () => ({ OUT_FORMAT_OBJECT: 4002 }), { virtual: true });

describe('MyBatisSession #{} parameters', () => {
	const mysql = {
		query: jest.fn().mockResolvedValue([[]]),
		execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
		escape: jest.fn(mysqlEscape),
		beginTransaction: jest.fn(), // makes the dbType getter report MySQL
	};
	const oracle = { execute: jest.fn().mockResolvedValue({ rows: [], rowsAffected: 1 }) };

	const session = new MyBatisSession(mysql as unknown as Connection, 'bound', [mapper]);
	const oracleSession = new MyBatisSession(oracle as never, 'bound', [mapper]);

	beforeEach(() => jest.clearAllMocks());

	const lastQuery = () => {
		expect(mysql.query.mock.calls[0]).toHaveLength(1);
		return flatten(mysql.query.mock.calls[0][0]);
	};

	describe('MySQL reads', () => {
		it("escape values with mysql2's own escaping instead of mybatis-mapper's", async () => {
			await session.query('search', { regNo: injection, limit: 25 });

			expect(lastQuery()).toContain("r.reg_no = '\\' OR 1=1 -- '");
		});

		it('escape values inside LIKE CONCAT', async () => {
			await session.query('search', { regNo: 'PB1', operatorName: "O'Brien", limit: 25 });

			expect(lastQuery()).toContain("LIKE CONCAT ('%', 'O\\'Brien', '%')");
		});

		it('still evaluate <if> tests against the real values', async () => {
			await session.query('search', { regNo: 'PB1', type: 'current', limit: 25 });
			expect(lastQuery()).toContain('r.removed_date IS NULL');

			mysql.query.mockClear();
			await session.query('search', { regNo: 'PB1', type: 'removed', limit: 25 });
			expect(lastQuery()).not.toContain('r.removed_date IS NULL');
		});

		it('escape each <foreach> item and nested properties of items', async () => {
			await session.query('search', { regNo: 'PB1', areas: ['Wales', "x') OR ('1'='1"], limit: 25 });
			expect(lastQuery()).toContain("r.area IN ('Wales', 'x\\') OR (\\'1\\'=\\'1')");

			mysql.query.mockClear();
			await session.query('entities', { list: [{ operatorIdentifier: 'OB1' }, { operatorIdentifier: injection }] });
			expect(lastQuery()).toContain("l.lic_no IN ('OB1', '\\' OR 1=1 -- ')");
		});

		it('handle repeated parameters, raw substitution and <include> as before', async () => {
			await session.query('repeated', { value: 'a', other: 'b' });
			expect(lastQuery()).toContain("a = 'a' OR b = 'a' OR c = 'b'");

			mysql.query.mockClear();
			await session.query('search', { regNo: 'PB1', limit: 25 });
			expect(lastQuery()).toContain('LIMIT 25');
			expect(lastQuery()).toContain('r.deleted_date IS NULL');
		});

		it("allow a literal '?' in the SQL", async () => {
			await session.query('literalQuestionMark', { value: 'a' });

			expect(lastQuery()).toContain("note = 'why?' AND a = 'a'");
		});

		it('resolve properties of strings and arrays, such as length', async () => {
			await session.query('lengths', { name: 'abc', list: ['x', 'y'] });

			expect(lastQuery()).toContain("n = '3' AND c = '2' AND first = 'x'");
		});

		it('pass numbers and booleans as the text mybatis-mapper used, null as NULL, objects as JSON', async () => {
			await session.query('repeated', { value: null, other: 7 });
			expect(lastQuery()).toContain("a = NULL OR b = NULL OR c = '7'");

			mysql.query.mockClear();
			await session.query('types', {
				date: new Date(0),
				flag: true,
				bytes: Buffer.from('ab'),
				json: { a: 1 },
			} as never);
			expect(mysql.escape).toHaveBeenCalledWith(new Date(0));
			expect(lastQuery()).toContain(`f = 'true' AND b = X'6162' AND j = '{\\"a\\":1}'`);
		});
	});

	describe('server-side binding', () => {
		it('uses ? placeholders for MySQL execute', async () => {
			const affected = await session.execute('rename', { name: injection, id: 5 });

			expect(flatten(mysql.execute.mock.calls[0][0])).toContain('SET name = ? WHERE id = ?');
			expect(mysql.execute.mock.calls[0][1]).toEqual([injection, '5']);
			expect(affected).toBe(1);
		});

		it('uses numbered placeholders for Oracle', async () => {
			await oracleSession.query('repeated', { value: 'a', other: 'b' });

			expect(flatten(oracle.execute.mock.calls[0][0])).toContain('a = :1 OR b = :2 OR c = :3');
			expect(oracle.execute.mock.calls[0][1]).toEqual(['a', 'a', 'b']);
		});

		it("allows a literal '?' alongside placeholders", async () => {
			await session.execute('literalQuestionMark', { value: 'a' });
			expect(flatten(mysql.execute.mock.calls[0][0])).toContain("note = 'why?' AND a = ?");

			await oracleSession.query('literalQuestionMark', { value: 'a' });
			expect(flatten(oracle.execute.mock.calls[0][0])).toContain("note = 'why?' AND a = :1");
		});
	});

	describe('parameters objects', () => {
		it('read getters and inherited properties, and are left as they were', async () => {
			class Params {
				value = 'a';
				get other() {
					return 'from getter';
				}
			}
			const params = new Params();

			await session.query('repeated', params as never);

			expect(lastQuery()).toContain("c = 'from getter'");
			expect(Object.getOwnPropertyNames(params)).toEqual(['value']);
		});

		it('can be frozen', async () => {
			await session.query('search', Object.freeze({ regNo: 'PB1', areas: ['Wales'], limit: 25 }));

			expect(lastQuery()).toContain("r.area IN ('Wales')");
		});
	});

	it('does not mistake text in raw substitutions for a parameter', async () => {
		await session.query('rawAndBound', { raw: '__MYBATIS_BIND_0__', value: 'a' });

		expect(lastQuery()).toContain("SELECT '__MYBATIS_BIND_0__' AS r FROM t WHERE a = 'a'");
	});

	it('picks up statements loaded into the namespace after the session was created', async () => {
		new MyBatisSession(mysql as unknown as Connection, 'bound', [mapper, extraMapper]);

		await session.query('loadedLater', { value: 'a' });

		expect(lastQuery()).toBe("SELECT 1 FROM t WHERE a = 'a'");
	});

	it("reports mistakes using the caller's own names, keeping the original error", async () => {
		const notConverted = await session.query('repeated', { value: 'a' }).catch((err) => err);
		expect(notConverted.error.message).toBe('Parameter #{other} is not converted.');
		expect(notConverted.error.cause).toBeInstanceOf(Error);
		expect(mysql.query).not.toHaveBeenCalled();

		await expect(new MyBatisSession(mysql as never, 'missing', [mapper]).query('x', {})).rejects.toMatchObject({
			error: new Error('Namespace [missing] not exists.'),
		});
	});

	it('leaves the original namespace for direct mybatis-mapper use', () => {
		expect(flatten(MyBatis.getStatement('bound', 'repeated', { value: 'a', other: 'b' }))).toContain(
			"a = 'a' OR b = 'a' OR c = 'b'"
		);
	});
});

describe('escapeLikePattern', () => {
	it.each([
		['50%', '50\\%'],
		['a_b', 'a\\_b'],
		['back\\slash', 'back\\\\slash'],
		["O'Brien", "O'Brien"],
	])('%p -> %p', (input, expected) => {
		expect(escapeLikePattern(input)).toBe(expected);
	});
});
