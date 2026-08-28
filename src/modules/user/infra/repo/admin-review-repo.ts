import { eq, desc, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { toUserId } from "../../../../shared/domain/types.js";
import type { RegionalDb } from "../../../../shared/domain/db-types.js";
import { clients, engineers, users } from "../../../user/infra/schema.regional.js";
import type { PendingProfile, PaginatedPendingProfiles, ProfileStatusCounts } from "../../domain/entities.js";
import type { AccountStatus } from "../../../user/domain/entities.js";
import type { ReviewableRole } from "../../../auth/domain/roles.js";
import type { AdminReviewRepository } from "../../domain/repos.js";

type ProfileCountRow = { status: AccountStatus; count: number };

export class AdminReviewRepositoryImpl implements AdminReviewRepository {
    async getPendingProfiles(db: RegionalDb, status?: AccountStatus, role?: ReviewableRole, page: number = 1, limit: number = 10): Promise<PaginatedPendingProfiles> {
        const offset = (page - 1) * limit;

        const getBaseQuery = (table: typeof clients | typeof engineers) => {
            let query = db.select({
                userId: table.userId,
                email: users.email,
                role: users.role,
                firstName: table.firstName,
                lastName: table.lastName,
                accountStatus: table.accountStatus,
                submittedAt: table.createdAt,
            }).from(table).innerJoin(users, eq(table.userId, users.id));
            
            if (status) {
                query = query.where(eq(table.accountStatus, status)) as typeof query;
            }
            return query;
        };

        const clientsQuery = getBaseQuery(clients);
        const engineersQuery = getBaseQuery(engineers);

        let finalQuery;
        if (role === "client") {
            finalQuery = clientsQuery;
        } else if (role === "engineer") {
            finalQuery = engineersQuery;
        } else {
            finalQuery = unionAll(clientsQuery, engineersQuery);
        }

        const profiles = await finalQuery
            .orderBy(desc(sql`created_at`))
            .limit(limit)
            .offset(offset);

        // Get counts
        const getCountQuery = (table: typeof clients | typeof engineers) => {
            let q = db.select({ status: table.accountStatus, count: sql<number>`count(*)::int` }).from(table);
            if (status) {
                q = q.where(eq(table.accountStatus, status)) as typeof q;
            }
            return q.groupBy(table.accountStatus);
        };

        const countRows: ProfileCountRow[] = [];
        if (!role || role === "client") {
            countRows.push(...(await getCountQuery(clients)) as ProfileCountRow[]);
        }
        if (!role || role === "engineer") {
            countRows.push(...(await getCountQuery(engineers)) as ProfileCountRow[]);
        }

        const counts: ProfileStatusCounts = { pending: 0, inProgress: 0, completed: 0, rejected: 0 };
        let total = 0;
        
        for (const row of countRows) {
            total += row.count;
            if (row.status === "submitted") counts.pending += row.count;
            else if (row.status === "in_progress") counts.inProgress += row.count;
            else if (row.status === "bgv_completed" || row.status === "verified") counts.completed += row.count;
            else if (row.status === "rejected") counts.rejected += row.count;
        }

        const mappedProfiles: PendingProfile[] = profiles.map((row) => ({
            userId: toUserId(row.userId),
            email: row.email,
            role: row.role as ReviewableRole | "admin",
            firstName: row.firstName,
            lastName: row.lastName,
            accountStatus: row.accountStatus as AccountStatus,
            submittedAt: row.submittedAt ? new Date(row.submittedAt) : new Date(),
        }));

        return { profiles: mappedProfiles, total, page, limit, counts };
    }
}
