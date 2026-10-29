import path from 'node:path';
import MyBatis from 'mybatis-mapper';
import type { Connection } from 'mysql2/promise';
import { MyBatisSession } from '../mybatis-session';

const mapper = path.join(__dirname, 'fixtures', 'bound-mapper.xml');
const injection = "' OR 1=1 -- ";

const flatten = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('MyBatisSession bound parameters', () => {
	const mysql = {
		query: jest.fn().mockResolvedValue([[]]),
		execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
		beginTransaction: jest.fn(), // makes the dbType getter report MySQL
	};
	const oracle = { execute: jest.fn().mockResolvedValue({ rows: [], rowsAffected: 1 }) };

	jest.mock('oracledb', () => ({ OUT_FORMAT_OBJECT: 4002 }), { virtual: true });

	const session = new MyBatisSession(mysql as unknown as Connection, 'bound', [mapper]);

	beforeEach(() => jest.clearAllMocks());

	const lastQuery = () => ({ sql: flatten(mysql.query.mock.calls[0][0]), values: mysql.query.mock.calls[0][1] });

	it('binds #{} values instead of writing them into the SQL', async () => {
		await session.query('search', { regNo: injection, limit: 25 });

		const { sql, values } = lastQuery();
		expect(sql).toContain('r.reg_no = ?');
		expect(sql).not.toContain('OR 1');
		expect(values).toEqual([injection]);
	});

	it('binds values inside LIKE CONCAT', async () => {
		await session.query('search', { regNo: 'PB1', operatorName: "O'Brien", limit: 25 });

		const { sql, values } = lastQuery();
		expect(sql).toContain("LIKE CONCAT ('%', ?, '%')");
		expect(values).toEqual(['PB1', "O'Brien"]);
	});

	it('still evaluates <if> tests against the real values', async () => {
		await session.query('search', { regNo: 'PB1', type: 'current', limit: 25 });
		expect(lastQuery().sql).toContain('r.removed_date IS NULL');

		mysql.query.mockClear();
		await session.query('search', { regNo: 'PB1', type: 'removed', limit: 25 });
		expect(lastQuery().sql).not.toContain('r.removed_date IS NULL');
	});

	it('binds each <foreach> item', async () => {
		await session.query('search', { regNo: 'PB1', areas: ['Wales', "x') OR ('1'='1"], limit: 25 });

		const { sql, values } = lastQuery();
		expect(sql).toContain('r.area IN (?, ?)');
		expect(values).toEqual(['PB1', 'Wales', "x') OR ('1'='1"]);
	});

	it('binds nested properties of <foreach> items', async () => {
		await session.query('entities', { list: [{ operatorIdentifier: 'OB1' }, { operatorIdentifier: injection }] });

		const { sql, values } = lastQuery();
		expect(sql).toContain('l.lic_no IN (?, ?)');
		expect(values).toEqual(['OB1', injection]);
	});

	it('binds a value once per occurrence', async () => {
		await session.query('repeated', { value: 'a', other: 'b' });

		const { sql, values } = lastQuery();
		expect(sql).toContain('a = ? OR b = ? OR c = ?');
		expect(values).toEqual(['a', 'a', 'b']);
	});

	it('keeps raw substitution and <include> as they were', async () => {
		await session.query('search', { regNo: 'PB1', limit: 25 });

		const { sql } = lastQuery();
		expect(sql).toContain('LIMIT 25');
		expect(sql).toContain('r.deleted_date IS NULL');
	});

	it('binds null as NULL and passes other values as the text mybatis-mapper used', async () => {
		await session.query('repeated', { value: null, other: 7 });

		expect(lastQuery().values).toEqual([null, null, '7']);
	});

	it('still reports an undefined parameter as not converted', async () => {
		await expect(session.query('repeated', { value: 'a' })).rejects.toMatchObject({
			message: '[ERROR]: MyBatis.getStatement for namespace: bound & mapperID: repeated.',
		});
		expect(mysql.query).not.toHaveBeenCalled();
	});

	it("refuses a literal '?' alongside bound values", async () => {
		await expect(session.query('literalQuestionMark', { value: 'a' })).rejects.toMatchObject({
			error: new Error(
				"Statement literalQuestionMark contains a literal '?', which cannot be used alongside bound parameters"
			),
		});
	});

	it('binds values for execute', async () => {
		const affected = await session.execute('rename', { name: injection, id: 5 });

		expect(flatten(mysql.execute.mock.calls[0][0])).toContain('SET name = ? WHERE id = ?');
		expect(mysql.execute.mock.calls[0][1]).toEqual([injection, '5']);
		expect(affected).toBe(1);
	});

	it('uses numbered placeholders for Oracle', async () => {
		const oracleSession = new MyBatisSession(oracle as never, 'bound', [mapper]);

		await oracleSession.query('repeated', { value: 'a', other: 'b' });

		expect(flatten(oracle.execute.mock.calls[0][0])).toContain('a = :1 OR b = :2 OR c = :3');
		expect(oracle.execute.mock.calls[0][1]).toEqual(['a', 'a', 'b']);
	});

	it('does not change the caller parameters or the original namespace', async () => {
		const params = { regNo: 'PB1', areas: ['Wales'], limit: 25 };
		await session.query('search', params);

		expect(params).toEqual({ regNo: 'PB1', areas: ['Wales'], limit: 25 });
		expect(flatten(MyBatis.getStatement('bound', 'repeated', { value: 'a', other: 'b' }))).toContain(
			"a = 'a' OR b = 'a' OR c = 'b'"
		);
	});
});
