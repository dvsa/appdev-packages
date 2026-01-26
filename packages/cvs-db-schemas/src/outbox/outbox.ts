import { sql } from 'drizzle-orm';
import { bigint, datetime, index, int, mysqlEnum, mysqlSchema, primaryKey, text, unique } from 'drizzle-orm/mysql-core';
import { formatSchemaName } from '../helper/format-schema-name';

export const outbox = mysqlSchema(formatSchemaName('outbox')).table(
	'outbox',
	{
		id: bigint({ mode: 'number', unsigned: true }).autoincrement().primaryKey(),
		eventType: mysqlEnum('event_type', ['created', 'updated', 'deleted']).notNull(),
		aggregateType: mysqlEnum('aggregate_type', ['activity', 'tech-record', 'test-result', 'test-station']).notNull(),
		payload: text('payload').notNull(),
		status: mysqlEnum('status', ['pending', 'completed', 'failed']).notNull().default('pending'),
		attemptCount: int('attempt_count').notNull().default(0),
		createdAt: datetime('created_at', { mode: 'string', fsp: 3 }).default(sql`(CURRENT_TIMESTAMP(3))`),
		completedAt: datetime('completed_at'),
		errorMessage: text('error_message'),
	},
	(table) => [
		unique('uq_outbox_aggregate_id_event').on(table.aggregateType, table.id, table.eventType),
		index('idx_outbox_status_created_at').on(table.status, table.createdAt),
		index('idx_outbox_event_type').on(table.eventType),
		index('idx_outbox_aggregate_type').on(table.aggregateType),
		primaryKey({ columns: [table.id], name: 'outbox_id' }),
	]
);
