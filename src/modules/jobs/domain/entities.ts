import { JobType, JobStatus, JobMode, PaymentTerm, ScheduleType, JobApplicationStatus } from "./enums.js";
import { JobNotEditableError } from "./errors.js";
import type { WorkAddress, Contacts } from "./value-objects.js";
import type {
    JobId,
    ClientId,
    ClientRegionId,
    JobTitleId,
    SkillLevelId,
    SkillId,
    ToolId,
    AttachmentId,
    CurrencyId,
} from "../../../shared/domain/types.js";

export interface Job {
    id: JobId | null;
    jobNumber: string;
    clientId: ClientId;
    clientRegionId: ClientRegionId;
    jobType: JobType;
    jobStatus: JobStatus;
    jobMode: JobMode;
    paymentTerm: PaymentTerm | null;
    jobTitleId: JobTitleId;
    skillLevelId: SkillLevelId;
    skillIds: SkillId[];
    toolIds: ToolId[];
    description: string;
    workAddress: WorkAddress;
    contacts: Contacts;
    checklist: string[];
    attachmentId: AttachmentId | null;
    startDate: string | null;
    endDate: string | null;
    shiftStartTime: string | null;
    shiftEndTime: string | null;
    scheduleForAllDay: boolean | null;
    isRecurring: boolean | null;
    repeatEvery: string | null;
    totalHours: number | null;
    months: number | null;
    scheduleDates: Array<{ date: string; scheduleType: ScheduleType }>;
    currencyId: CurrencyId;
    currencySymbol: string | null;
    engineerCost: number;
    toolCost: number;
    travelCost: number;
    platformFeePercentage: number;
    totalPrice: number;
    assignedEngineerId: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface JobApplication {
    id?: number;
    jobId: JobId;
    engineerId: number;
    status: JobApplicationStatus;
    appliedAt?: Date;
    reviewedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface EditJobInput {
    paymentTerm?: PaymentTerm | null;
    description?: string;
    workAddress?: WorkAddress;
    contacts?: Contacts;
    checklist?: string[];
    attachmentId?: number | null;
    startDate?: string | null;
    endDate?: string | null;
}

export function assertJobIsEditable(currentStatus: JobStatus): void {
    const mutableStatuses: JobStatus[] = [JobStatus.DRAFT, JobStatus.POSTED];
    if (!mutableStatuses.includes(currentStatus)) {
        throw JobNotEditableError(currentStatus);
    }
}
