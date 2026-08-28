import type { DbContext, GlobalDb, RegionalDb } from "../domain/db-types.js";
import type { UnitOfWork } from "../domain/unit-of-work.js";
import type { RegionalDatabaseRegistry } from "./db-registry.js";
import type { AppContext } from "./context.js";
import { getDbCtx, getOptionalRegionId } from "./context.js";
import type { RegionId } from "../domain/types.js";

export class UnitOfWorkImpl implements UnitOfWork {
    private registry: RegionalDatabaseRegistry | null = null;

    setRegistry(registry: RegionalDatabaseRegistry): void {
        this.registry = registry;
    }

    private requireRegistry(): RegionalDatabaseRegistry {
        if (!this.registry) {
            throw new Error("UnitOfWork: registry not initialized. Call setRegistry() first.");
        }
        return this.registry;
    }

    getRegionalDb(c?: AppContext, regionId?: RegionId): RegionalDb {
        const reg = this.requireRegistry();
        if (regionId !== undefined) return reg.getRegionalDb(regionId);
        const homeRegionId = c ? getOptionalRegionId(c) : undefined;
        if (typeof homeRegionId === "number" && homeRegionId > 0) return reg.getRegionalDb(homeRegionId);
        throw new Error(
            "UnitOfWork.getRegionalDb(): no region could be determined. " +
                "Ensure the request includes a valid JWT with regionId, or provide an explicit numeric regionId.",
        );
    }

    getAllRegionalDbs(): ReadonlyMap<number, RegionalDb> {
        return this.requireRegistry().getAllRegionalDbs();
    }

    getGlobalDb(): GlobalDb {
        return this.requireRegistry().getGlobalDb();
    }

    async transaction<T>(
        c: AppContext | undefined | null,
        fn: (ctx: DbContext) => Promise<T>,
        regionId?: RegionId,
    ): Promise<T> {
        const existingCtx = c ? getDbCtx(c) : undefined;
        if (existingCtx) return fn(existingCtx);
        const globalDb = this.getGlobalDb();
        const regionalDb = this.getRegionalDb(c ?? undefined, regionId);
        return regionalDb.transaction(async (tx) => {
            const ctx: DbContext = {
                regional: tx as unknown as RegionalDb,
                global: globalDb,
            };
            if (c) c.set("dbCtx", ctx);
            try {
                return await fn(ctx);
            } finally {
                if (c) c.set("dbCtx", undefined);
            }
        });
    }

    async globalTransaction<T>(fn: (db: GlobalDb) => Promise<T>): Promise<T> {
        const db = this.getGlobalDb();
        return db.transaction(async (tx) => fn(tx as unknown as GlobalDb));
    }
}
