import { userRegionMap } from "../modules/auth/infra/schema.global.js";
import { skillLevels } from "../modules/user/infra/schema.global.js";
import {
    currencies,
    wallets,
    transactions,
    platformAccounts,
    transactionTypeEnum,
    referenceTypeEnum,
    transactionStatusEnum,
} from "../modules/wallet/infra/schema.global.js";
import {
    jobs,
    jobContacts,
    jobChecklistItems,
    jobScheduleDates,
    jobSkills,
    jobTools,
    jobTypeEnum,
    jobStatusEnum,
    jobModeEnum,
    paymentTermEnum,
    scheduleTypeEnum,
    contactTypeEnum,
} from "../modules/jobs/infra/schema.global.js";
import { files as globalFiles, globalFileScopeEnum, globalFileStatusEnum } from "../modules/files/infra/schema.global.js";
import { outboxEvents, outboxStatusEnum } from "../modules/outbox/infra/schema.global.js";

export const globalSchema = {
    userRegionMap,
    skillLevels,
    currencies,
    wallets,
    transactions,
    platformAccounts,
    transactionTypeEnum,
    referenceTypeEnum,
    transactionStatusEnum,
    jobs,
    jobContacts,
    jobChecklistItems,
    jobScheduleDates,
    jobSkills,
    jobTools,
    jobTypeEnum,
    jobStatusEnum,
    jobModeEnum,
    paymentTermEnum,
    scheduleTypeEnum,
    contactTypeEnum,
    globalFiles,
    globalFileScopeEnum,
    globalFileStatusEnum,
    outboxEvents,
    outboxStatusEnum,
};
