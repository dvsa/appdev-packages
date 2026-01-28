import { bigint, decimal, index, mysqlSchema, primaryKey, text, unique, varchar } from 'drizzle-orm/mysql-core';
import { formatSchemaName } from '../helper/format-schema-name';

export const testStation = mysqlSchema(formatSchemaName('test_facility')).table(
	'test_station',
	{
		id: bigint({ mode: 'number', unsigned: true }).autoincrement().primaryKey(),
		dynamicsTestStationId: varchar('dynamics_test_station_id', { length: 36 }),
		accessNotes: text('access_notes'),
		address: varchar({ length: 100 }),
		contactNumber: varchar('contact_number', { length: 30 }),
		country: varchar({ length: 30 }),
		emailAddressesJson: varchar('email_addresses_json', { length: 2000 }),
		generalNotes: text('general_notes'),
		latitude: decimal({ precision: 9, scale: 6 }),
		longitude: decimal({ precision: 9, scale: 6 }),
		name: varchar({ length: 160 }),
		pNumber: varchar('p_number', { length: 256 }),
		postcode: varchar({ length: 20 }),
		status: varchar({ length: 21 }),
		town: varchar({ length: 30 }),
		type: varchar({ length: 4 }),
	},
	(table) => [
		index('idx_p_number_idx').on(table.pNumber),
		primaryKey({ columns: [table.id], name: 'test_station_id' }),
		unique('idx_dynamics_test_station_id_uq').on(table.dynamicsTestStationId),
	]
);
