import { eq, ilike, and, or, desc, asc, gte, lte, count, isNull, isNotNull } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";
import type { RegionalDb } from "../../../../shared/domain/db-types.js";
import type { AdminUserRepository } from "../../domain/repos.js";
import type { AdminUserFilters, AdminUserListResult, AdminClientRecord, AdminEngineerRecord } from "../../domain/admin-types.js";
import { toUserId, toClientId } from "../../../../shared/domain/types.js";
import { users, clients, engineers } from "../schema.regional.js";
import { ROLES } from "../../../auth/domain/roles.js";
import { ADMIN_USER_FILTER_STATUS, ADMIN_USER_RECORD_STATUS, ENGINEER_JOB_MODE, type AdminUserFilterStatus, type AdminUserRecordStatus, type EngineerJobMode } from "../../domain/enums.js";

export class AdminUserRepositoryImpl implements AdminUserRepository {
    
    private getStatusCondition(status: AdminUserFilterStatus | undefined, profileIdColumn: PgColumn) {
        if (!status) return undefined;
        
        switch (status) {
            case ADMIN_USER_FILTER_STATUS.ACTIVE:
                return and(eq(users.isActive, true), profileIdColumn ? isNotNull(profileIdColumn) : undefined);
            case ADMIN_USER_FILTER_STATUS.SUSPENDED:
                return eq(users.isActive, false);
            case ADMIN_USER_FILTER_STATUS.PENDING:
                return and(eq(users.isActive, true), profileIdColumn ? isNull(profileIdColumn) : undefined);
            default:
                return undefined;
        }
    }

    async getAdminClients(db: RegionalDb, filters: AdminUserFilters): Promise<AdminUserListResult<AdminClientRecord>> {
        const { page, limit, search, status, location, startDate, endDate, sortBy, sortOrder } = filters;
        
        const conditions = [eq(users.role, ROLES.client)];
        
        if (filters.regionId) {
            conditions.push(eq(users.regionId, filters.regionId));
        }

        const statusCond = this.getStatusCondition(status, clients.id);
        if (statusCond) conditions.push(statusCond);

        if (location) {
            conditions.push(ilike(clients.city, `%${location}%`));
        }

        if (startDate) {
            conditions.push(gte(users.createdAt, new Date(startDate)));
        }

        if (endDate) {
            conditions.push(lte(users.createdAt, new Date(endDate)));
        }

        if (search) {
            conditions.push(
                or(
                    eq(users.email, search),
                    eq(clients.firstName, search),
                    eq(clients.lastName, search),
                    eq(clients.companyName, search)
                )!
            );
        }

        const whereCondition = and(...conditions);

        // Get total counts and distributions (unpaginated)
        const regionCond = filters.regionId ? eq(users.regionId, filters.regionId) : undefined;
        const baseCond = and(eq(users.role, ROLES.client), regionCond);

        const [totalCountResult] = await db.select({ count: count() }).from(users).where(baseCond);
        const totalCount = totalCountResult?.count ?? 0;

        const [activeResult] = await db.select({ count: count() }).from(users).leftJoin(clients, eq(clients.userId, users.id)).where(and(baseCond, eq(users.isActive, true), isNotNull(clients.id)));
        const active = activeResult?.count ?? 0;

        const [pendingResult] = await db.select({ count: count() }).from(users).leftJoin(clients, eq(clients.userId, users.id)).where(and(baseCond, eq(users.isActive, true), isNull(clients.id)));
        const pending = pendingResult?.count ?? 0;

        const [suspendedResult] = await db.select({ count: count() }).from(users).where(and(baseCond, eq(users.isActive, false)));
        const suspended = suspendedResult?.count ?? 0;

        // Apply filters for the actual data list to get filtered total
        const [filteredTotalResult] = await db
            .select({ count: count() })
            .from(users)
            .leftJoin(clients, eq(clients.userId, users.id))
            .where(whereCondition);
            
        const filteredTotal = filteredTotalResult?.count || 0;

        let orderByCond;
        const dir = sortOrder === "asc" ? asc : desc;
        switch (sortBy) {
            case "name":
                orderByCond = dir(clients.firstName);
                break;
            case "companyName":
                orderByCond = dir(clients.companyName);
                break;
            case "joinedAt":
                orderByCond = dir(users.createdAt);
                break;
            default:
                orderByCond = dir(users.createdAt);
        }

        const data = await db
            .select({
                userId: users.id,
                clientId: clients.id,
                email: users.email,
                isActive: users.isActive,
                createdAt: users.createdAt,
                firstName: clients.firstName,
                middleName: clients.middleName,
                lastName: clients.lastName,
                companyName: clients.companyName,
                city: clients.city,
                hasProfile: isNotNull(clients.id),
            })
            .from(users)
            .leftJoin(clients, eq(clients.userId, users.id))
            .where(whereCondition)
            .orderBy(orderByCond)
            .limit(limit)
            .offset((page - 1) * limit);

        const mappedData: AdminClientRecord[] = data.map((row) => {
            let derivedStatus: AdminUserRecordStatus = ADMIN_USER_RECORD_STATUS.PENDING;
            if (!row.isActive) derivedStatus = ADMIN_USER_RECORD_STATUS.SUSPENDED;
            else if (row.hasProfile) derivedStatus = ADMIN_USER_RECORD_STATUS.ACTIVE;

            const nameParts = [row.firstName, row.middleName, row.lastName].filter(Boolean);
            const defaultName = row.hasProfile ? "Unnamed" : "Pending Profile";
            const name = nameParts.length > 0 ? nameParts.join(" ") : defaultName;

            return {
                userId: toUserId(row.userId),
                clientId: row.clientId ? toClientId(row.clientId) : null,
                name: name,
                companyName: row.companyName || "-",
                email: row.email,
                location: row.city || "Pending",
                jobsCount: 0,
                status: derivedStatus,
                joinedAt: row.createdAt.toISOString()
            };
        });

        return {
            data: mappedData,
            summary: {
                totalCount,
                activeCount: active,
                suspendedCount: suspended,
                activityDistribution: {
                    active,
                    inactive: pending,
                    suspended
                }
            },
            pagination: {
                total: filteredTotal,
                page,
                limit,
                totalPages: Math.ceil(filteredTotal / limit)
            }
        };
    }

    async getAdminEngineers(db: RegionalDb, filters: AdminUserFilters): Promise<AdminUserListResult<AdminEngineerRecord>> {
        const { page, limit, search, status, location, startDate, endDate, sortBy, sortOrder } = filters;
        
        const conditions = [eq(users.role, ROLES.engineer)];
        
        if (filters.regionId) {
            conditions.push(eq(users.regionId, filters.regionId));
        }

        const statusCond = this.getStatusCondition(status, engineers.id);
        if (statusCond) conditions.push(statusCond);

        if (location) {
            conditions.push(ilike(engineers.city, `%${location}%`));
        }

        if (startDate) {
            conditions.push(gte(users.createdAt, new Date(startDate)));
        }

        if (endDate) {
            conditions.push(lte(users.createdAt, new Date(endDate)));
        }

        if (search) {
            conditions.push(
                or(
                    eq(users.email, search),
                    eq(engineers.firstName, search),
                    eq(engineers.lastName, search)
                )!
            );
        }

        const whereCondition = and(...conditions);

        // Get total counts and distributions (unpaginated)
        const regionCond = filters.regionId ? eq(users.regionId, filters.regionId) : undefined;
        const baseCond = and(eq(users.role, ROLES.engineer), regionCond);

        const [totalCountResult] = await db.select({ count: count() }).from(users).where(baseCond);
        const totalCount = totalCountResult?.count ?? 0;

        const [activeResult] = await db.select({ count: count() }).from(users).leftJoin(engineers, eq(engineers.userId, users.id)).where(and(baseCond, eq(users.isActive, true), isNotNull(engineers.id)));
        const active = activeResult?.count ?? 0;

        const [pendingResult] = await db.select({ count: count() }).from(users).leftJoin(engineers, eq(engineers.userId, users.id)).where(and(baseCond, eq(users.isActive, true), isNull(engineers.id)));
        const pending = pendingResult?.count ?? 0;

        const [suspendedResult] = await db.select({ count: count() }).from(users).where(and(baseCond, eq(users.isActive, false)));
        const suspended = suspendedResult?.count ?? 0;

        const [filteredTotalResult] = await db
            .select({ count: count() })
            .from(users)
            .leftJoin(engineers, eq(engineers.userId, users.id))
            .where(whereCondition);
            
        const filteredTotal = filteredTotalResult?.count || 0;

        let orderByCond;
        const dir = sortOrder === "asc" ? asc : desc;
        switch (sortBy) {
            case "name":
                orderByCond = dir(engineers.firstName);
                break;
            case "joinedAt":
                orderByCond = dir(users.createdAt);
                break;
            default:
                orderByCond = dir(users.createdAt);
        }

        const data = await db
            .select({
                userId: users.id,
                email: users.email,
                isActive: users.isActive,
                createdAt: users.createdAt,
                firstName: engineers.firstName,
                middleName: engineers.middleName,
                lastName: engineers.lastName,
                city: engineers.city,
                hasProfile: isNotNull(engineers.id),
                fullTime: engineers.fullTime,
                remote: engineers.remote,
            })
            .from(users)
            .leftJoin(engineers, eq(engineers.userId, users.id))
            .where(whereCondition)
            .orderBy(orderByCond)
            .limit(limit)
            .offset((page - 1) * limit);

        const mappedData: AdminEngineerRecord[] = data.map((row) => {
            let derivedStatus: AdminUserRecordStatus = ADMIN_USER_RECORD_STATUS.PENDING;
            if (!row.isActive) derivedStatus = ADMIN_USER_RECORD_STATUS.SUSPENDED;
            else if (row.hasProfile) derivedStatus = ADMIN_USER_RECORD_STATUS.ACTIVE;

            const nameParts = [row.firstName, row.middleName, row.lastName].filter(Boolean);
            const defaultName = row.hasProfile ? "Unnamed" : "Pending Profile";
            const name = nameParts.length > 0 ? nameParts.join(" ") : defaultName;

            let jobMode: EngineerJobMode | null = null;
            if (row.hasProfile && row.fullTime !== null) {
                if (row.fullTime) {
                    jobMode = ENGINEER_JOB_MODE.FULL_TIME;
                } else if (row.remote) {
                    jobMode = ENGINEER_JOB_MODE.FREELANCER;
                } else {
                    jobMode = ENGINEER_JOB_MODE.PART_TIME;
                }
            }

            return {
                userId: toUserId(row.userId),
                name: name,
                jobMode,
                email: row.email,
                location: row.city || "Pending",
                jobsCount: 0,
                status: derivedStatus,
                joinedAt: row.createdAt.toISOString()
            };
        });

        return {
            data: mappedData,
            summary: {
                totalCount,
                activeCount: active,
                suspendedCount: suspended,
                activityDistribution: {
                    active,
                    inactive: pending,
                    suspended
                }
            },
            pagination: {
                total: filteredTotal,
                page,
                limit,
                totalPages: Math.ceil(filteredTotal / limit)
            }
        };
    }

    async getAdminLocations(db: RegionalDb, role: typeof ROLES.client | typeof ROLES.engineer): Promise<string[]> {
        const table = role === ROLES.client ? clients : engineers;
        const results = await db
            .selectDistinct({ location: table.city })
            .from(table)
            .where(isNotNull(table.city));
        return results.map((r) => r.location as string);
    }

    async updateUserActiveStatus(db: RegionalDb, userId: number, isActive: boolean): Promise<void> {
        await db.update(users)
            .set({ isActive })
            .where(eq(users.id, userId));
    }
}
