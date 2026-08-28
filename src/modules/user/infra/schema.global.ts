import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const skillLevels = pgTable("skill_levels", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
