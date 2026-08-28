import type { TransactionId, WalletId, UserId, CurrencyId, PlatformAccountId, RegionId } from "../../../shared/domain/types.js";
import type { TransactionType, ReferenceType, TransactionStatus } from "./enums.js";

export {
    TRANSACTION_TYPES,
    type TransactionType,
    TRANSACTION_TYPE_VALUES,
    REFERENCE_TYPES,
    type ReferenceType,
    REFERENCE_TYPE_VALUES,
    TRANSACTION_STATUSES,
    type TransactionStatus,
} from "./enums.js";

export interface Currency {
    id: CurrencyId;
    code: string;
    symbol: string;
    name: string;
}

export interface PlatformAccount {
    id: PlatformAccountId;
    balance: number;
    currencyId: CurrencyId;
}

export interface Wallet {
    id: WalletId;
    regionId: RegionId;
    userId: UserId;
    balance: number;
    currencyId: CurrencyId;
}

export interface Transaction {
    id: TransactionId;
    walletId: WalletId | null;
    platformAccountId: PlatformAccountId | null;
    type: TransactionType;
    status: TransactionStatus;
    amount: number;
    currencyId: CurrencyId;
    referenceType: ReferenceType;
    referenceId: number | null;
    createdAt: Date;
}
