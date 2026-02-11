import { sql } from 'drizzle-orm';
import type { MySqlColumn } from 'drizzle-orm/mysql-core';
import type { SQL } from 'drizzle-orm/sql/sql';

/**
 * Format schema name to append a branch identifier if on a CB2 branch
 * @param {string} baseSchemaName
 * @return {string} Formatted schema name
 *
 * @examples
 * process.env.BRANCH = 'prod';
 * const schema = formatSchemaName('test_facility');
 * console.log(schema); // test_facility
 *
 * process.env.BRANCH = 'cb2-1234';
 * const schema = formatSchemaName('test_facility');
 * console.log(schema); // test_facility_CB21234
 */
export const formatSchemaName = (baseSchemaName: string): string => {
	const branch = process.env.BRANCH?.toUpperCase();

	return branch?.includes('CB2') ? `${baseSchemaName}_${branch.replace('-', '')}` : baseSchemaName;
};

/**
 * Convert a MySQL column that uses 1/0 for boolean values into an actual boolean type in the query result
 * @param {MySqlColumn} column
 * @param {string} alias - Optional Alias, defaults back to `column.name` otherwise
 * @return {boolean}
 */
export const toBoolean = (column: MySqlColumn, alias: string | undefined = undefined): SQL.Aliased<boolean> =>
	sql<boolean>`IF(${column} = 1, CAST(TRUE AS JSON), CAST(FALSE AS JSON))`.as(alias ?? column.name);
