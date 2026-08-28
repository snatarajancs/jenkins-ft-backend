export const TRANSACTION_TYPES = {
    credit: "credit",
    debit: "debit",
} as const;
export type TransactionType =
    (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];
export const TRANSACTION_TYPE_VALUES = Object.values(TRANSACTION_TYPES) as [
    TransactionType,
    ...TransactionType[],
];

export const REFERENCE_TYPES = {
    job_post: "job_post",
    deposit: "deposit",
    withdrawal: "withdrawal",
    earning: "earning",
    refund: "refund",
} as const;
export type ReferenceType =
    (typeof REFERENCE_TYPES)[keyof typeof REFERENCE_TYPES];
export const REFERENCE_TYPE_VALUES = Object.values(REFERENCE_TYPES) as [
    ReferenceType,
    ...ReferenceType[],
];

export const TRANSACTION_STATUSES = {
    pending: "pending",
    completed: "completed",
    failed: "failed",
} as const;
export type TransactionStatus =
    (typeof TRANSACTION_STATUSES)[keyof typeof TRANSACTION_STATUSES];
export const TRANSACTION_STATUS_VALUES = Object.values(
    TRANSACTION_STATUSES,
) as [TransactionStatus, ...TransactionStatus[]];
