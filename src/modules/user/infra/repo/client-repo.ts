import { eq } from "drizzle-orm";
import type { RegionalDb } from "../../../../shared/domain/db-types.js";
import { clients } from "../schema.regional.js";
import type { ClientProfile } from "../../domain/entities.js";
import type { ClientRepository } from "../../domain/repos.js";
import { toClientInsert } from "./converters.js";

export class ClientRepositoryImpl implements ClientRepository {
    async findByUserId(db: RegionalDb, userId: number): Promise<ClientProfile | null> {
        const [row] = await db.select().from(clients).where(eq(clients.userId, userId)).limit(1);
        return row || null;
    }

    async upsert(
        db: RegionalDb,
        userId: number,
        profile: Partial<ClientProfile>
    ): Promise<ClientProfile> {
        const [row] = await db
            .insert(clients)
            .values(toClientInsert(userId, profile))
            .onConflictDoUpdate({
                target: clients.userId,
                set: {
                    ...profile,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return row;
    }
}
