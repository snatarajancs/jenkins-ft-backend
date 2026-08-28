import type { Job, JobApplication } from "../domain/entities.js";
import type { RegionId, ToolId } from "../../../shared/domain/types.js";
import {
    toClientId,
    toClientRegionId,
    toJobTitleId,
    toSkillLevelId,
    toSkillId,
    toToolId,
    toAttachmentId,
    toCountryId,
    toStateId,
    toCityId,
    toCurrencyId,
    type EngineerId,
} from "../../../shared/domain/types.js";
import { JobStatus, JobType, PaymentTerm, ScheduleType, type JobApplicationStatus } from "../domain/enums.js";
import type { EngineerJobFilters, JobFilters, JobListSummary } from "../domain/repos.js";
import type { FullEngineerProfile } from "../../user/index.js";
import type {
    ClientJobDetailResponseSchema,
    ClientJobListItemResponseSchema,
    EngineerJobListItemResponseSchema,
    EngineerJobDetailResponseSchema,
    ClientPostJobItem,
    ClientPostJobResponse,
    ClientCalculateJobItem,
    ClientEditJobRequest,
    EngineerJobListQuery,
    EngineerJobListResponse,
    EngineerMyJobsQuery,
    EngineerMyJobsResponse,
    JobApplicationItem,
    JobApplicationActionResponse,
    JobListApplicationsResponse,
} from "./dtos.js";
import type { z } from "@hono/zod-openapi";
import type { Pricing } from "../domain/value-objects.js";
import {
    resolveCountryName,
    resolveStateName,
    resolveCityName,
    resolveJobTitleName,
    resolveSkillLevelName,
    resolveSkillNames,
    resolveToolNames,
    resolveCurrencySymbol,
    resolveCountryIdByName,
    getExchangeRate,
} from "./stubs/master-data-stub.js";


export type JobDetailData = z.infer<typeof ClientJobDetailResponseSchema>;
export type JobListItemData = z.infer<typeof ClientJobListItemResponseSchema>;
export type EngineerJobListItemData = z.infer<typeof EngineerJobListItemResponseSchema>;
export type EngineerJobDetailData = z.infer<typeof EngineerJobDetailResponseSchema>;

export function toEntity(params: {
    item: ClientPostJobItem;
    clientId: number;
    clientRegionId: RegionId;
    jobNumber: string;
    pricing: Pricing;
    currencyId: number;
}): Job {
    const { item, clientId, clientRegionId, jobNumber, pricing, currencyId } = params;

    let paymentTerm: PaymentTerm | null = null;
    const toolIds: number[] = "toolIds" in item && item.toolIds ? item.toolIds : [];
    const checklist: string[] = "checklist" in item && item.checklist ? item.checklist.map((c) => c.taskName) : [];
    let startDate: string | null = null;
    let endDate: string | null = null;
    let shiftStartTime: string | null = null;
    let shiftEndTime: string | null = null;
    let totalHours: number | null = null;
    let months: number | null = null;
    let scheduleForAllDay: boolean | null = null;
    let isRecurring: boolean | null = null;
    let repeatEvery: string | null = null;
    let scheduleDates: Array<{ date: string; scheduleType: ScheduleType }> = [];

    switch (item.jobType) {
        case JobType.DISPATCH: {
            startDate = item.schedule.startDate ?? null;
            endDate = item.schedule.endDate ?? null;
            shiftStartTime = item.schedule.shiftStartTime;
            shiftEndTime = item.schedule.shiftEndTime;
            totalHours = item.schedule.totalHours;
            break;
        }
        case JobType.FULL_TIME: {
            paymentTerm = item.paymentTerm;
            startDate = item.schedule.startDate;
            endDate = item.schedule.endDate;
            shiftStartTime = item.schedule.shiftStartTime;
            shiftEndTime = item.schedule.shiftEndTime;
            months = item.schedule.months;
            break;
        }
        case JobType.SCHEDULED: {
            paymentTerm = item.paymentTerm;
            startDate = item.schedule.startDate ?? null;
            endDate = item.schedule.endDate ?? null;
            shiftStartTime = item.schedule.shiftStartTime;
            shiftEndTime = item.schedule.shiftEndTime;
            scheduleForAllDay = item.schedule.scheduleForAllDay;
            isRecurring = item.schedule.isRecurring;
            repeatEvery = item.schedule.repeatEvery ?? null;
            scheduleDates = item.schedule.dates.map((d) => ({
                date: d,
                scheduleType: ScheduleType.FULL_DAY,
            }));
            break;
        }
    }

    return {
        id: null,
        jobNumber,
        clientId: toClientId(clientId),
        clientRegionId: toClientRegionId(clientRegionId),
        jobType: item.jobType,
        jobStatus: JobStatus.POSTED,
        jobMode: item.jobMode,
        paymentTerm,
        jobTitleId: toJobTitleId(item.jobTitleId),
        skillLevelId: toSkillLevelId(item.skillLevelId),
        skillIds: item.skillIds.map(toSkillId),
        toolIds: toolIds.map(toToolId),
        description: item.description,
        workAddress: {
            countryId: toCountryId(item.workAddress.countryId),
            stateId: toStateId(item.workAddress.stateId),
            cityId: toCityId(item.workAddress.cityId),
            postalCode: item.workAddress.postalCode,
            streetAddress: item.workAddress.streetAddress,
            apartmentUnit: item.workAddress.apartmentUnit,
        },
        contacts: item.contacts,
        checklist,
        attachmentId: item.attachmentId ? toAttachmentId(item.attachmentId) : null,
        startDate,
        endDate,
        totalHours,
        shiftStartTime,
        shiftEndTime,
        scheduleForAllDay,
        isRecurring,
        repeatEvery,
        months,
        scheduleDates,
        currencyId: toCurrencyId(currencyId),
        currencySymbol: resolveCurrencySymbol(currencyId) || pricing.currencySymbol,
        engineerCost: pricing.engineerCost,
        toolCost: pricing.toolCost,
        travelCost: pricing.travelCost,
        platformFeePercentage: pricing.platformFeePercentage,
        totalPrice: pricing.totalPrice,
        assignedEngineerId: null,
        createdAt: null,
        updatedAt: null,
    };
}

export function toUpdatedEntity(job: Job, dto: ClientEditJobRequest): Job {
    let attachmentId = job.attachmentId;
    if (dto.attachmentId !== undefined) {
        attachmentId = dto.attachmentId ? toAttachmentId(dto.attachmentId) : null;
    }

    const scheduleData = resolveUpdatedSchedule(job, dto);

    const workAddress = dto.workAddress
        ? {
            countryId: toCountryId(dto.workAddress.countryId),
            stateId: toStateId(dto.workAddress.stateId),
            cityId: toCityId(dto.workAddress.cityId),
            postalCode: dto.workAddress.postalCode,
            streetAddress: dto.workAddress.streetAddress,
            apartmentUnit: dto.workAddress.apartmentUnit,
        }
        : job.workAddress;

    const checklist = dto.checklist
        ? dto.checklist.map((c) => c.taskName)
        : job.checklist;

    return {
        ...job,
        description: dto.description ?? job.description,
        workAddress,
        contacts: dto.contacts ?? job.contacts,
        checklist,
        attachmentId,
        ...scheduleData,
    };
}

function resolveUpdatedSchedule(job: Job, dto: ClientEditJobRequest) {
    let shiftStartTime = job.shiftStartTime;
    let shiftEndTime = job.shiftEndTime;
    let totalHours = job.totalHours;
    let scheduleDates = job.scheduleDates;
    let startDate = dto.startDate ?? job.startDate;
    let endDate = dto.endDate ?? job.endDate;

    if (dto.schedule) {
        shiftStartTime = dto.schedule.shiftStartTime;
        shiftEndTime = dto.schedule.shiftEndTime;
        if ("startDate" in dto.schedule && dto.schedule.startDate) {
            startDate = dto.startDate ?? dto.schedule.startDate;
        }
        if ("endDate" in dto.schedule && dto.schedule.endDate) {
            endDate = dto.endDate ?? dto.schedule.endDate;
        }
        if ("totalHours" in dto.schedule) {
            totalHours = dto.schedule.totalHours;
        }
        if ("dates" in dto.schedule) {
            scheduleDates = dto.schedule.dates.map((d: string) => ({
                date: d,
                scheduleType: ScheduleType.FULL_DAY,
            }));
        }
    }

    return {
        shiftStartTime,
        shiftEndTime,
        totalHours,
        scheduleDates,
        startDate,
        endDate,
    };
}

export function toRateCardInput(
    item: ClientPostJobItem | ClientCalculateJobItem,
    overrideCountryId?: number,
) {
    let toolIds: ToolId[] = [];
    let totalHours: number | undefined;
    let months: number | undefined;
    let scheduleDates: Array<{ date: string; scheduleType?: ScheduleType }> | undefined;

    switch (item.jobType) {
        case JobType.DISPATCH:
            toolIds = (item.toolIds ?? []).map(toToolId);
            totalHours = item.schedule.totalHours;
            break;
        case JobType.FULL_TIME:
            months = item.schedule.months;
            break;
        case JobType.SCHEDULED:
            scheduleDates = item.schedule.dates.map((d: string) => ({
                date: d,
                scheduleType: ScheduleType.FULL_DAY,
            }));
            break;
    }

    const countryId = overrideCountryId ?? item.workAddress?.countryId;

    return {
        jobType: item.jobType,
        skillLevelId: toSkillLevelId(item.skillLevelId),
        toolIds,
        totalHours,
        months,
        scheduleDates,
        countryId: countryId ? toCountryId(countryId) : undefined,
    };
}

export function toEngineerDetailResponse(
    job: Job,
    attachmentUrl?: string | null,
    applicationStatus?: JobApplicationStatus | null,
    applicationId?: number | null,
): EngineerJobDetailData {
    return {
        ...toJobHeader(job),
        workAddress: toAddressResponse(job.workAddress),
        paymentTerm: job.paymentTerm ?? null,
        description: job.description,
        contacts: job.contacts,
        checklist: (job.checklist ?? []).map((taskName: string) => ({ taskName })),
        attachmentUrl: attachmentUrl ?? null,
        startDate: job.startDate ?? null,
        endDate: job.endDate ?? null,
        shiftStartTime: job.shiftStartTime ?? null,
        shiftEndTime: job.shiftEndTime ?? null,
        scheduleForAllDay: job.scheduleForAllDay ?? null,
        isRecurring: job.isRecurring ?? null,
        repeatEvery: job.repeatEvery ?? null,
        totalHours: job.totalHours ?? null,
        months: job.months ?? null,
        scheduleDates: job.scheduleDates ?? [],
        createdAt: (job.createdAt ?? new Date()).toISOString(),
        applicationStatus: applicationStatus ?? null,
        applicationId: applicationId ?? null,
    };
}

export function toDetailResponse(job: Job, targetCurrencyId?: number, attachmentUrl?: string | null): JobDetailData {
    return {
        ...toEngineerDetailResponse(job, attachmentUrl),
        ...toPricingResponse(job, targetCurrencyId ?? job.currencyId),
    };
}

export function toListItemResponse(job: Job, targetCurrencyId?: number): JobListItemData {
    return {
        ...toJobHeader(job),
        workAddress: toAddressResponse(job.workAddress),
        ...toPricingResponse(job, targetCurrencyId ?? job.currencyId),
        createdAt: (job.createdAt ?? new Date()).toISOString(),
    };
}

export function toEngineerJobFilters(
    query: EngineerJobListQuery,
    profile: FullEngineerProfile | null,
): EngineerJobFilters {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    // FIXME: Once the User profile returns countryId directly, use profile.countryId directly and remove this string resolver.
    const countryId = toCountryId(resolveCountryIdByName(profile?.country ?? "") ?? 1);

    return {
        countryId,
        search: query.search,
        jobType: query.jobType,
        jobMode: query.jobMode,
        skillLevelId: query.skillLevelId ? toSkillLevelId(query.skillLevelId) : undefined,
        jobStatus: query.jobStatus,
        engineerSkillLevelId: profile?.skillLevelId ? toSkillLevelId(profile.skillLevelId) : null,
        engineerSkillIds: profile?.skillIds ?? [],
        engineerToolIds: profile?.toolIds ?? [],
        engineerOnsite: profile?.onsite ?? false,
        engineerRemote: profile?.remote ?? false,
        page,
        limit,
    };
}

export function toEngineerJobListResponse(
    jobs: Job[],
    total: number,
    page: number,
    limit: number,
): EngineerJobListResponse {
    return {
        data: jobs.map(toEngineerListItemResponse),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
}

export function toEngineerMyJobsFilters(
    query: EngineerMyJobsQuery,
    profile: FullEngineerProfile | null,
    engineerId: EngineerId,
): JobFilters {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const countryId = toCountryId(resolveCountryIdByName(profile?.country ?? "") ?? 1);

    return {
        engineerId,
        countryId,
        search: query.search,
        jobType: query.jobType,
        jobMode: query.jobMode,
        skillLevelId: query.skillLevelId ? toSkillLevelId(query.skillLevelId) : undefined,
        jobStatus: query.jobStatus,
        page,
        limit,
    };
}

export function toEngineerMyJobsResponse(
    jobs: Job[],
    total: number,
    summary: JobListSummary,
    page: number,
    limit: number,
): EngineerMyJobsResponse {
    return {
        data: jobs.map(toEngineerListItemResponse),
        summary,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
}

export function toEngineerListItemResponse(job: Job): EngineerJobListItemData {
    const addr = job.workAddress;
    return {
        id: job.id!,
        jobId: job.jobNumber,
        clientId: job.clientId,
        jobTitle: resolveJobTitleName(job.jobTitleId),
        skillLevel: resolveSkillLevelName(job.skillLevelId),
        jobMode: job.jobMode,
        country: addr.country ?? resolveCountryName(addr.countryId),
        state: addr.state ?? resolveStateName(addr.stateId),
        city: addr.city ?? resolveCityName(addr.cityId),
        postalCode: addr.postalCode,
        jobType: job.jobType,
        jobStatus: job.jobStatus,
        totalPrice: job.totalPrice,
    };
}

export function toPostJobResponse(createdJobs: Job[]): ClientPostJobResponse {
    const hasPostedJobs = createdJobs.some((j) => j.jobStatus === JobStatus.POSTED);
    const jobs = createdJobs.map((j) => ({
        jobNumber: j.jobNumber,
        jobTitle: resolveJobTitleName(j.jobTitleId),
        price: j.totalPrice,
    }));
    const totalJobPrice = Math.round(
        createdJobs.reduce((sum, j) => sum + (j.totalPrice || 0), 0) * 100,
    ) / 100;

    return {
        success: true,
        message: hasPostedJobs ? "Job posted successfully" : "Job saved as draft",
        jobs,
        totalJobPrice,
    };
}

function toAddressResponse(addr: Job["workAddress"]) {
    return {
        country: addr.country ?? resolveCountryName(addr.countryId),
        state: addr.state ?? resolveStateName(addr.stateId),
        city: addr.city ?? resolveCityName(addr.cityId),
        postalCode: addr.postalCode,
        streetAddress: addr.streetAddress,
        apartmentUnit: addr.apartmentUnit,
    };
}

function toJobHeader(job: Job) {
    return {
        id: job.id!,
        jobNumber: job.jobNumber,
        clientId: job.clientId,
        jobType: job.jobType,
        jobStatus: job.jobStatus,
        jobMode: job.jobMode,
        jobTitle: resolveJobTitleName(job.jobTitleId),
        skillLevel: resolveSkillLevelName(job.skillLevelId),
        skills: resolveSkillNames(job.skillIds),
        tools: resolveToolNames(job.toolIds),
    };
}

function toPricingResponse(job: Job, targetCurrencyId: number) {
    const rate = getExchangeRate(job.currencyId, targetCurrencyId);
    const currencySymbol = resolveCurrencySymbol(targetCurrencyId) || "₹";

    return {
        currencySymbol,
        engineerCost: Math.round(job.engineerCost * rate * 100) / 100,
        toolCost: Math.round(job.toolCost * rate * 100) / 100,
        travelCost: Math.round(job.travelCost * rate * 100) / 100,
        platformFeePercentage: job.platformFeePercentage,
        totalPrice: Math.round(job.totalPrice * rate * 100) / 100,
    };
}


export function toJobApplicationItem(app: JobApplication): JobApplicationItem {
    return {
        id: app.id!,
        jobId: app.jobId,
        engineerId: app.engineerId,
        status: app.status,
        appliedAt: (app.appliedAt ?? new Date()).toISOString(),
        reviewedAt: app.reviewedAt ? app.reviewedAt.toISOString() : null,
    };
}

export function toApplyJobResponse(): JobApplicationActionResponse {
    return {
        success: true,
        message: "Application submitted successfully",
    };
}

export function toJobListApplicationsResponse(
    apps: JobApplication[],
): JobListApplicationsResponse {
    return {
        data: apps.map(toJobApplicationItem),
    };
}
