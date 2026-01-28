import { sql } from 'drizzle-orm';
import { bigint, datetime, foreignKey, index, mysqlSchema, primaryKey, unique, varchar } from 'drizzle-orm/mysql-core';
import { formatSchemaName } from '../helper/format-schema-name';

export const activity = mysqlSchema(formatSchemaName('test_facility')).table(
	'activity',
	{
		id: bigint({ mode: 'number', unsigned: true }).autoincrement().primaryKey(),
		activityUuid: varchar('activity_uuid', { length: 36 }),
		testerStaffId: varchar('tester_staff_id', { length: 40 }),
		testerStaffName: varchar('tester_staff_name', { length: 100 }),
		testerStaffEmail: varchar('tester_staff_email', { length: 200 }),
		testStationId: bigint('test_station_id', { mode: 'number', unsigned: true }).notNull(),
		parentActivityId: bigint('parent_activity_id', { mode: 'number', unsigned: true }),
		activityType: varchar('activity_type', { length: 50 }),
		startDatetime: datetime('start_datetime', { mode: 'string', fsp: 3 }),
		endDatetime: datetime('end_datetime', { mode: 'string', fsp: 3 }),
		waitReason: varchar('wait_reason', { length: 150 }),
		notes: varchar({ length: 500 }),
		closureReason: varchar('closure_reason', { length: 20 }),
		createdById: varchar('created_by_id', { length: 40 }),
		createdByName: varchar('created_by_name', { length: 200 }),
		insertedDatetime: datetime('inserted_datetime', { mode: 'string', fsp: 3 }).default(sql`(CURRENT_TIMESTAMP(3))`),
		lastUpdatedById: varchar('last_updated_by_id', { length: 40 }),
		lastUpdatedByName: varchar('last_updated_by_name', { length: 200 }),
		lastUpdatedDatetime: datetime('last_updated_datetime', { mode: 'string', fsp: 3 }).default(
			sql`(CURRENT_TIMESTAMP(3))`
		),
	},
	(table) => [
		index('idx_test_station_id').on(table.testStationId),
		index('idx_tester_staff_id').on(table.testerStaffId),
		index('idx_activity_type').on(table.activityType),
		foreignKey({
			columns: [table.parentActivityId],
			foreignColumns: [table.id],
			name: 'fk_parent_activity_id',
		}),
		primaryKey({ columns: [table.id], name: 'activity_id' }),
		unique('idx_activity_uuid_uq').on(table.activityUuid),
	]
);
