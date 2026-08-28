import { pgTable, serial, varchar, timestamp, integer } from "drizzle-orm/pg-core";

export const userRegionMap = pgTable("user_region_map", {
    id: serial("id").primaryKey(),
    emailHash: varchar("email_hash", { length: 64 }).notNull().unique(),
    regionId: integer("region_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});
