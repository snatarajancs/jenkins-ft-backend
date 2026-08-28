import { pgTable, uuid, varchar, jsonb, timestamp, pgEnum, integer, index } from "drizzle-orm/pg-core";

export const outboxStatusEnum = pgEnum("outbox_status", [
    "pending",
    "processing",
    "processed",
    "failed",
    "retryable",
]);

export const outboxEvents = pgTable("outbox_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    type: varchar("type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    error: varchar("error", { length: 500 }),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
    nextRetryAt: timestamp("next_retry_at"),
}, (table) => {
    return {
        statusCreatedAtIndex: index("outbox_status_created_at_idx").on(table.status, table.createdAt),
    };
});
