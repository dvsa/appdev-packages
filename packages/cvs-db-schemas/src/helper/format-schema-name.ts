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
