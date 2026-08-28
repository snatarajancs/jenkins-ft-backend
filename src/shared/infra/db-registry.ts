import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { GlobalDb, RegionalDb } from "../domain/db-types.js";
import type { RegionConfig } from "./config.js";
import type { RegionId } from "../domain/types.js";
import { toRegionId } from "../domain/types.js";

export class RegionalDatabaseRegistry {
    private readonly globalDb: GlobalDb;
    private readonly regionalDbs = new Map<number, RegionalDb>();

    constructor(globalDb: GlobalDb) {
        this.globalDb = globalDb;
    }

    getGlobalDb(): GlobalDb {
        return this.globalDb;
    }

    getRegionalDb(regionId: RegionId): RegionalDb {
        const db = this.regionalDbs.get(regionId);
        if (!db) {
            throw new Error(
                `RegionalDatabaseRegistry: no database registered for region ${regionId}. ` +
                    `Registered regions: [${[...this.regionalDbs.keys()].join(", ")}]`,
            );
        }
        return db;
    }

    setRegionalDb(regionId: RegionId, db: RegionalDb): void {
        this.regionalDbs.set(regionId, db);
    }

    hasRegion(regionId: RegionId): boolean {
        return this.regionalDbs.has(regionId);
    }

    getAllRegionalDbs(): ReadonlyMap<number, RegionalDb> {
        return this.regionalDbs;
    }

    initFromConfig(
        configs: RegionConfig[],
        _regionalSchema: Record<string, unknown>,
        maxConnections = 10,
    ): void {
        for (const cfg of configs) {
            const client = postgres(cfg.dbUrl, { max: maxConnections });
            const db = drizzle({ client }) as unknown as RegionalDb;
            this.regionalDbs.set(toRegionId(cfg.regionId), db);
        }
    }

    async closeAll(): Promise<void> {
        const tryClose = async (db: GlobalDb | RegionalDb) => {
            const client = (db as unknown as { $client?: { end?: () => Promise<void> } }).$client;
            if (client?.end) {
                await client.end().catch(() => undefined);
            }
        };
        await tryClose(this.globalDb);
        for (const db of this.regionalDbs.values()) {
            await tryClose(db);
        }
    }
}

export function createGlobalDatabase(
    connectionString: string,
    _globalSchema: Record<string, unknown>,
    maxConnections = 10,
): GlobalDb {
    const client = postgres(connectionString, { max: maxConnections });
    return drizzle({ client }) as unknown as GlobalDb;
}

export function createRegionalDatabase(
    connectionString: string,
    _regionalSchema: Record<string, unknown>,
    maxConnections = 10,
): RegionalDb {
    const client = postgres(connectionString, { max: maxConnections });
    return drizzle({ client }) as unknown as RegionalDb;
}
