import { type ClassConstructor, plainToInstance } from 'class-transformer';
import MyBatis, { type Format, type Params } from 'mybatis-mapper';
import type { Connection as MySQLConnection, ResultSetHeader } from 'mysql2/promise';
import type { Connection as OracleConnection } from 'oracledb';
import { type BoundStatement, registerBoundNamespace, renderBoundStatement } from './bound-statement';

type DatabaseConnection = MySQLConnection | OracleConnection;

export enum DatabaseType {
	MYSQL = 'mysql',
	ORACLE = 'oracle',
}

const FORMAT: Format = { language: 'sql', indent: '  ' };

export class MyBatisSession {
	private readonly boundNamespace: string;

	/**
	 * This class will instantiate a list of mappers via a MyBatis plugin
	 * @param {DatabaseConnection} connection - Database connection object (MySQL or Oracle)
	 * @param {string} namespace - Namespace of the mapper
	 * @param {string[]} mappers - File paths to the mappers
	 * @param {boolean} debugMode - Debug mode will log the SQL query created
	 */
	constructor(
		private connection: DatabaseConnection,
		private namespace: string,
		private mappers: string[],
		private debugMode = false
	) {
		MyBatis.createMapper(this.mappers);
		this.boundNamespace = registerBoundNamespace(this.namespace);
	}

	/**
	 * Query a database (MySQL or Oracle)
	 * @param {string} mapperId - Mapper ID
	 * @param {Params} params - Query parameters
	 * @return {Promise<unknown[]>}
	 */
	async query(mapperId: string, params: Params = {}): Promise<unknown> {
		const { sql, values } = this.statement(mapperId, params);
		this.logStatement('Query', mapperId, sql, values);

		if (this.dbType === DatabaseType.MYSQL) {
			const [rows] = await (values.length > 0
				? (this.connection as MySQLConnection).query(sql, values)
				: (this.connection as MySQLConnection).query(sql));
			return rows;
		}

		const result = await (this.connection as OracleConnection).execute(sql, values, {
			outFormat: (await import('oracledb')).OUT_FORMAT_OBJECT,
		});

		return result.rows ?? result;
	}

	/**
	 * Query a database and map the result to a single model
	 * @template T
	 * @param {string} mapperId - Mapper ID
	 * @param {Params} params - Query parameters
	 * @param {ClassConstructor<T>} model - Model class
	 * @return {Promise<T>}
	 */
	async selectOne<T>(mapperId: string, params: Params, model: ClassConstructor<T>): Promise<T | undefined> {
		const rows = await this.selectList(mapperId, params, model);
		return rows[0];
	}

	/**
	 * Query a database and map the result to a model list
	 * @template T
	 * @param {string} mapperId - Mapper ID
	 * @param {Params} params - Query parameters
	 * @param {ClassConstructor<T>} model - Model class
	 * @return {Promise<T[]>}
	 */
	async selectList<T>(mapperId: string, params: Params, model: ClassConstructor<T>): Promise<T[]> {
		const rows = await this.query(mapperId, params);

		// Ensure rows is always an array
		const rowsArray = Array.isArray(rows) ? rows : rows ? [rows] : [];

		return rowsArray.map((row) => plainToInstance(model, row));
	}

	/**
	 * Query a database, and on error return empty array with error logged
	 * @template T
	 * @param {string} mapperId - Mapper ID
	 * @param {Params} params - Query parameters
	 * @param {ClassConstructor<T>} model - Model class
	 * @return {Promise<T[]>}
	 */
	async selectAndCatchSilently<T>(mapperId: string, params: Params, model: ClassConstructor<T>): Promise<T[]> {
		try {
			return await this.selectList(mapperId, params, model);
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: intentional error logging
			console.error('[ERROR]: selectAndCatchSilently', error);
			return [];
		}
	}

	/**
	 * Execute INSERT, UPDATE, DELETE and return the number of affected rows
	 * @param {string} mapperId - Mapper ID
	 * @param {Params} params - Query parameters
	 * @return {Promise<number>} - Number of affected rows
	 */
	async execute(mapperId: string, params: Params = {}): Promise<number> {
		const { sql, values } = this.statement(mapperId, params);
		this.logStatement('Execute', mapperId, sql, values);

		if (this.dbType === DatabaseType.MYSQL) {
			// MySQL execution
			const [result] = await (this.connection as MySQLConnection).execute(sql, values);
			return (result as ResultSetHeader).affectedRows || 0;
		}

		// Oracle execution
		const result = await (this.connection as OracleConnection).execute(sql, values, {
			outFormat: (await import('oracledb')).OUT_FORMAT_OBJECT,
		});
		return result.rowsAffected || 0;
	}

	/**
	 * Get the database connection object
	 * @return {DatabaseConnection}
	 */
	get getConnection(): DatabaseConnection {
		return this.connection;
	}

	/**
	 * End the database connection
	 * @return {Promise<void>}
	 */
	async end(): Promise<void> {
		if (this.dbType === DatabaseType.MYSQL) {
			await (this.connection as MySQLConnection).end();
		} else {
			await (this.connection as OracleConnection).close();
		}
	}

	/**
	 * Begin a transaction (different implementation for MySQL and Oracle)
	 * @returns {Promise<void>}
	 */
	async beginTransaction(): Promise<void> {
		if (this.dbType === DatabaseType.MYSQL) {
			await (this.connection as MySQLConnection).beginTransaction();
		}
		// Oracle doesn't have an explicit beginTransaction - transactions start implicitly
	}

	/**
	 * Commit a transaction
	 * @returns {Promise<void>}
	 */
	async commit(): Promise<void> {
		if (this.dbType === DatabaseType.MYSQL) {
			await (this.connection as MySQLConnection).commit();
		} else {
			await (this.connection as OracleConnection).commit();
		}
	}

	/**
	 * Rollback a transaction
	 * @returns {Promise<void>}
	 */
	async rollback(): Promise<void> {
		if (this.dbType === DatabaseType.MYSQL) {
			await (this.connection as MySQLConnection).rollback();
		} else {
			await (this.connection as OracleConnection).rollback();
		}
	}

	/**
	 * Render a statement with its `#{}` values as bound parameters
	 * @param {string} mapperId - Mapper ID
	 * @param {Params} params - Query parameters
	 * @return {BoundStatement} - SQL with placeholders (`?` for MySQL, `:n` for Oracle) and the values to bind
	 */
	private statement(mapperId: string, params: Params): BoundStatement {
		const placeholder = this.dbType === DatabaseType.MYSQL ? () => '?' : (position: number) => `:${position}`;

		try {
			return renderBoundStatement(this.boundNamespace, mapperId, params, placeholder, FORMAT);
		} catch (err) {
			throw {
				error: err,
				message: `[ERROR]: MyBatis.getStatement for namespace: ${this.namespace} & mapperID: ${mapperId}.`,
			};
		}
	}

	private logStatement(kind: string, mapperId: string, sql: string, values: BoundStatement['values']) {
		if (!this.debugMode) {
			return;
		}
		// Only the number of values is logged, as they may be personal data
		// biome-ignore lint/suspicious/noConsole: intentional info logging
		console.log(`*** ${kind} for namespace: ${this.namespace} & mapperID: ${mapperId} ***`);
		// biome-ignore lint/suspicious/noConsole: intentional info logging
		console.log(sql);
		// biome-ignore lint/suspicious/noConsole: intentional info logging
		console.log(`(${values.length} bound value${values.length === 1 ? '' : 's'})`);
		// biome-ignore lint/suspicious/noConsole: intentional info logging
		console.log('\n***');
	}

	/**
	 * Get the database type based on the connection object
	 * @returns {DatabaseType}
	 */
	private get dbType(): DatabaseType {
		return 'beginTransaction' in this.connection ? DatabaseType.MYSQL : DatabaseType.ORACLE;
	}
}
