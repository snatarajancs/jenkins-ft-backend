export const ADMIN_USER_FILTER_STATUS = {
    ACTIVE: "active",
    SUSPENDED: "suspended",
    PENDING: "pending",
} as const;

export type AdminUserFilterStatus = (typeof ADMIN_USER_FILTER_STATUS)[keyof typeof ADMIN_USER_FILTER_STATUS];

export const ADMIN_USER_RECORD_STATUS = {
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    PENDING: "Pending",
} as const;

export type AdminUserRecordStatus = (typeof ADMIN_USER_RECORD_STATUS)[keyof typeof ADMIN_USER_RECORD_STATUS];

export const ENGINEER_JOB_MODE = {
    FULL_TIME: "Full time",
    PART_TIME: "Part time",
    FREELANCER: "Freelancer",
} as const;

export type EngineerJobMode = (typeof ENGINEER_JOB_MODE)[keyof typeof ENGINEER_JOB_MODE];
