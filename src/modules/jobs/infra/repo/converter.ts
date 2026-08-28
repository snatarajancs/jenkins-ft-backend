import { jobs, jobApplications } from "../schema.global.js";
import type { Job, JobApplication } from "../../domain/entities.js";
import { ContactType, type JobType, type JobStatus, type JobMode, type PaymentTerm, type ScheduleType, type JobApplicationStatus } from "../../domain/enums.js";
import type { Contacts, ContactPerson, WorkAddress } from "../../domain/value-objects.js";
import {
    toJobId,
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
} from "../../../../shared/domain/types.js";

function mapSharedJobFields(entity: Job) {
    return {
        paymentTerm: entity.paymentTerm,
        description: entity.description,
        countryId: entity.workAddress.countryId,
        stateId: entity.workAddress.stateId,
        cityId: entity.workAddress.cityId,
        postalCode: entity.workAddress.postalCode,
        streetAddress: entity.workAddress.streetAddress,
        apartmentUnit: entity.workAddress.apartmentUnit,
        attachmentId: entity.attachmentId,
        startDate: entity.startDate ? new Date(entity.startDate) : null,
        endDate: entity.endDate ? new Date(entity.endDate) : null,
        totalHours: entity.totalHours,
        shiftStartTime: entity.shiftStartTime,
        shiftEndTime: entity.shiftEndTime,
        scheduleForAllDay: entity.scheduleForAllDay,
        isRecurring: entity.isRecurring,
        repeatEvery: entity.repeatEvery,
        months: entity.months,
    };
}

export function mapJobToInsertValues(entity: Job) {
    return {
        jobNumber: entity.jobNumber,
        clientId: entity.clientId,
        clientRegionId: entity.clientRegionId,
        jobType: entity.jobType,
        jobStatus: entity.jobStatus,
        jobMode: entity.jobMode,
        jobTitleId: entity.jobTitleId,
        skillLevelId: entity.skillLevelId,
        currencyId: entity.currencyId,
        ...mapSharedJobFields(entity),
        engineerCost: entity.engineerCost,
        toolCost: entity.toolCost,
        travelCost: entity.travelCost,
        platformFeePercentage: entity.platformFeePercentage,
        totalPrice: entity.totalPrice,
    };
}

export function mapJobToUpdateValues(entity: Job) {
    return {
        jobStatus: entity.jobStatus,
        ...mapSharedJobFields(entity),
    };
}

export function mapContactsToInsertValues(
    jobId: number,
    contacts?: Contacts | null,
): Array<{ jobId: number; contactType: ContactType; name: string; phone: string; email: string }> {
    if (!contacts) return [];

    const contactEntries: Array<[ContactType, ContactPerson | undefined]> = [
        [ContactType.SPOC, contacts.spoc],
        [ContactType.SME, contacts.sme],
        [ContactType.REPORTING_MANAGER, contacts.reportingManager],
    ];

    return contactEntries
        .filter((entry): entry is [ContactType, ContactPerson] => Boolean(entry[1]))
        .map(([contactType, person]) => ({
            jobId,
            contactType,
            name: person.name,
            phone: person.phone,
            email: person.email,
        }));
}

export function mapChecklistToInsertValues(
    jobId: number,
    checklist?: string[] | null,
): Array<{ jobId: number; taskName: string }> {
    if (!checklist || checklist.length === 0) return [];
    return checklist.map((taskName) => ({
        jobId,
        taskName,
    }));
}

const contactFieldMap: Record<ContactType, keyof Contacts> = {
    [ContactType.SPOC]: "spoc",
    [ContactType.SME]: "sme",
    [ContactType.REPORTING_MANAGER]: "reportingManager",
};

export function mapRowsToContacts(
    contactRows: Array<{ contactType: string; name: string; phone: string; email: string }>,
): Contacts {
    return contactRows.reduce((acc, c) => {
        const key = contactFieldMap[c.contactType as ContactType];
        if (key) {
            acc[key] = { name: c.name, phone: c.phone, email: c.email };
        }
        return acc;
    }, {} as Contacts);
}

export function mapRowsToChecklist(
    checklistRows: Array<{ taskName: string }>,
): string[] {
    return checklistRows.map((item) => item.taskName);
}

export function mapRowToJobEntity(
    row: typeof jobs.$inferSelect,
    skillIds: number[] = [],
    toolIds: number[] = [],
    scheduleDates: Array<{ date: string; scheduleType: ScheduleType }> = [],
    contacts: Contacts = {},
    checklist: string[] = [],
    assignedEngineerId: number | null = null,
): Job {
    const { id, clientId, clientRegionId, jobTitleId, skillLevelId, currencyId, attachmentId, countryId, stateId, cityId, postalCode, streetAddress, apartmentUnit, startDate, endDate, ...jobFields } = row;

    const workAddress: WorkAddress = {
        countryId: toCountryId(countryId),
        stateId: toStateId(stateId),
        cityId: toCityId(cityId),
        postalCode,
        streetAddress,
        apartmentUnit,
    };

    return {
        ...jobFields,
        id: id ? toJobId(id) : null,
        clientId: toClientId(clientId),
        clientRegionId: toClientRegionId(clientRegionId),
        jobTitleId: toJobTitleId(jobTitleId),
        skillLevelId: toSkillLevelId(skillLevelId),
        currencyId: toCurrencyId(currencyId),
        currencySymbol: null,
        attachmentId: attachmentId ? toAttachmentId(attachmentId) : null,
        assignedEngineerId: assignedEngineerId ?? null,
        jobType: jobFields.jobType as JobType,
        jobStatus: jobFields.jobStatus as JobStatus,
        jobMode: jobFields.jobMode as JobMode,
        paymentTerm: (jobFields.paymentTerm as PaymentTerm) ?? null,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        workAddress,
        skillIds: skillIds.map(toSkillId),
        toolIds: toolIds.map(toToolId),
        scheduleDates,
        contacts,
        checklist,
        createdAt: row.createdAt ?? null,
        updatedAt: row.updatedAt ?? null,
    };
}

export function mapRowToJobApplicationEntity(
    row: typeof jobApplications.$inferSelect,
): JobApplication {
    return {
        ...row,
        jobId: toJobId(row.jobId),
        status: row.status as JobApplicationStatus,
    };
}


