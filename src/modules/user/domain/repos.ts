import type { RegionalDb } from "../../../shared/domain/db-types.js";
import type { Role, ReviewableRole } from "../../auth/domain/roles.js";
import type { AccountStatus, ClientProfile, EngineerProfile, EngineerSkillMapping, EngineerToolMapping, PaginatedPendingProfiles } from "./entities.js";
import type { AdminUserFilters, AdminUserListResult, AdminClientRecord, AdminEngineerRecord } from "./admin-types.js";

export interface UserRepository {
    getUserRole(db: RegionalDb, userId: number): Promise<Role | null>;
    updateAccountStatus(db: RegionalDb, userId: number, role: Role, status: AccountStatus, reason: string | null): Promise<void>;
}

export interface ClientRepository {
    findByUserId(db: RegionalDb, userId: number): Promise<ClientProfile | null>;
    upsert(db: RegionalDb, userId: number, profile: Partial<ClientProfile>): Promise<ClientProfile>;
}

export interface EngineerRepository {
    findByUserId(db: RegionalDb, userId: number): Promise<EngineerProfile | null>;
    findByUserIdWithEmail(db: RegionalDb, userId: number): Promise<(EngineerProfile & { email: string }) | null>;
    upsert(db: RegionalDb, userId: number, profile: Partial<EngineerProfile>): Promise<EngineerProfile>;
    getSkills(db: RegionalDb, engineerId: number): Promise<EngineerSkillMapping[]>;
    getTools(db: RegionalDb, engineerId: number): Promise<EngineerToolMapping[]>;
    replaceSkills(db: RegionalDb, engineerId: number, skills: number[]): Promise<void>;
    replaceTools(db: RegionalDb, engineerId: number, tools: number[]): Promise<void>;
}

export interface AdminReviewRepository {
    getPendingProfiles(db: RegionalDb, status?: AccountStatus, role?: ReviewableRole, page?: number, limit?: number): Promise<PaginatedPendingProfiles>;
}

export interface AdminUserRepository {
    getAdminClients(db: RegionalDb, filters: AdminUserFilters): Promise<AdminUserListResult<AdminClientRecord>>;
    getAdminEngineers(db: RegionalDb, filters: AdminUserFilters): Promise<AdminUserListResult<AdminEngineerRecord>>;
    getAdminLocations(db: RegionalDb, role: "client" | "engineer"): Promise<string[]>;
    updateUserActiveStatus(db: RegionalDb, userId: number, isActive: boolean): Promise<void>;
}
