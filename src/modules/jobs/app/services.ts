import crypto from "node:crypto";
import type { UnitOfWork } from "../../../shared/domain/unit-of-work.js";
import type { RegionId, UserId, ClientId, ClientRegionId } from "../../../shared/domain/types.js";
import {
    toJobId,
    toClientId,
    toEngineerId,
    toClientRegionId,
    toJobTitleId,
    toSkillLevelId,
    toFileId,
    toUserId,
    toRegionId,
    toCurrencyId,
} from "../../../shared/domain/types.js";
import type { Job } from "../domain/entities.js";
import { assertJobIsEditable } from "../domain/entities.js";
import { JobStatus, JobApplicationAction, type JobApplicationStatus } from "../domain/enums.js";
import { JobNotFoundError, InvalidJobApplicationActionError } from "../domain/errors.js";
import { NotFoundError } from "../../../shared/domain/errors.js";
import type { JobRepository } from "../domain/repos.js";
import type { Pricing } from "../domain/value-objects.js";
import type { RateCardService } from "./interfaces.js";
import type { UserService, ClientProfile } from "../../user/index.js";
import { REFERENCE_TYPES, type WalletService } from "../../wallet/index.js";
import type { FileService } from "../../files/index.js";
import type {
    ClientPostJobRequest,
    ClientPostJobResponse,
    ClientEditJobRequest,
    ClientJobDetailResponse,
    ClientJobListResponse,
    ClientJobListQuery,
    ClientPostJobItem,
    ClientCalculateJobItem,
    ClientCalculateJobPriceRequest,
    ClientCalculateJobPriceResponse,
    EngineerJobListQuery,
    EngineerJobListResponse,
    EngineerJobDetailResponse,
    EngineerMyJobsQuery,
    EngineerMyJobsResponse,
    JobListApplicationsResponse,
    JobApplicationActionRequest,
    JobApplicationActionResponse,
} from "./dtos.js";
import {
    toEntity,
    toUpdatedEntity,
    toRateCardInput,
    toDetailResponse,
    toEngineerDetailResponse,
    toListItemResponse,
    toEngineerJobFilters,
    toEngineerJobListResponse,
    toEngineerMyJobsFilters,
    toEngineerMyJobsResponse,
    toPostJobResponse,
    toApplyJobResponse,
    toJobListApplicationsResponse,
} from "./converter.js";
import {
    resolveCurrencyByCountryId,
    getExchangeRate,
} from "./stubs/master-data-stub.js";
import { logger } from "../../../shared/infra/logger.js";




export interface JobService {
    postJobs(clientRegionId: RegionId, userId: UserId, dto: ClientPostJobRequest): Promise<ClientPostJobResponse>;
    getJobById(clientRegionId: RegionId, id: number, userId: UserId): Promise<ClientJobDetailResponse>;
    updateJob(clientRegionId: RegionId, id: number, userId: UserId, dto: ClientEditJobRequest): Promise<ClientJobDetailResponse>;
    cancelJob(clientRegionId: RegionId, id: number, userId: UserId): Promise<{ success: boolean; message: string }>;
    listJobs(clientRegionId: RegionId, userId: UserId, query: ClientJobListQuery): Promise<ClientJobListResponse>;
    calculatePrice(dto: ClientCalculateJobPriceRequest): Promise<ClientCalculateJobPriceResponse>;
    listJobsForEngineer(userId: UserId, regionId: RegionId, query: EngineerJobListQuery): Promise<EngineerJobListResponse>;
    listMyJobsForEngineer(userId: UserId, regionId: RegionId, query: EngineerMyJobsQuery): Promise<EngineerMyJobsResponse>;
    getJobByIdForEngineer(userId: UserId, regionId: RegionId, id: number): Promise<EngineerJobDetailResponse>;
    applyForJob(userId: UserId, regionId: RegionId, jobId: number): Promise<JobApplicationActionResponse>;
    listJobApplications(clientRegionId: RegionId, userId: UserId, jobId: number): Promise<JobListApplicationsResponse>;
    handleJobApplicationAction(clientRegionId: RegionId, userId: UserId, jobId: number, applicationId: number, actionDto: JobApplicationActionRequest): Promise<JobApplicationActionResponse>;
}

export interface JobAdminQueryService {
    getJobCountsForClients(clientRegionId: ClientRegionId, clientIds: ClientId[]): Promise<Record<number, number>>;
}

export class JobServiceImpl implements JobService, JobAdminQueryService {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly jobRepo: JobRepository,
        private readonly rateCardService: RateCardService,
        private readonly userService: UserService,
        private readonly walletService: WalletService,
        private readonly fileService: FileService,
    ) { }

    private async getRequiredClientProfile(clientRegionId: RegionId, userId: UserId): Promise<ClientProfile | null> {
        return this.userService.getClientProfile(userId, clientRegionId);
    }

    private async resolveAttachmentUrl(attachmentId: number | null, userId: UserId, regionId: RegionId): Promise<string | null> {
        if (!attachmentId) {
            return null;
        }
        try {
            const result = await this.fileService.getDownloadUrl({
                userId,
                regionId,
                fileId: toFileId(attachmentId),
                scope: "job",
            });
            return result?.url ?? null;
        } catch (error) {
            if (error instanceof NotFoundError || (error as { statusCode?: number })?.statusCode === 404) {
                return null;
            }
            logger.error({ err: error, attachmentId, userId, regionId }, "Failed to resolve attachment URL");
            throw error;
        }
    }

    private generateJobNumber(dateStr: string, randHex: string, index: number): string {
        return `JOB-${dateStr}-${randHex}-${index}`;
    }

    private async calculateJobPriceForItem(
        item: ClientPostJobItem | ClientCalculateJobItem,
        targetCountryId?: number,
    ): Promise<Pricing> {
        const rateCardInput = toRateCardInput(item, targetCountryId);
        return this.rateCardService.calculateJobPrice(rateCardInput);
    }

    private async buildSingleJob(params: {
        item: ClientPostJobItem;
        clientId: number;
        clientRegionId: RegionId;
        dateStr: string;
        randHex: string;
        index: number;
    }): Promise<Job> {
        const { item, clientId, clientRegionId, dateStr, randHex, index } = params;

        const countryCurrency = resolveCurrencyByCountryId(item.workAddress.countryId);
        const currencyId = countryCurrency?.id ?? 1;

        // Job pricing columns in DB are stored in the Job Country Currency
        const pricing = await this.calculateJobPriceForItem(item, item.workAddress.countryId);
        const jobNumber = this.generateJobNumber(dateStr, randHex, index);

        return toEntity({
            item,
            clientId,
            clientRegionId,
            jobNumber,
            pricing,
            currencyId,
        });
    }

    public async postJobs(clientRegionId: RegionId, userId: UserId, dto: ClientPostJobRequest): Promise<ClientPostJobResponse> {
        const clientProfile = await this.getRequiredClientProfile(clientRegionId, userId);
        const clientId = clientProfile!.id;

        const dateStr = new Date().toISOString().slice(0, 10).replaceAll("-", "");
        const randHex = crypto.randomBytes(2).toString("hex").toUpperCase();

        const jobsToCreate = await Promise.all(
            dto.jobs.map((item, i) =>
                this.buildSingleJob({
                    item,
                    clientId,
                    clientRegionId,
                    dateStr,
                    randHex,
                    index: i + 1,
                }),
            ),
        );

        const createdJobs = await this.uow.globalTransaction((txDb) =>
            this.jobRepo.createJobs(txDb, jobsToCreate),
        );

        const wallet = await this.walletService.getWallet(clientRegionId, userId);
        const clientWalletCurrencyId = toCurrencyId(wallet.currencyId);

        for (const job of createdJobs) {
            // TODO(MasterData): Fetch live/locked exchange rate from MasterData / Currency service when database FX rates are ready.
            const rate = getExchangeRate(job.currencyId, clientWalletCurrencyId);
            const amountToDeduct = Math.round(job.totalPrice * rate * 100) / 100;

            await this.walletService.decreaseWallet(
                clientRegionId,
                userId,
                amountToDeduct,
                clientWalletCurrencyId,
                REFERENCE_TYPES.job_post,
                job.id!,
            );
        }

        logger.info(
            { clientId, clientRegionId, jobCount: createdJobs.length, jobNumbers: createdJobs.map((j) => j.jobNumber) },
            "Jobs successfully created",
        );

        return toPostJobResponse(createdJobs);
    }

    public async getJobById(clientRegionId: RegionId, id: number, userId: UserId): Promise<ClientJobDetailResponse> {
        const clientProfile = await this.getRequiredClientProfile(clientRegionId, userId);
        const clientId = toClientId(clientProfile!.id);
        const wallet = await this.walletService.getWallet(clientRegionId, userId);
        const clientWalletCurrencyId = toCurrencyId(wallet.currencyId);
        const clientRegionIdBranded = toClientRegionId(clientRegionId);
        const jobId = toJobId(id);
        const db = this.uow.getGlobalDb();

        const job = await this.jobRepo.findById(db, jobId, clientId, clientRegionIdBranded);
        if (!job) {
            throw JobNotFoundError(id);
        }

        const attachmentUrl = await this.resolveAttachmentUrl(job.attachmentId, userId, clientRegionId);
        return toDetailResponse(job, clientWalletCurrencyId, attachmentUrl);
    }

    public async updateJob(clientRegionId: RegionId, id: number, userId: UserId, dto: ClientEditJobRequest): Promise<ClientJobDetailResponse> {
        const clientProfile = await this.getRequiredClientProfile(clientRegionId, userId);
        const clientId = toClientId(clientProfile!.id);
        const wallet = await this.walletService.getWallet(clientRegionId, userId);
        const clientWalletCurrencyId = toCurrencyId(wallet.currencyId);
        const clientRegionIdBranded = toClientRegionId(clientRegionId);
        const jobId = toJobId(id);
        const db = this.uow.getGlobalDb();

        const job = await this.jobRepo.findById(db, jobId, clientId, clientRegionIdBranded);
        if (!job) {
            throw JobNotFoundError(id);
        }

        assertJobIsEditable(job.jobStatus);

        const updatedJobEntity = toUpdatedEntity(job, dto);

        const updatedJob = await this.uow.globalTransaction((txDb) =>
            this.jobRepo.update(txDb, updatedJobEntity, clientId, clientRegionIdBranded),
        );

        const attachmentUrl = await this.resolveAttachmentUrl(updatedJob.attachmentId, userId, clientRegionId);
        return toDetailResponse(updatedJob, clientWalletCurrencyId, attachmentUrl);
    }

    public async cancelJob(clientRegionId: RegionId, id: number, userId: UserId): Promise<{ success: boolean; message: string }> {
        const clientProfile = await this.getRequiredClientProfile(clientRegionId, userId);
        const clientId = toClientId(clientProfile!.id);
        const clientRegionIdBranded = toClientRegionId(clientRegionId);
        const jobId = toJobId(id);
        const db = this.uow.getGlobalDb();

        const job = await this.jobRepo.findById(db, jobId, clientId, clientRegionIdBranded);
        if (!job) {
            throw JobNotFoundError(id);
        }

        const cancelledJob: Job = {
            ...job,
            jobStatus: JobStatus.CANCELLED,
        };

        await this.uow.globalTransaction((txDb) =>
            this.jobRepo.update(txDb, cancelledJob, clientId, clientRegionIdBranded),
        );

        const wallet = await this.walletService.getWallet(clientRegionId, userId);
        const clientWalletCurrencyId = toCurrencyId(wallet.currencyId);
        const rate = getExchangeRate(job.currencyId, clientWalletCurrencyId);
        const amountToRefund = Math.round(job.totalPrice * rate * 100) / 100;

        await this.walletService.increaseWallet(
            clientRegionId,
            userId,
            amountToRefund,
            clientWalletCurrencyId,
            REFERENCE_TYPES.refund,
            job.id!,
        );

        logger.info(
            { jobId, clientId, clientRegionId },
            "Job status updated to CANCELLED",
        );

        return {
            success: true,
            message: "Job status updated to CANCELLED",
        };
    }

    public async listJobs(clientRegionId: RegionId, userId: UserId, query: ClientJobListQuery): Promise<ClientJobListResponse> {
        const clientProfile = await this.getRequiredClientProfile(clientRegionId, userId);
        const clientId = toClientId(clientProfile!.id);
        const wallet = await this.walletService.getWallet(clientRegionId, userId);
        const clientWalletCurrencyId = toCurrencyId(wallet.currencyId);
        const clientRegionIdBranded = toClientRegionId(clientRegionId);
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? query.limit : 20;

        const db = this.uow.getGlobalDb();
        const result = await this.jobRepo.list(db, {
            clientId,
            clientRegionId: clientRegionIdBranded,
            jobStatus: query.jobStatus,
            jobType: query.jobType,
            jobMode: query.jobMode,
            skillLevelId: query.skillLevelId ? toSkillLevelId(query.skillLevelId) : undefined,
            jobTitleId: query.jobTitleId ? toJobTitleId(query.jobTitleId) : undefined,
            page,
            limit,
        });

        const totalPages = Math.ceil(result.total / limit) || 1;
        const mappedJobs = result.jobs.map((job) => toListItemResponse(job, clientWalletCurrencyId));

        return {
            data: mappedJobs,
            summary: result.summary,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages,
            },
        };
    }

    public async calculatePrice(dto: ClientCalculateJobPriceRequest): Promise<ClientCalculateJobPriceResponse> {
        // Price estimation returned in Client Wallet Currency (default countryId 1 = INR ₹ unless workAddress.countryId explicitly provided)
        const breakdown = await Promise.all(
            dto.jobs.map((item) => {
                // FIXME(MasterData): Default countryId to 1 (India) if workAddress is omitted in price estimation.
                const clientCountryId = item.workAddress?.countryId ?? 1;
                return this.calculateJobPriceForItem(item, clientCountryId);
            }),
        );

        const totalPrice = this.rateCardService.calculateBatchPrice(breakdown);

        return {
            success: true,
            data: totalPrice,
        };
    }

    public async listJobsForEngineer(
        userId: UserId,
        regionId: RegionId,
        query: EngineerJobListQuery,
    ): Promise<EngineerJobListResponse> {
        const engineerProfile = await this.userService.getEngineerProfile(userId, regionId);
        const filters = toEngineerJobFilters(query, engineerProfile);

        const db = this.uow.getGlobalDb();
        const { jobs, total } = await this.jobRepo.listRecommendedForEngineer(db, filters);
        return toEngineerJobListResponse(jobs, total, filters.page!, filters.limit!);
    }

    public async listMyJobsForEngineer(
        userId: UserId,
        regionId: RegionId,
        query: EngineerMyJobsQuery,
    ): Promise<EngineerMyJobsResponse> {
        const engineerProfile = await this.userService.getEngineerProfile(userId, regionId);
        const engineerId = toEngineerId(engineerProfile!.id);
        const filters = toEngineerMyJobsFilters(query, engineerProfile, engineerId);

        const db = this.uow.getGlobalDb();
        const { jobs, total, summary } = await this.jobRepo.list(db, filters);
        return toEngineerMyJobsResponse(jobs, total, summary, filters.page!, filters.limit!);
    }

    public async getJobByIdForEngineer(userId: UserId, regionId: RegionId, id: number): Promise<EngineerJobDetailResponse> {
        const jobId = toJobId(id);
        const db = this.uow.getGlobalDb();
        const job = await this.jobRepo.findById(db, jobId);
        if (!job) {
            throw JobNotFoundError(id);
        }

        const engineerProfile = await this.userService.getEngineerProfile(userId, regionId);
        let applicationStatus: JobApplicationStatus | null = null;
        let applicationId: number | null = null;

        if (engineerProfile) {
            const engineerId = toEngineerId(engineerProfile.id);
            const applications = await this.jobRepo.findApplications(db, {
                jobId,
                engineerId,
            });
            if (applications.length > 0) {
                applicationStatus = applications[0].status;
                applicationId = applications[0].id ?? null;
            }
        }

        const attachmentUrl = await this.resolveAttachmentUrl(job.attachmentId, toUserId(job.clientId), toRegionId(job.clientRegionId));
        return toEngineerDetailResponse(job, attachmentUrl, applicationStatus, applicationId);
    }

    public async applyForJob(userId: UserId, regionId: RegionId, jobId: number): Promise<JobApplicationActionResponse> {
        const engineerProfile = await this.userService.getEngineerProfile(userId, regionId);
        const engineerId = toEngineerId(engineerProfile!.id);
        const jobIdBranded = toJobId(jobId);

        await this.uow.globalTransaction((txDb) =>
            this.jobRepo.applyForJob(txDb, jobIdBranded, engineerId),
        );

        logger.info(
            { jobId, engineerId, userId, regionId },
            "Engineer successfully applied for job",
        );

        return toApplyJobResponse();
    }

    public async listJobApplications(clientRegionId: RegionId, userId: UserId, jobId: number): Promise<JobListApplicationsResponse> {
        const clientProfile = await this.getRequiredClientProfile(clientRegionId, userId);
        const clientId = toClientId(clientProfile!.id);
        const clientRegionIdBranded = toClientRegionId(clientRegionId);
        const jobIdBranded = toJobId(jobId);
        const db = this.uow.getGlobalDb();

        const job = await this.jobRepo.findById(db, jobIdBranded, clientId, clientRegionIdBranded);
        if (!job) {
            throw JobNotFoundError(jobId);
        }

        const applications = await this.jobRepo.findApplications(db, {
            jobId: jobIdBranded,
            clientId,
            clientRegionId: clientRegionIdBranded,
        });

        return toJobListApplicationsResponse(applications);
    }

    public async handleJobApplicationAction(
        clientRegionId: RegionId,
        userId: UserId,
        jobId: number,
        applicationId: number,
        actionDto: JobApplicationActionRequest,
    ): Promise<JobApplicationActionResponse> {
        const clientProfile = await this.getRequiredClientProfile(clientRegionId, userId);
        const clientId = toClientId(clientProfile!.id);
        const jobIdBranded = toJobId(jobId);

        if (actionDto.action !== JobApplicationAction.ACCEPT && actionDto.action !== JobApplicationAction.REJECT) {
            throw InvalidJobApplicationActionError(actionDto.action);
        }

        await this.uow.globalTransaction((txDb) =>
            this.jobRepo.updateApplicationStatus(txDb, {
                jobId: jobIdBranded,
                applicationId,
                clientId,
                clientRegionId: toClientRegionId(clientRegionId),
                action: actionDto.action,
            }),
        );

        logger.info(
            { jobId, applicationId, clientId, action: actionDto.action },
            `Job application action '${actionDto.action}' processed successfully`,
        );

        return {
            success: true,
            message: actionDto.action === JobApplicationAction.ACCEPT
                ? "Application accepted and engineer assigned to job"
                : "Application rejected",
        };
    }

    public async getJobCountsForClients(clientRegionId: ClientRegionId, clientIds: ClientId[]): Promise<Record<number, number>> {
        const db = this.uow.getGlobalDb();
        return this.jobRepo.getCountsForClients(db, clientRegionId, clientIds);
    }
}
