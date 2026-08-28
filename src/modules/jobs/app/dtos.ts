import { z } from "@hono/zod-openapi";
import {
    JobType,
    JobMode,
    JOB_TYPE_VALUES,
    JOB_STATUS_VALUES,
    JOB_MODE_VALUES,
    PAYMENT_TERM_VALUES,
    REPEAT_EVERY_VALUES,
    SCHEDULE_TYPE_VALUES,
    JOB_APPLICATION_STATUS_VALUES,
    JOB_APPLICATION_ACTION_VALUES,
} from "../domain/enums.js";

export const JobIdSchema = z.number().int().positive().brand("JobId");
export const JobIdParamSchema = z.coerce.number().int().positive().brand("JobId");

export const JobTypeSchema = z.enum(JOB_TYPE_VALUES);
export const JobStatusSchema = z.enum(JOB_STATUS_VALUES);
export const JobModeSchema = z.enum(JOB_MODE_VALUES);
export const PaymentTermSchema = z.enum(PAYMENT_TERM_VALUES);
export const RepeatEverySchema = z.enum(REPEAT_EVERY_VALUES);
export const ScheduleTypeSchema = z.enum(SCHEDULE_TYPE_VALUES);
export const JobApplicationStatusSchema = z.enum(JOB_APPLICATION_STATUS_VALUES);
export const JobWorkAddressSchema = z.object({
    countryId: z.number().int().positive(),
    stateId: z.number().int().positive(),
    cityId: z.number().int().positive(),
    postalCode: z.string().min(1).max(50),
    streetAddress: z.string().min(1).max(255),
    apartmentUnit: z.string().max(100),
});

export const JobWorkAddressResponseSchema = z.object({
    country: z.string(),
    state: z.string(),
    city: z.string(),
    postalCode: z.string(),
    streetAddress: z.string(),
    apartmentUnit: z.string(),
});


export const JobContactPersonSchema = z.object({
    name: z.string().min(1).max(255),
    phone: z.string().min(1).max(50),
    email: z.string().email(),
});

export const JobContactsSchema = z.object({
    spoc: JobContactPersonSchema.optional(),
    sme: JobContactPersonSchema.optional(),
    reportingManager: JobContactPersonSchema.optional(),
});

export const JobChecklistItemSchema = z.object({
    taskName: z.string().min(1).max(255),
});


export const PricingSchema = z
    .object({
        currencySymbol: z.string(),
        engineerCost: z.number(),
        toolCost: z.number(),
        travelCost: z.number(),
        platformFeePercentage: z.number(),
        platformFeeAmount: z.number(),
        totalPrice: z.number(),
    })
    .openapi("Pricing");

export const DispatchScheduleSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    shiftStartTime: z.string().min(1),
    shiftEndTime: z.string().min(1),
    totalHours: z.number().positive(),
});

export const FullTimeScheduleSchema = z.object({
    startDate: z.string(),
    endDate: z.string(),
    shiftStartTime: z.string(),
    shiftEndTime: z.string(),
    months: z.number().positive(),
});

export const ScheduledScheduleSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    scheduleForAllDay: z.boolean(),
    isRecurring: z.boolean(),
    repeatEvery: RepeatEverySchema.optional(),
    shiftStartTime: z.string(),
    shiftEndTime: z.string(),
    dates: z.array(z.string()).min(1),
});

export const JobScheduleSchema = DispatchScheduleSchema.or(FullTimeScheduleSchema).or(ScheduledScheduleSchema);

export const ClientJobCommonBaseSchema = z.object({
    jobTitleId: z.number().int().positive(),
    skillLevelId: z.number().int().positive(),
    skillIds: z.array(z.number().int().positive()).min(1),
});

export const ClientJobBaseSchema = ClientJobCommonBaseSchema.extend({
    jobMode: JobModeSchema.default(JobMode.ONSITE),
    description: z.string().min(10).max(5000),
    workAddress: JobWorkAddressSchema,
    contacts: JobContactsSchema,
    attachmentId: z.number().int().positive().optional().nullable(),
});

export const ClientPostDispatchJobSchema = ClientJobBaseSchema.extend({
    jobType: z.literal(JobType.DISPATCH),
    toolIds: z.array(z.number().int().positive()).default([]),
    checklist: z.array(JobChecklistItemSchema).default([]),
    schedule: DispatchScheduleSchema,
});

export const ClientPostFullTimeJobSchema = ClientJobBaseSchema.extend({
    jobType: z.literal(JobType.FULL_TIME),
    paymentTerm: PaymentTermSchema,
    schedule: FullTimeScheduleSchema,
});

export const ClientPostScheduledJobSchema = ClientJobBaseSchema.extend({
    jobType: z.literal(JobType.SCHEDULED),
    paymentTerm: PaymentTermSchema,
    schedule: ScheduledScheduleSchema,
});

export const ClientPostJobItemSchema = z.discriminatedUnion("jobType", [
    ClientPostDispatchJobSchema,
    ClientPostFullTimeJobSchema,
    ClientPostScheduledJobSchema,
]);

export const ClientPostJobRequestSchema = z
    .object({
        jobs: z.array(ClientPostJobItemSchema).min(1).max(50),
    })
    .openapi("ClientPostJobRequest");

export const CreatedJobSummarySchema = z.object({
    jobNumber: z.string(),
    jobTitle: z.string(),
    price: z.number(),
});

export const ClientPostJobResponseSchema = z
    .object({
        success: z.boolean(),
        message: z.string(),
        jobs: z.array(CreatedJobSummarySchema),
        totalJobPrice: z.number(),
    })
    .openapi("ClientPostJobResponse");

export const ClientCalculateJobBaseSchema = ClientJobCommonBaseSchema.extend({
    workAddress: z.object({ countryId: z.number().optional() }).optional(),
});

export const ClientCalculateJobDispatchSchema = ClientCalculateJobBaseSchema.extend({
    jobType: z.literal(JobType.DISPATCH),
    toolIds: z.array(z.number().int().positive()).default([]),
    schedule: DispatchScheduleSchema,
});

export const ClientCalculateJobFullTimeSchema = ClientCalculateJobBaseSchema.extend({
    jobType: z.literal(JobType.FULL_TIME),
    schedule: FullTimeScheduleSchema,
});

export const ClientCalculateJobScheduledSchema = ClientCalculateJobBaseSchema.extend({
    jobType: z.literal(JobType.SCHEDULED),
    schedule: ScheduledScheduleSchema,
});

export const ClientCalculateJobItemSchema = z.discriminatedUnion("jobType", [
    ClientCalculateJobDispatchSchema,
    ClientCalculateJobFullTimeSchema,
    ClientCalculateJobScheduledSchema,
]);

export const ClientCalculateJobPriceRequestSchema = z
    .object({
        clientCountry: z.string().optional(),
        jobs: z.array(ClientCalculateJobItemSchema).min(1).max(50),
    })
    .openapi("ClientCalculateJobPriceRequest");

export const ClientCalculateJobPriceResponseSchema = z
    .object({
        success: z.boolean(),
        data: PricingSchema,
    })
    .openapi("ClientCalculateJobPriceResponse");

export const ClientEditJobRequestSchema = z
    .object({
        description: z.string().min(10).max(5000).optional(),
        workAddress: JobWorkAddressSchema.optional(),
        contacts: JobContactsSchema.optional(),
        checklist: z.array(JobChecklistItemSchema).optional(),
        attachmentId: z.number().int().positive().optional().nullable(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        schedule: JobScheduleSchema.optional(),
    })
    .openapi("ClientEditJobRequest");

export const ClientJobResponseBaseSchema = z.object({
    id: z.number(),
    jobNumber: z.string(),
    clientId: z.number(),
    jobType: JobTypeSchema,
    jobStatus: JobStatusSchema,
    jobMode: JobModeSchema,
    jobTitle: z.string().optional(),
    skillLevel: z.string().optional(),
    skills: z.array(z.string()),
    tools: z.array(z.string()),
    workAddress: JobWorkAddressResponseSchema,
    currencySymbol: z.string(),
    engineerCost: z.number(),
    toolCost: z.number(),
    travelCost: z.number(),
    platformFeePercentage: z.number(),
    totalPrice: z.number(),
    createdAt: z.string(),
});

export const JobScheduleDateItemSchema = z.object({
    date: z.string(),
    scheduleType: ScheduleTypeSchema.optional().default("FULL_DAY"),
});

export const ClientJobDetailResponseSchema = ClientJobResponseBaseSchema.extend({
    paymentTerm: PaymentTermSchema.nullable().optional(),
    description: z.string(),
    contacts: JobContactsSchema,
    checklist: z.array(JobChecklistItemSchema),
    attachmentUrl: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    shiftStartTime: z.string().nullable().optional(),
    shiftEndTime: z.string().nullable().optional(),
    scheduleForAllDay: z.boolean().nullable().optional(),
    isRecurring: z.boolean().nullable().optional(),
    repeatEvery: z.string().nullable().optional(),
    totalHours: z.number().nullable().optional(),
    months: z.number().nullable().optional(),
    scheduleDates: z.array(JobScheduleDateItemSchema).optional(),
});

export const ClientJobListItemResponseSchema = ClientJobResponseBaseSchema;

export const ClientJobListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().optional().default(20),
    jobStatus: JobStatusSchema.optional(),
    jobType: JobTypeSchema.optional(),
    jobMode: JobModeSchema.optional(),
    skillLevelId: z.coerce.number().int().positive().optional(),
    jobTitleId: z.coerce.number().int().positive().optional(),
});

export const JobListSummarySchema = z.object({
    totalJobs: z.number(),
    posted: z.number(),
    inProgress: z.number(),
    completed: z.number(),
    cancelled: z.number(),
});

export const PaginationSchema = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
});

export const ClientJobListResponseSchema = z
    .object({
        data: z.array(ClientJobListItemResponseSchema),
        summary: JobListSummarySchema,
        pagination: PaginationSchema,
    })
    .openapi("ClientJobListResponse");
export type CreatedJobSummary = z.infer<typeof CreatedJobSummarySchema>;
export type ClientPostJobRequest = z.infer<typeof ClientPostJobRequestSchema>;
export type ClientPostJobResponse = z.infer<typeof ClientPostJobResponseSchema>;
export type ClientPostJobItem = z.infer<typeof ClientPostJobItemSchema>;
export type ClientCalculateJobPriceRequest = z.infer<typeof ClientCalculateJobPriceRequestSchema>;
export type ClientCalculateJobPriceResponse = z.infer<typeof ClientCalculateJobPriceResponseSchema>;
export type ClientCalculateJobItem = z.infer<typeof ClientCalculateJobItemSchema>;
export type ClientEditJobRequest = z.infer<typeof ClientEditJobRequestSchema>;
export type ClientJobResponseBase = z.infer<typeof ClientJobResponseBaseSchema>;
export type ClientJobDetailResponse = z.infer<typeof ClientJobDetailResponseSchema>;
export type ClientJobListItemResponse = z.infer<typeof ClientJobListItemResponseSchema>;
export type ClientJobListQuery = z.infer<typeof ClientJobListQuerySchema>;
export type ClientJobListResponse = z.infer<typeof ClientJobListResponseSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;

// --- Engineer Jobs ---

export const EngineerJobListQuerySchema = z
    .object({
        search: z.string().optional(),
        jobType: JobTypeSchema.optional(),
        jobMode: JobModeSchema.optional(),
        skillLevelId: z.coerce.number().int().positive().optional(),
        jobStatus: JobStatusSchema.optional(),
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().optional().default(20),
    })
    .openapi("EngineerJobListQuery");

export const EngineerJobListItemResponseSchema = z.object({
    id: z.number(),
    jobId: z.string(),
    clientId: z.number(),
    jobTitle: z.string(),
    skillLevel: z.string(),
    jobMode: JobModeSchema,
    country: z.string(),
    state: z.string(),
    city: z.string(),
    postalCode: z.string(),
    jobType: JobTypeSchema,
    jobStatus: JobStatusSchema,
    totalPrice: z.number(),
});

export const EngineerJobListResponseSchema = z
    .object({
        data: z.array(EngineerJobListItemResponseSchema),
        pagination: PaginationSchema,
    })
    .openapi("EngineerJobListResponse");

export const EngineerJobDetailResponseSchema = ClientJobDetailResponseSchema.omit({
    currencySymbol: true,
    engineerCost: true,
    toolCost: true,
    travelCost: true,
    platformFeePercentage: true,
    totalPrice: true,
}).extend({
    applicationStatus: JobApplicationStatusSchema.nullable().optional(),
    applicationId: z.number().nullable().optional(),
}).openapi("EngineerJobDetailResponse");

export type EngineerJobListQuery = z.infer<typeof EngineerJobListQuerySchema>;
export type EngineerJobListItemResponse = z.infer<typeof EngineerJobListItemResponseSchema>;
export type EngineerJobListResponse = z.infer<typeof EngineerJobListResponseSchema>;
export type EngineerJobDetailResponse = z.infer<typeof EngineerJobDetailResponseSchema>;

// --- Engineer My Jobs ---
export const EngineerMyJobsQuerySchema = z
    .object({
        search: z.string().optional(),
        jobType: JobTypeSchema.optional(),
        jobMode: JobModeSchema.optional(),
        skillLevelId: z.coerce.number().int().positive().optional(),
        jobStatus: JobStatusSchema.optional(),
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().optional().default(20),
    })
    .openapi("EngineerMyJobsQuery");

export const EngineerMyJobsResponseSchema = z
    .object({
        data: z.array(EngineerJobListItemResponseSchema),
        summary: JobListSummarySchema,
        pagination: PaginationSchema,
    })
    .openapi("EngineerMyJobsResponse");

export type EngineerMyJobsQuery = z.infer<typeof EngineerMyJobsQuerySchema>;
export type EngineerMyJobsResponse = z.infer<typeof EngineerMyJobsResponseSchema>;
// --- Job Applications ---
export const JobApplicationItemSchema = z
    .object({
        id: z.number(),
        jobId: z.number(),
        engineerId: z.number(),
        status: JobApplicationStatusSchema,
        appliedAt: z.string(),
        reviewedAt: z.string().nullable().optional(),
    })
    .openapi("JobApplicationItem");
export const JobListApplicationsResponseSchema = z
    .object({
        data: z.array(JobApplicationItemSchema),
    })
    .openapi("JobListApplicationsResponse");
export const JobApplicationActionEnum = z.enum(JOB_APPLICATION_ACTION_VALUES);
export const JobApplicationActionRequestSchema = z
    .object({
        action: JobApplicationActionEnum,
        reason: z.string().max(1000).optional(),
    })
    .openapi("JobApplicationActionRequest");
export const JobApplicationActionResponseSchema = z
    .object({
        success: z.boolean(),
        message: z.string(),
    })
    .openapi("JobApplicationActionResponse");
export type JobApplicationItem = z.infer<typeof JobApplicationItemSchema>;
export type JobListApplicationsResponse = z.infer<typeof JobListApplicationsResponseSchema>;
export type JobApplicationActionRequest = z.infer<typeof JobApplicationActionRequestSchema>;
export type JobApplicationActionResponse = z.infer<typeof JobApplicationActionResponseSchema>;
