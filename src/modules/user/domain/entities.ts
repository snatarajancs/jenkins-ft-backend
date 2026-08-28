export type AccountStatus = "submitted" | "in_progress" | "bgv_completed" | "verified" | "rejected";
export type ReviewAction = "send_for_bgv" | "approve" | "reject";
export const ACCOUNT_STATUS_VALUES: [AccountStatus, ...AccountStatus[]] = ["submitted", "in_progress", "bgv_completed", "verified", "rejected"];

import type { UserId } from "../../../shared/domain/types.js";
import type { Role } from "../../auth/domain/roles.js";

export interface ClientProfile {
    id: number;
    userId: number;
    firstName: string;
    middleName: string | null;
    lastName: string;
    mobileNumber: string;
    companyName: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    hearAboutUs: string | null;
    avatarId: number | null;
    accountStatus: AccountStatus;
    statusReason: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface EngineerProfile {
    id: number;
    userId: number;
    firstName: string;
    middleName: string | null;
    lastName: string;
    mobileNumber: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    avatarId: number | null;
    education: string | null;
    specialization: string | null;
    certifications: string | null;
    experience: number | null;
    minRate: number | null;
    maxRate: number | null;
    onsite: boolean;
    remote: boolean;
    travel: boolean;
    urgent: boolean;
    fullTime: boolean;
    notification: boolean;
    radius: number | null;
    workExpiry: Date | null;
    resumeId: number | null;
    coverLetterId: number | null;
    eligibilityId: number | null;
    skillLevelId: number | null;
    accountStatus: AccountStatus;
    statusReason: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface EngineerSkillMapping {
    id: number;
    engineerId: number;
    skillId: number;
    createdAt: Date;
}

export interface EngineerToolMapping {
    id: number;
    engineerId: number;
    toolId: number;
    createdAt: Date;
}

export interface PendingProfile {
    userId: UserId;
    email: string;
    role: Role | "admin";
    firstName: string;
    lastName: string;
    accountStatus: AccountStatus;
    submittedAt: Date;
}

export interface ProfileStatusCounts {
    pending: number;
    inProgress: number;
    completed: number;
    rejected: number;
}

export interface PaginatedPendingProfiles {
    profiles: PendingProfile[];
    total: number;
    page: number;
    limit: number;
    counts: ProfileStatusCounts;
}
