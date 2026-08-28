import type { GlobalDb, RegionalDb, DbContext } from "./db-types.js";
import type { AppContext } from "../infra/context.js";
import type { RegionId } from "./types.js";

export interface UnitOfWork {
    getRegionalDb(c?: AppContext, regionId?: RegionId): RegionalDb;

    getGlobalDb(): GlobalDb;

    transaction<T>(
        c: AppContext | undefined | null,
        fn: (ctx: DbContext) => Promise<T>,
        regionId?: RegionId,
    ): Promise<T>;

    globalTransaction<T>(fn: (db: GlobalDb) => Promise<T>): Promise<T>;

    getAllRegionalDbs(): ReadonlyMap<number, RegionalDb>;
}
