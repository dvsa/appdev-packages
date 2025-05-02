import { type ClassConstructor, plainToInstance } from 'class-transformer';
import MyBatis, { type Params } from 'mybatis-mapper';
import type { Connection as MySQLConnection, ResultSetHeader } from 'mysql2/promise';
import type { Connection as OracleConnection } from 'oracledb';

type DatabaseConnection = MySQLConnection | OracleConnection;

export enum DatabaseType {
	MYSQL = 'mysql',
	ORACLE = 'oracle',
}

export class MyBatisSession {
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
	}

	/**
	 * Query a database (MySQL or Oracle)
	 * @param {string} mapperId - Mapper ID
	 * @param {Params} params - Query parameters
	 * @return {Promise<unknown[]>}
	 */
	async query(mapperId: string, params: Params = {}): Promise<unknown> {
		let query = '';

		try {
			query = MyBatis.getStatement(this.namespace, mapperId, params, {
				language: 'sql',
				indent: '  ',
			});
		} catch (err) {
			throw {
				error: err,
				message: `[ERROR]: MyBatis.getStatement for namespace: ${this.namespace} & mapperID: ${mapperId}.`,
			};
		}

		if (this.debugMode) {
			console.log(`*** Query for namespace: ${this.namespace} & mapperID: ${mapperId} ***`);
			console.log(query);
			console.log('\n***');
		}

		if (this.dbType === DatabaseType.MYSQL) {
			const [rows] = await (this.connection as MySQLConnection).query(query);
			return rows;
		}

		const result = await (this.connection as OracleConnection).execute(
			query,
			{},
			{ outFormat: (await import('oracledb')).OUT_FORMAT_OBJECT }
		);

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
		let query = '';

		try {
			query = MyBatis.getStatement(this.namespace, mapperId, params, {
				language: 'sql',
				indent: '  ',
			});
		} catch (err) {
			throw {
				error: err,
				message: `[ERROR]: MyBatis.getStatement for namespace: ${this.namespace} & mapperID: ${mapperId}.`,
			};
		}

		if (this.debugMode) {
			console.log(`*** Execute for namespace: ${this.namespace} & mapperID: ${mapperId} ***`);
			console.log(query);
			console.log('\n***');
		}

		if (this.dbType === DatabaseType.MYSQL) {
			// MySQL execution
			const [result] = await (this.connection as MySQLConnection).execute(query);
			return (result as ResultSetHeader).affectedRows || 0;
		}

		// Oracle execution
		const result = await (this.connection as OracleConnection).execute(
			query,
			{},
			{ outFormat: (await import('oracledb')).OUT_FORMAT_OBJECT }
		);
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
	 * Get the database type based on the connection object
	 * @returns {DatabaseType}
	 */
	private get dbType(): DatabaseType {
		return 'beginTransaction' in this.connection ? DatabaseType.MYSQL : DatabaseType.ORACLE;
	}
}
