import { sql } from 'drizzle-orm';
import {
	datetime,
	index,
	int,
	json,
	mysqlEnum,
	mysqlSchema,
	primaryKey,
	serial,
	text,
	unique,
} from 'drizzle-orm/mysql-core';
import { formatSchemaName } from '../helper/format-schema-name';

/**
 * @generated-schema-doc
 * Schema: `outbox` | Table: `outbox`
 *
 * | Column        | Type                                                   | Nullable | Constraints                |
 * | ------------- | ------------------------------------------------------ | -------- | -------------------------- |
 * | id            | bigint unsigned                                        | No       | PK, AUTO INC               |
 * | eventType     | enum(created, updated, deleted)                        | No       | NOT NULL                   |
 * | aggregateType | enum(activity, tech-record, test-result, test-station) | No       | NOT NULL                   |
 * | payload       | text                                                   | No       | NOT NULL                   |
 * | status        | enum(pending, completed, failed)                       | No       | NOT NULL, default: pending |
 * | attemptCount  | int                                                    | No       | NOT NULL, default: 0       |
 * | createdAt     | datetime(3)                                            | Yes      | default: CURRENT_TIMESTAMP |
 * | completedAt   | datetime                                               | Yes      |                            |
 * | errorMessage  | text                                                   | Yes      |                            |
 */
export const outbox = mysqlSchema(formatSchemaName('outbox')).table(
	'outbox',
	{
		id: serial().notNull().primaryKey(),
		eventType: mysqlEnum('event_type', ['created', 'updated', 'deleted']).notNull(),
		aggregateType: mysqlEnum('aggregate_type', ['activity', 'tech-record', 'test-result', 'test-station']).notNull(),
		payload: json().notNull(),
		status: mysqlEnum('status', ['pending', 'completed', 'failed']).notNull().default('pending'),
		attemptCount: int('attempt_count').notNull().default(0),
		createdAt: datetime('created_at', { mode: 'string', fsp: 3 }).default(sql`(now(3))`),
		updatedAt: datetime('updated_at', { mode: 'string', fsp: 3 }).default(sql`(now(3))`),
		errorMessage: text('error_message'),
		completedAt: datetime('completed_at'),
	},
	(table) => [
		unique('uq_outbox_aggregate_uuid_event').on(table.aggregateType, table.id, table.eventType),
		index('idx_outbox_status_created_at').on(table.status, table.createdAt),
		index('idx_outbox_event_type').on(table.eventType),
		index('idx_outbox_aggregate_type').on(table.aggregateType),
		primaryKey({ columns: [table.id], name: 'outbox_id' }),
	]
);
