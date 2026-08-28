import { eq, and } from "drizzle-orm";
import type { RegionalDb } from "../../../../shared/domain/db-types.js";
import { users } from "../../../user/infra/schema.regional.js";
import type { User, CreateUserInput } from "../../domain/entities.js";
import type { UserRepository } from "../../domain/repos.js";
import { toUserId, toRegionId } from "../../../../shared/domain/types.js";
import type { UserId } from "../../../../shared/domain/types.js";

export class UserRepositoryImpl implements UserRepository {
    async create(db: RegionalDb, data: CreateUserInput): Promise<User> {
        const [row] = await db
            .insert(users)
            .values({
                regionId: data.regionId,
                email: data.email,
                passwordHash: data.passwordHash,
                role: data.role,
                isActive: data.isActive,
            })
            .returning();
        return {
            id: toUserId(row.id),
            regionId: toRegionId(row.regionId),
            email: row.email,
            passwordHash: row.passwordHash,
            role: row.role as User["role"],
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    async findBy(db: RegionalDb, filter: { email?: string; id?: UserId }): Promise<User | null> {
        const conditions = [];
        if (filter.id !== undefined) conditions.push(eq(users.id, filter.id));
        if (filter.email !== undefined) conditions.push(eq(users.email, filter.email));
        if (conditions.length === 0) return null;

        const rows = await db.select().from(users).where(and(...conditions)).limit(1);
        if (rows.length === 0) return null;
        const row = rows[0];
        return {
            id: toUserId(row.id),
            regionId: toRegionId(row.regionId),
            email: row.email,
            passwordHash: row.passwordHash,
            role: row.role as User["role"],
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
}
