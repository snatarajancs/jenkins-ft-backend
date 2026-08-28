import type { AdminUserFilterStatus, AdminUserRecordStatus, EngineerJobMode } from "./enums.js";
import type { RegionId, UserId, ClientId } from "../../../shared/domain/types.js";

export interface AdminUserFilters {
    page: number;
    limit: number;
    search?: string;
    status?: AdminUserFilterStatus;
    location?: string;
    startDate?: string;
    endDate?: string;
    regionId?: RegionId;
    sortBy: "name" | "joinedAt" | "companyName";
    sortOrder: "asc" | "desc";
}

export interface AdminUserSummary {
    totalCount: number;
    activeCount: number;
    suspendedCount: number;
    activityDistribution: {
        active: number;
        inactive: number;
        suspended: number;
    };
}

export interface AdminClientRecord {
    userId: UserId;
    clientId: ClientId | null;
    name: string;
    companyName: string;
    email: string;
    location: string;
    jobsCount: number;
    status: AdminUserRecordStatus;
    joinedAt: string;
}

export interface AdminEngineerRecord {
    userId: UserId;
    name: string;
    jobMode: EngineerJobMode | null;
    email: string;
    location: string;
    jobsCount: number;
    status: AdminUserRecordStatus;
    joinedAt: string;
}

export interface AdminUserListResult<T> {
    data: T[];
    summary: AdminUserSummary;
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface UpdateUserStatusInput {
    isActive: boolean;
}
