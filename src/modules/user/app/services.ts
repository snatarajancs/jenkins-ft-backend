import type { UnitOfWork } from "../../../shared/domain/unit-of-work.js";
import type { Role, ReviewableRole } from "../../auth/domain/roles.js";
import type { AccountStatus, ClientProfile, EngineerProfile, EngineerSkillMapping, EngineerToolMapping, PaginatedPendingProfiles, ReviewAction } from "../domain/entities.js";
import type { AdminUserFiltersDto } from "./dtos.js";
import type { ClientRepository, EngineerRepository, UserRepository, AdminReviewRepository, AdminUserRepository } from "../domain/repos.js";
import type { AdminUserFilters, AdminUserListResult, AdminClientRecord, AdminEngineerRecord } from "../domain/admin-types.js";
import { toRegionId, toSkillId, toToolId, toClientRegionId, type RegionId, type UserId, type SkillId, type ToolId } from "../../../shared/domain/types.js";
import type { JobAdminQueryService } from "../../jobs/app/services.js";
import { ClientError, NotFoundError } from "../../../shared/domain/errors.js";
import { logger } from "../../../shared/infra/logger.js";

const CLIENT_REQUIRED_FIELDS = ["firstName", "lastName", "mobileNumber", "companyName", "address", "city", "postalCode", "country"] as const;
const ENGINEER_REQUIRED_FIELDS = ["firstName", "lastName", "mobileNumber", "address", "city", "postalCode", "country"] as const;

export type FullEngineerProfile = EngineerProfile & {
    skills: EngineerSkillMapping[];
    tools: EngineerToolMapping[];
    skillIds: SkillId[];
    toolIds: ToolId[];
};
export type FullEngineerProfileWithEmail = FullEngineerProfile & { email: string };

export interface UserService {
    getClientProfile(userId: number, regionId: number): Promise<ClientProfile | null>;
    updateClientProfile(userId: number, regionId: number, profile: Partial<ClientProfile>): Promise<ClientProfile>;
    getEngineerProfile(userId: number, regionId: number): Promise<FullEngineerProfile | null>;
    getEngineerProfileWithEmail(userId: number, regionId: number): Promise<FullEngineerProfileWithEmail | null>;
    updateEngineerProfile(
        userId: number,
        regionId: number,
        profile: Partial<EngineerProfile> & { skills?: number[]; tools?: number[] }
    ): Promise<FullEngineerProfile>;
    getUserRole(userId: number, regionId: number): Promise<Role | null>;
    updateAccountStatus(userId: number, regionId: number, role: Role, status: AccountStatus, reason: string | null): Promise<void>;
    getPendingProfiles(regionId: RegionId, status?: AccountStatus, role?: ReviewableRole, page?: number, limit?: number): Promise<PaginatedPendingProfiles>;
    reviewProfile(regionId: RegionId, userId: UserId, action: ReviewAction, reason: string | null): Promise<{ userId: UserId; accountStatus: AccountStatus }>;
    getEngineerProfileByUserId(userId: UserId, regionId: RegionId): Promise<FullEngineerProfileWithEmail | null>;
    
    getAdminClients(regionId: number, filters: AdminUserFiltersDto): Promise<AdminUserListResult<AdminClientRecord>>;
    getAdminEngineers(regionId: number, filters: AdminUserFiltersDto): Promise<AdminUserListResult<AdminEngineerRecord>>;
    getAdminLocations(regionId: number, role: "client" | "engineer"): Promise<string[]>;
    updateUserActiveStatus(regionId: number, userId: number, isActive: boolean): Promise<void>;
}

export class UserServiceImpl implements UserService {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly clientRepo: ClientRepository,
        private readonly engineerRepo: EngineerRepository,
        private readonly userRepo: UserRepository,
        private readonly reviewRepo: AdminReviewRepository,
        private readonly adminRepo: AdminUserRepository,
    ) {}

    private jobAdminService?: JobAdminQueryService;

    setJobAdminService(service: JobAdminQueryService) {
        this.jobAdminService = service;
    }

    async getClientProfile(userId: number, regionId: number): Promise<ClientProfile | null> {
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));
        return this.clientRepo.findByUserId(db, userId);
    }

    async updateClientProfile(userId: number, regionId: number, profile: Partial<ClientProfile>): Promise<ClientProfile> {
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));

        const existing = await this.clientRepo.findByUserId(db, userId);
        if (!existing) {
            const missing = CLIENT_REQUIRED_FIELDS.filter((f) => profile[f] == null);
            if (missing.length > 0) {
                throw new ClientError(`Required fields for initial profile setup: ${missing.join(", ")}`);
            }
        }

        return this.clientRepo.upsert(db, userId, profile);
    }

    async getEngineerProfile(userId: number, regionId: number): Promise<FullEngineerProfile | null> {
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));
        const engineer = await this.engineerRepo.findByUserId(db, userId);
        if (!engineer) return null;

        const [skills, tools] = await Promise.all([
            this.engineerRepo.getSkills(db, engineer.id),
            this.engineerRepo.getTools(db, engineer.id),
        ]);

        return {
            ...engineer,
            skills,
            tools,
            skillIds: skills.map((s) => toSkillId(s.skillId)),
            toolIds: tools.map((t) => toToolId(t.toolId)),
        };
    }

    async getEngineerProfileWithEmail(userId: number, regionId: number): Promise<FullEngineerProfileWithEmail | null> {
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));
        const engineer = await this.engineerRepo.findByUserIdWithEmail(db, userId);
        if (!engineer) return null;

        const [skills, tools] = await Promise.all([
            this.engineerRepo.getSkills(db, engineer.id),
            this.engineerRepo.getTools(db, engineer.id),
        ]);

        return {
            ...engineer,
            skills,
            tools,
            skillIds: skills.map((s) => toSkillId(s.skillId)),
            toolIds: tools.map((t) => toToolId(t.toolId)),
        };
    }

    async updateEngineerProfile(
        userId: number,
        regionId: number,
        profile: Partial<EngineerProfile> & { skills?: number[]; tools?: number[] }
    ): Promise<FullEngineerProfile> {
        const { skills, tools, ...profileData } = profile;
        const targetRegionId = toRegionId(regionId);

        return await this.uow.transaction(undefined, async (tx) => {
            const existing = await this.engineerRepo.findByUserId(tx.regional, userId);
            if (!existing) {
                const missing = ENGINEER_REQUIRED_FIELDS.filter((f) => profileData[f] == null);
                if (missing.length > 0) {
                    throw new ClientError(`Required fields for initial profile setup: ${missing.join(", ")}`);
                }
            }

            const updated = await this.engineerRepo.upsert(tx.regional, userId, profileData);

            if (skills !== undefined) {
                await this.engineerRepo.replaceSkills(tx.regional, updated.id, skills);
            }
            if (tools !== undefined) {
                await this.engineerRepo.replaceTools(tx.regional, updated.id, tools);
            }

            const [updatedSkills, updatedTools] = await Promise.all([
                this.engineerRepo.getSkills(tx.regional, updated.id),
                this.engineerRepo.getTools(tx.regional, updated.id),
            ]);

            return {
                ...updated,
                skills: updatedSkills,
                tools: updatedTools,
                skillIds: updatedSkills.map((s) => toSkillId(s.skillId)),
                toolIds: updatedTools.map((t) => toToolId(t.toolId)),
            };
        }, targetRegionId);
    }

    async getUserRole(userId: number, regionId: number): Promise<Role | null> {
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));
        return this.userRepo.getUserRole(db, userId);
    }

    async updateAccountStatus(userId: number, regionId: number, role: Role, status: AccountStatus, reason: string | null): Promise<void> {
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));
        return this.userRepo.updateAccountStatus(db, userId, role, status, reason);
    }

    async getPendingProfiles(regionId: RegionId, status?: AccountStatus, role?: ReviewableRole, page?: number, limit?: number): Promise<PaginatedPendingProfiles> {
        const db = this.uow.getRegionalDb(undefined, regionId);
        return this.reviewRepo.getPendingProfiles(db, status, role, page, limit);
    }

    async reviewProfile(regionId: RegionId, userId: UserId, action: ReviewAction, reason: string | null): Promise<{ userId: UserId; accountStatus: AccountStatus }> {
        return this.uow.transaction(undefined, async () => {
            const role = await this.getUserRole(userId, regionId);
            if (!role) {
                throw new NotFoundError("User not found in this region");
            }

            if (role !== "client" && role !== "engineer") {
                throw new ClientError(`Cannot review profiles for role: ${role}`);
            }

            const newStatus = this.resolveNewStatus(action, reason);
            await this.updateAccountStatus(userId, regionId, role, newStatus, reason);

            if (action === "send_for_bgv") {
                this.scheduleBgvCompletion(regionId, userId, role);
            }

            return { userId, accountStatus: newStatus };
        }, regionId);
    }

    async getEngineerProfileByUserId(userId: UserId, regionId: RegionId) {
        return this.getEngineerProfileWithEmail(userId, regionId);
    }

    private resolveNewStatus(action: ReviewAction, reason: string | null): AccountStatus {
        switch (action) {
            case "send_for_bgv":
                return "in_progress";
            case "approve":
                // TODO: Trigger SES email
                return "verified";
            case "reject":
                if (!reason) {
                    throw new ClientError("Reason is required when rejecting a profile");
                }
                // TODO: Trigger SES email
                return "rejected";
        }
    }

    private scheduleBgvCompletion(regionId: RegionId, userId: UserId, role: ReviewableRole) {
        setTimeout(async () => {
            try {
                await this.updateAccountStatus(userId, regionId, role, "bgv_completed", null);
                logger.info({ userId, regionId }, "BGV mock update completed");
            } catch (error) {
                logger.error({ userId, regionId, error }, "BGV mock update failed");
            }
        }, 10000);
    }

    private mapAdminFilters(filters: AdminUserFiltersDto): AdminUserFilters {
        return {
            ...filters,
            regionId: filters.regionId ? toRegionId(filters.regionId) : undefined
        };
    }

    async getAdminClients(regionId: number, filters: AdminUserFiltersDto): Promise<AdminUserListResult<AdminClientRecord>> {
        const adminFilters = this.mapAdminFilters(filters);
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));
        const result = await this.adminRepo.getAdminClients(db, adminFilters);

        const clientIds = result.data.map(d => d.clientId).filter((id) => id !== null);
        let jobsCounts: Record<number, number> = {};
        if (this.jobAdminService) {
            jobsCounts = await this.jobAdminService.getJobCountsForClients(toClientRegionId(regionId), clientIds);
        }

        const mappedData = result.data.map(d => {
            return {
                ...d,
                jobsCount: (d.clientId ? jobsCounts[d.clientId as number] : 0) || 0
            };
        });

        return { ...result, data: mappedData };
    }

    async getAdminEngineers(regionId: number, filters: AdminUserFiltersDto): Promise<AdminUserListResult<AdminEngineerRecord>> {
        const adminFilters = this.mapAdminFilters(filters);
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));
        return this.adminRepo.getAdminEngineers(db, adminFilters);
    }

    async getAdminLocations(regionId: number, role: "client" | "engineer"): Promise<string[]> {
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));
        return this.adminRepo.getAdminLocations(db, role);
    }

    async updateUserActiveStatus(regionId: number, userId: number, isActive: boolean): Promise<void> {
        const db = this.uow.getRegionalDb(undefined, toRegionId(regionId));
        await this.adminRepo.updateUserActiveStatus(db, userId, isActive);
        // TODO: Revoke active sessions by deleting refresh tokens for suspended users (LLD §3 Scenario B)
        // TODO: Write to admin audit log (LLD §7)
    }
}
