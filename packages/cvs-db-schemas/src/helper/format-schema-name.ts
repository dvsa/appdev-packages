/**
 * Format schema name to append a branch identifier if on a CB2 branch
 * @param {string} baseSchemaName
 * @return {string} Formatted schema name
 *
 * @examples
 * process.env.BRANCH = 'prod'
 * const schema = formatSchemaName('test_facility');
 * // test_facility
 *
 * process.env.BRANCH = 'cb2-1234'
 * const schema = formatSchemaName('test_facility');
 * // test_facility_CB21234
 */
export const formatSchemaName = (baseSchemaName: string): string => {
	return process.env.BRANCH?.includes('cb2')
		? `${baseSchemaName}_${process.env.BRANCH.toUpperCase().replace('-', '')}`
		: baseSchemaName;
};
