import type { ClientProfile, EngineerProfile } from "../../domain/entities.js";
import type { clients, engineers } from "../schema.regional.js";
import type { InferInsertModel } from "drizzle-orm";

type ClientInsert = InferInsertModel<typeof clients>;
type EngineerInsert = InferInsertModel<typeof engineers>;

export function toClientInsert(userId: number, profile: Partial<ClientProfile>): ClientInsert {
    return {
        userId,
        firstName: profile.firstName!,
        lastName: profile.lastName!,
        mobileNumber: profile.mobileNumber!,
        companyName: profile.companyName!,
        address: profile.address!,
        city: profile.city!,
        postalCode: profile.postalCode!,
        country: profile.country!,
        middleName: profile.middleName ?? null,
        hearAboutUs: profile.hearAboutUs ?? null,
        avatarId: profile.avatarId ?? null,
    };
}

export function toEngineerInsert(userId: number, profile: Partial<EngineerProfile>): EngineerInsert {
    return {
        userId,
        firstName: profile.firstName!,
        middleName: profile.middleName ?? null,
        lastName: profile.lastName!,
        mobileNumber: profile.mobileNumber!,
        address: profile.address!,
        city: profile.city!,
        postalCode: profile.postalCode!,
        country: profile.country!,
        avatarId: profile.avatarId ?? null,
        education: profile.education ?? null,
        specialization: profile.specialization ?? null,
        certifications: profile.certifications ?? null,
        experience: profile.experience ?? null,
        minRate: profile.minRate ?? null,
        maxRate: profile.maxRate ?? null,
        onsite: profile.onsite ?? false,
        remote: profile.remote ?? false,
        travel: profile.travel ?? false,
        urgent: profile.urgent ?? false,
        fullTime: profile.fullTime ?? false,
        notification: profile.notification ?? false,
        radius: profile.radius ?? null,
        workExpiry: profile.workExpiry ?? null,
        resumeId: profile.resumeId ?? null,
        coverLetterId: profile.coverLetterId ?? null,
        eligibilityId: profile.eligibilityId ?? null,
        skillLevelId: profile.skillLevelId ?? null,
    };
}
