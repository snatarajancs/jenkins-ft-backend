import type { ClientProfile, EngineerProfile, EngineerSkillMapping, EngineerToolMapping, PendingProfile, PaginatedPendingProfiles } from "../../domain/entities.js";
import type { ClientProfileResponse, EngineerProfileResponse, EngineerProfileUpdateRequest, AdminProfileListResponseSchema } from "../../app/dtos.js";
import { z } from "@hono/zod-openapi";

export function toClientProfileResponse(profile: ClientProfile): ClientProfileResponse {
    return {
        ...profile,
        middleName: profile.middleName ?? null,
        hearAboutUs: profile.hearAboutUs ?? null,
        avatarId: profile.avatarId ?? null,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
    };
}

export function toEngineerProfileResponse(
    profile: EngineerProfile & { skills: EngineerSkillMapping[]; tools: EngineerToolMapping[] }
): EngineerProfileResponse {
    return {
        ...profile,
        middleName: profile.middleName ?? null,
        avatarId: profile.avatarId ?? null,
        education: profile.education ?? null,
        specialization: profile.specialization ?? null,
        certifications: profile.certifications ?? null,
        experience: profile.experience ?? null,
        minRate: profile.minRate ?? null,
        maxRate: profile.maxRate ?? null,
        radius: profile.radius ?? null,
        workExpiry: profile.workExpiry ? profile.workExpiry.toISOString() : null,
        resumeId: profile.resumeId ?? null,
        coverLetterId: profile.coverLetterId ?? null,
        eligibilityId: profile.eligibilityId ?? null,
        skillLevelId: profile.skillLevelId ?? null,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
        skills: profile.skills.map((s) => ({ id: s.id, engineerId: s.engineerId, skillId: s.skillId })),
        tools: profile.tools.map((t) => ({ id: t.id, engineerId: t.engineerId, toolId: t.toolId })),
    };
}

export function toEngineerProfileUpdate(
    body: EngineerProfileUpdateRequest
): Partial<EngineerProfile> & { skills?: number[]; tools?: number[] } {
    return {
        ...body,
        workExpiry: body.workExpiry != null ? new Date(body.workExpiry) : body.workExpiry,
    };
}

// TODO: These are temporary UI placeholders for the Admin BGV page.
const ADMIN_UI_STUBS = {
    DEFAULT_DOCUMENTS: "#1",
    DEFAULT_CATEGORY: "IT Solutions",
};

type AdminProfileListResponse = z.infer<typeof AdminProfileListResponseSchema>;
type ProfileResponse = AdminProfileListResponse["profiles"][0];

export function toAdminProfileListResponse(data: PaginatedPendingProfiles): AdminProfileListResponse {
    return {
        summary: data.counts,
        pagination: {
            page: data.page,
            limit: data.limit,
            total: data.total,
        },
        profiles: data.profiles.map((p) => toProfileResponse(p)),
    };
}

function toProfileResponse(profile: PendingProfile): ProfileResponse {
    return {
        ...profile,
        submittedAt: profile.submittedAt.toISOString(),
        documents: ADMIN_UI_STUBS.DEFAULT_DOCUMENTS,
        category: ADMIN_UI_STUBS.DEFAULT_CATEGORY,
        verifiedDate: profile.accountStatus === "verified" ? new Date().toISOString().split("T")[0] : null,
    };
}
