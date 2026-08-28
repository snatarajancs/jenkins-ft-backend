import {
    pgTable,
    serial,
    varchar,
    timestamp,
    integer,
} from "drizzle-orm/pg-core";

export const refreshTokens = pgTable("refresh_tokens", {
    id: serial("id").primaryKey(),
    regionId: integer("region_id").notNull(),
    userId: integer("user_id").notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
