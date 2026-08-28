import { eq } from "drizzle-orm";
import type { GlobalDb } from "../../../../shared/domain/db-types.js";
import { userRegionMap } from "../schema.global.js";
import type { UserRegionMap, UserRegionMapRepository } from "../../domain/repos.js";
import { toRegionId } from "../../../../shared/domain/types.js";
import type { RegionId } from "../../../../shared/domain/types.js";

export class UserRegionMapRepositoryImpl implements UserRegionMapRepository {
    async findByEmailHash(db: GlobalDb, emailHash: string): Promise<UserRegionMap | null> {
        const rows = await db
            .select()
            .from(userRegionMap)
            .where(eq(userRegionMap.emailHash, emailHash))
            .limit(1);
        if (rows.length === 0) return null;
        const row = rows[0];
        return { id: row.id, emailHash: row.emailHash, regionId: toRegionId(row.regionId) };
    }

    async create(db: GlobalDb, data: { emailHash: string; regionId: RegionId }): Promise<UserRegionMap> {
        const [row] = await db
            .insert(userRegionMap)
            .values({ emailHash: data.emailHash, regionId: data.regionId })
            .returning();
        return { id: row.id, emailHash: row.emailHash, regionId: toRegionId(row.regionId) };
    }
}
