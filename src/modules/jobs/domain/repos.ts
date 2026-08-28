import type { GlobalDb } from "../../../shared/domain/db-types.js";
import type { Job, JobApplication } from "./entities.js";
import type { JobStatus, JobType, JobMode, JobApplicationStatus, JobApplicationAction } from "./enums.js";
import type { JobId, ClientId, EngineerId, ClientRegionId, JobTitleId, SkillLevelId, CountryId, SkillId, ToolId } from "../../../shared/domain/types.js";

export interface JobFilters {
    jobStatus?: JobStatus;
    jobType?: JobType;
    jobMode?: JobMode;
    skillLevelId?: SkillLevelId;
    jobTitleId?: JobTitleId;
    clientRegionId?: ClientRegionId;
    clientId?: ClientId;
    engineerId?: EngineerId;
    countryId?: CountryId;
    search?: string;
    page?: number;
    limit?: number;
}

export interface EngineerJobFilters {
    countryId: CountryId;
    search?: string;
    jobStatus?: JobStatus;
    jobType?: JobType;
    jobMode?: JobMode;
    skillLevelId?: SkillLevelId;
    engineerSkillLevelId?: SkillLevelId | null;
    engineerSkillIds?: SkillId[];
    engineerToolIds?: ToolId[];
    engineerOnsite?: boolean;
    engineerRemote?: boolean;
    page?: number;
    limit?: number;
}

export interface JobListSummary {
    totalJobs: number;
    posted: number;
    inProgress: number;
    completed: number;
    cancelled: number;
}

export interface JobApplicationFilters {
    id?: number;
    jobId?: JobId;
    engineerId?: EngineerId;
    status?: JobApplicationStatus;
    clientId?: ClientId;
    clientRegionId?: ClientRegionId;
}

export interface UpdateApplicationStatusParams {
    jobId: JobId;
    applicationId: number;
    clientId: ClientId;
    clientRegionId: ClientRegionId;
    action: JobApplicationAction;
}

export interface JobRepository {
    createJobs(db: GlobalDb, jobs: Job[]): Promise<Job[]>;
    findById(db: GlobalDb, id: JobId, clientId?: ClientId, clientRegionId?: ClientRegionId): Promise<Job | null>;
    list(db: GlobalDb, filters: JobFilters): Promise<{ jobs: Job[]; total: number; summary: JobListSummary }>;
    listRecommendedForEngineer(db: GlobalDb, filters: EngineerJobFilters): Promise<{ jobs: Job[]; total: number }>;
    update(db: GlobalDb, job: Job, clientId: ClientId, clientRegionId: ClientRegionId): Promise<Job>;
    applyForJob(db: GlobalDb, jobId: JobId, engineerId: EngineerId): Promise<JobApplication>;
    findApplications(db: GlobalDb, filters: JobApplicationFilters): Promise<JobApplication[]>;
    updateApplicationStatus(db: GlobalDb, params: UpdateApplicationStatusParams): Promise<{ application: JobApplication }>;
    getCountsForClients(db: GlobalDb, clientRegionId: ClientRegionId, clientIds: ClientId[]): Promise<Record<number, number>>;
}
