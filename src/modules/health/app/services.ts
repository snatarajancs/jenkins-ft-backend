import { sql } from "drizzle-orm";
import type { UnitOfWork } from "../../../shared/domain/unit-of-work.js";
import type { GlobalDb } from "../../../shared/domain/db-types.js";
import type { DbHealthResult, DbStatus } from "../domain/health-types.js";

export interface HealthService {
    checkDbHealth(): Promise<DbHealthResult>;
}

export class HealthServiceImpl implements HealthService {
    constructor(private readonly uow: UnitOfWork) {}

    async checkDbHealth(): Promise<DbHealthResult> {
        const global = await this.pingDb(this.uow.getGlobalDb());
        const regional: Record<string, DbStatus> = {};
        let allHealthy = global === "ok";

        for (const [regionId, db] of this.uow.getAllRegionalDbs()) {
            const status = await this.pingDb(db);
            regional[String(regionId)] = status;
            if (status !== "ok") allHealthy = false;
        }

        return { global, regional, allHealthy };
    }

    private async pingDb(db: GlobalDb): Promise<DbStatus> {
        try {
            await db.execute(sql`SELECT 1`);
            return "ok";
        } catch {
            return "error";
        }
    }
}
