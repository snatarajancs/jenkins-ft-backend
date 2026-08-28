import { eq } from "drizzle-orm";
import type { RegionalDb } from "../../../../shared/domain/db-types.js";
import { refreshTokens } from "../schema.regional.js";
import type { RefreshToken, CreateRefreshTokenInput } from "../../domain/entities.js";
import type { RefreshTokenRepository } from "../../domain/repos.js";
import { toUserId, toRegionId } from "../../../../shared/domain/types.js";
import type { UserId } from "../../../../shared/domain/types.js";

export class RefreshTokenRepositoryImpl implements RefreshTokenRepository {
    async create(db: RegionalDb, data: CreateRefreshTokenInput): Promise<RefreshToken> {
        const [row] = await db
            .insert(refreshTokens)
            .values({
                regionId: data.regionId,
                userId: data.userId,
                token: data.token,
                expiresAt: data.expiresAt,
            })
            .returning();
        return {
            id: row.id,
            regionId: toRegionId(row.regionId),
            userId: toUserId(row.userId),
            token: row.token,
            expiresAt: row.expiresAt,
            createdAt: row.createdAt,
        };
    }

    async findByToken(db: RegionalDb, token: string): Promise<RefreshToken | null> {
        const rows = await db
            .select()
            .from(refreshTokens)
            .where(eq(refreshTokens.token, token))
            .limit(1);
        if (rows.length === 0) return null;
        const row = rows[0];
        return {
            id: row.id,
            regionId: toRegionId(row.regionId),
            userId: toUserId(row.userId),
            token: row.token,
            expiresAt: row.expiresAt,
            createdAt: row.createdAt,
        };
    }

    async deleteByUserId(db: RegionalDb, userId: UserId): Promise<void> {
        await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    }
}
