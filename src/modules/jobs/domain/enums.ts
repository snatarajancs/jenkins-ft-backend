export const JobType = {
    DISPATCH: "DISPATCH",
    SCHEDULED: "SCHEDULED",
    FULL_TIME: "FULL_TIME",
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];
export const JOB_TYPE_VALUES = Object.values(JobType) as [JobType, ...JobType[]];

export const JobStatus = {
    DRAFT: "DRAFT",
    POSTED: "POSTED",
    ASSIGNED: "ASSIGNED",
    ARRIVED: "ARRIVED",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
export const JOB_STATUS_VALUES = Object.values(JobStatus) as [JobStatus, ...JobStatus[]];

export const JobMode = {
    ONSITE: "ONSITE",
    REMOTE: "REMOTE",
} as const;
export type JobMode = (typeof JobMode)[keyof typeof JobMode];
export const JOB_MODE_VALUES = Object.values(JobMode) as [JobMode, ...JobMode[]];

export const PaymentTerm = {
    WEEKLY: "WEEKLY",
    MONTHLY: "MONTHLY",
} as const;
export type PaymentTerm = (typeof PaymentTerm)[keyof typeof PaymentTerm];
export const PAYMENT_TERM_VALUES = Object.values(PaymentTerm) as [PaymentTerm, ...PaymentTerm[]];

export const RepeatEvery = {
    DAILY: "DAILY",
    WEEKLY: "WEEKLY",
    BI_WEEKLY: "BI_WEEKLY",
    MONTHLY: "MONTHLY",
} as const;
export type RepeatEvery = (typeof RepeatEvery)[keyof typeof RepeatEvery];
export const REPEAT_EVERY_VALUES = Object.values(RepeatEvery) as [RepeatEvery, ...RepeatEvery[]];

export const ScheduleType = {
    FULL_DAY: "FULL_DAY",
    HALF_DAY: "HALF_DAY",
} as const;
export type ScheduleType = (typeof ScheduleType)[keyof typeof ScheduleType];
export const SCHEDULE_TYPE_VALUES = Object.values(ScheduleType) as [ScheduleType, ...ScheduleType[]];

export const ContactType = {
    SPOC: "SPOC",
    SME: "SME",
    REPORTING_MANAGER: "REPORTING_MANAGER",
} as const;
export type ContactType = (typeof ContactType)[keyof typeof ContactType];
export const CONTACT_TYPE_VALUES = Object.values(ContactType) as [ContactType, ...ContactType[]];

export const JobApplicationStatus = {
    APPLIED: "APPLIED",
    ACCEPTED: "ACCEPTED",
    REJECTED: "REJECTED",
} as const;
export type JobApplicationStatus = (typeof JobApplicationStatus)[keyof typeof JobApplicationStatus];
export const JOB_APPLICATION_STATUS_VALUES = Object.values(JobApplicationStatus) as [JobApplicationStatus, ...JobApplicationStatus[]];

export const JobApplicationAction = {
    ACCEPT: "ACCEPT",
    REJECT: "REJECT",
} as const;
export type JobApplicationAction = (typeof JobApplicationAction)[keyof typeof JobApplicationAction];
export const JOB_APPLICATION_ACTION_VALUES = Object.values(JobApplicationAction) as [JobApplicationAction, ...JobApplicationAction[]];
