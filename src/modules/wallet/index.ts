export type { WalletService } from "./app/services.js";
export type {
    WalletResponse,
    GetTransactionsResponse,
    AddFundsResponse,
    WithdrawMoneyResponse,
    GetTransactionsQuery,
    AddFundsRequest,
    WithdrawMoneyRequest,
} from "./app/dtos.js";
export type { Wallet, Transaction, PlatformAccount } from "./domain/entities.js";
export {
    REFERENCE_TYPES,
    TRANSACTION_TYPES,
    TRANSACTION_STATUSES,
    type TransactionType,
    type ReferenceType,
    type TransactionStatus,
} from "./domain/enums.js";
