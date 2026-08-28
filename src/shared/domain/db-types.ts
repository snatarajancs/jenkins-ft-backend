import type { drizzle } from "drizzle-orm/postgres-js";

export type GlobalDb = ReturnType<typeof drizzle>;

export type RegionalDb = ReturnType<typeof drizzle>;

export interface DbContext {
    readonly regional: RegionalDb;
    readonly global: GlobalDb;
}
