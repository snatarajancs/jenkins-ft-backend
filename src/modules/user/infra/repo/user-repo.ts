import { eq } from "drizzle-orm";
import type { RegionalDb } from "../../../../shared/domain/db-types.js";
import type { Role } from "../../../auth/domain/roles.js";
import type { AccountStatus } from "../../domain/entities.js";
import type { UserRepository } from "../../domain/repos.js";
import { users, clients, engineers } from "../schema.regional.js";

export class UserRepositoryImpl implements UserRepository {
    async getUserRole(db: RegionalDb, userId: number): Promise<Role | null> {
        const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
        return row?.role ?? null;
    }

    async updateAccountStatus(db: RegionalDb, userId: number, role: Role, status: AccountStatus, reason: string | null): Promise<void> {
        if (role === "client") {
            await db.update(clients).set({ accountStatus: status, statusReason: reason }).where(eq(clients.userId, userId));
        } else if (role === "engineer") {
            await db.update(engineers).set({ accountStatus: status, statusReason: reason }).where(eq(engineers.userId, userId));
        }
    }
}
