import { z } from "@hono/zod-openapi";
import { ACCOUNT_STATUS_VALUES } from "../domain/entities.js";
import { REVIEWABLE_ROLES } from "../../auth/domain/roles.js";

export const ClientProfileResponseSchema = z
    .object({
        id: z.number(),
        userId: z.number(),
        firstName: z.string(),
        middleName: z.string().nullable(),
        lastName: z.string(),
        mobileNumber: z.string(),
        companyName: z.string(),
        address: z.string(),
        city: z.string(),
        postalCode: z.string(),
        country: z.string(),
        hearAboutUs: z.string().nullable(),
        avatarId: z.number().nullable(),
        accountStatus: z.enum(ACCOUNT_STATUS_VALUES),
        statusReason: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
    })
    .openapi("ClientProfileResponse");

export const ClientProfileUpdateRequestSchema = z
    .object({
        firstName: z.string().min(1).max(100).optional(),
        middleName: z.string().max(100).optional().nullable(),
        lastName: z.string().min(1).max(100).optional(),
        mobileNumber: z.string().min(7).max(20).optional(),
        companyName: z.string().min(1).max(255).optional(),
        address: z.string().min(1).max(255).optional(),
        city: z.string().min(1).max(100).optional(),
        postalCode: z.string().min(3).max(20).optional(),
        country: z.string().min(1).max(100).optional(),
        hearAboutUs: z.string().max(255).optional().nullable(),
        avatarId: z.number().int().positive().optional().nullable(),
    })
    .openapi("ClientProfileUpdateRequest");

export const EngineerProfileResponseSchema = z
    .object({
        id: z.number(),
        userId: z.number(),
        firstName: z.string(),
        middleName: z.string().nullable(),
        lastName: z.string(),
        mobileNumber: z.string(),
        address: z.string(),
        city: z.string(),
        postalCode: z.string(),
        country: z.string(),
        avatarId: z.number().nullable(),
        education: z.string().nullable(),
        specialization: z.string().nullable(),
        certifications: z.string().nullable(),
        experience: z.number().nullable(),
        minRate: z.number().nullable(),
        maxRate: z.number().nullable(),
        onsite: z.boolean(),
        remote: z.boolean(),
        travel: z.boolean(),
        urgent: z.boolean(),
        fullTime: z.boolean(),
        notification: z.boolean(),
        radius: z.number().nullable(),
        workExpiry: z.string().nullable(),
        resumeId: z.number().nullable(),
        coverLetterId: z.number().nullable(),
        eligibilityId: z.number().nullable(),
        skillLevelId: z.number().nullable(),
        accountStatus: z.enum(ACCOUNT_STATUS_VALUES),
        statusReason: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
        skills: z.array(
            z.object({
                id: z.number(),
                engineerId: z.number(),
                skillId: z.number(),
            }),
        ),
        tools: z.array(
            z.object({
                id: z.number(),
                engineerId: z.number(),
                toolId: z.number(),
            }),
        ),
    })
    .openapi("EngineerProfileResponse");

export const EngineerProfileUpdateRequestSchema = z
    .object({
        firstName: z.string().min(1).max(100).optional(),
        middleName: z.string().max(100).optional().nullable(),
        lastName: z.string().min(1).max(100).optional(),
        mobileNumber: z.string().min(7).max(20).optional(),
        address: z.string().min(1).max(255).optional(),
        city: z.string().min(1).max(100).optional(),
        postalCode: z.string().min(3).max(20).optional(),
        country: z.string().min(1).max(100).optional(),
        avatarId: z.number().int().positive().optional().nullable(),
        education: z.string().max(255).optional().nullable(),
        specialization: z.string().max(255).optional().nullable(),
        certifications: z.string().max(500).optional().nullable(),
        experience: z.number().int().min(0).max(50).optional().nullable(),
        minRate: z.number().int().positive().optional().nullable(),
        maxRate: z.number().int().positive().optional().nullable(),
        onsite: z.boolean().optional(),
        remote: z.boolean().optional(),
        travel: z.boolean().optional(),
        urgent: z.boolean().optional(),
        fullTime: z.boolean().optional(),
        notification: z.boolean().optional(),
        radius: z.number().int().positive().optional().nullable(),
        workExpiry: z.string().datetime().optional().nullable(),
        resumeId: z.number().int().positive().optional().nullable(),
        coverLetterId: z.number().int().positive().optional().nullable(),
        eligibilityId: z.number().int().positive().optional().nullable(),
        skillLevelId: z.number().int().positive().optional().nullable(),
        skills: z.array(z.number().int().positive()).optional(),
        tools: z.array(z.number().int().positive()).optional(),
    })
    .refine(
        (data) => {
            if (data.minRate != null && data.maxRate != null) {
                return data.minRate <= data.maxRate;
            }
            return true;
        },
        {
            message: "minRate cannot be greater than maxRate",
            path: ["minRate"],
        },
    )
    .openapi("EngineerProfileUpdateRequest");

export type ClientProfileResponse = z.infer<typeof ClientProfileResponseSchema>;
export type ClientProfileUpdateRequest = z.infer<typeof ClientProfileUpdateRequestSchema>;
export type EngineerProfileResponse = z.infer<typeof EngineerProfileResponseSchema>;
export type EngineerProfileUpdateRequest = z.infer<typeof EngineerProfileUpdateRequestSchema>;

export const PendingProfileSchema = z.object({
    userId: z.number().int().positive(),
    email: z.string().email(),
    role: z.enum([...REVIEWABLE_ROLES, "admin"] as [string, ...string[]]),
    firstName: z.string(),
    lastName: z.string(),
    accountStatus: z.enum(ACCOUNT_STATUS_VALUES),
    submittedAt: z.string().datetime(),
    documents: z.string().optional(),
    category: z.string().optional(),
    verifiedDate: z.string().nullable().optional(),
});

export const AdminProfileListResponseSchema = z.object({
    summary: z.object({
        pending: z.number().int().nonnegative(),
        inProgress: z.number().int().nonnegative(),
        completed: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
    }),
    pagination: z.object({
        page: z.number().int().positive(),
        limit: z.number().int().positive(),
        total: z.number().int().nonnegative(),
    }),
    profiles: z.array(PendingProfileSchema),
}).openapi("AdminProfileListResponse");

export const AdminReviewRequestSchema = z.object({
    action: z.enum(["send_for_bgv", "approve", "reject"]),
    reason: z.string().min(5).optional(),
}).openapi("AdminReviewRequest");

export const AdminReviewResponseSchema = z.object({
    userId: z.number().int().positive(),
    accountStatus: z.enum(ACCOUNT_STATUS_VALUES),
}).openapi("AdminReviewResponse");

export const AdminEngineerProfileResponseSchema = EngineerProfileResponseSchema.extend({
    email: z.string().email(),
}).openapi("AdminEngineerProfileResponse");

export type AdminEngineerProfileResponse = z.infer<typeof AdminEngineerProfileResponseSchema>;

export const AdminUserFiltersSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(10),
    search: z.string().optional(),
    status: z.enum(["active", "suspended", "pending"]).optional(),
    location: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    regionId: z.coerce.number().int().optional(),
    sortBy: z.enum(["name", "joinedAt", "companyName"]).default("joinedAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AdminUserFiltersDto = z.infer<typeof AdminUserFiltersSchema>;

export const AdminUserSummarySchema = z.object({
    totalCount: z.number().int(),
    activeCount: z.number().int(),
    suspendedCount: z.number().int(),
    activityDistribution: z.object({
        active: z.number().int(),
        inactive: z.number().int(),
        suspended: z.number().int(),
    }),
});

export const AdminClientRecordSchema = z.object({
    userId: z.number().int(),
    name: z.string(),
    companyName: z.string(),
    email: z.string().email(),
    location: z.string(),
    jobsCount: z.number().int(),
    status: z.enum(["Active", "Suspended", "Pending"]),
    joinedAt: z.string().datetime(),
});

export const AdminEngineerRecordSchema = z.object({
    userId: z.number().int(),
    name: z.string(),
    jobMode: z.enum(["Full time", "Part time", "Freelancer"]).nullable(),
    email: z.string().email(),
    location: z.string(),
    jobsCount: z.number().int(),
    status: z.enum(["Active", "Suspended", "Pending"]),
    joinedAt: z.string().datetime(),
});

export const AdminClientResponseSchema = z.object({
    data: z.array(AdminClientRecordSchema),
    summary: AdminUserSummarySchema,
    pagination: z.object({
        total: z.number().int(),
        page: z.number().int(),
        limit: z.number().int(),
        totalPages: z.number().int(),
    }),
});

export const AdminEngineerResponseSchema = z.object({
    data: z.array(AdminEngineerRecordSchema),
    summary: AdminUserSummarySchema,
    pagination: z.object({
        total: z.number().int(),
        page: z.number().int(),
        limit: z.number().int(),
        totalPages: z.number().int(),
    }),
});

export const UpdateUserStatusSchema = z.object({
    isActive: z.boolean(),
});
