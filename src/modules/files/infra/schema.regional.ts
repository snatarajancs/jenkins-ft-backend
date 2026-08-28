import { pgTable, serial, integer, varchar, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { FILE_SCOPE_VALUES, FILE_STATUS_VALUES } from "../domain/enums.js";

export const fileScopeEnum = pgEnum("file_scope", FILE_SCOPE_VALUES);
export const fileStatusEnum = pgEnum("file_status", FILE_STATUS_VALUES);
export const files = pgTable(
    "files",
    {
        id: serial("id").primaryKey(),
        userId: integer("user_id").notNull(),
        scope: fileScopeEnum("scope").notNull(),
        status: fileStatusEnum("status").notNull().default("pending"),
        objectKey: varchar("object_key", { length: 500 }).notNull().unique(),
        mimeType: varchar("mime_type", { length: 100 }).notNull(),
        sizeBytes: integer("size_bytes").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
    },
    (t) => [
        index("files_user_id_idx").on(t.userId),
        index("files_scope_idx").on(t.scope),
    ]
);
