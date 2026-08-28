import type { GlobalDb } from "../../../shared/domain/db-types.js";
import type { Wallet, Transaction, TransactionType, PlatformAccount } from "./entities.js";
import type { ReferenceType } from "./enums.js";
import type { UserId, WalletId, CurrencyId, PlatformAccountId, RegionId } from "../../../shared/domain/types.js";

export interface CreateWalletInput {
    regionId: RegionId;
    userId: UserId;
    currencyId: CurrencyId;
}

export interface CreateTransactionInput {
    walletId?: WalletId | null;
    platformAccountId?: PlatformAccountId | null;
    type: TransactionType;
    amount: number;
    currencyId: CurrencyId;
    referenceType: ReferenceType;
    referenceId?: number | null;
}

/** Filter for the unified transaction query. */
export interface TransactionFilter {
    walletId: WalletId;
}

export interface WalletRepository {
    findByUserId(db: GlobalDb, regionId: RegionId, userId: UserId): Promise<Wallet | null>;
    create(db: GlobalDb, data: CreateWalletInput): Promise<Wallet>;
    /**
     * Updates wallet balance. Positive amount credits/upserts; negative amount debits
     * with atomic balance check (returning null if insufficient funds).
     */
    updateBalance(
        db: GlobalDb,
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: CurrencyId,
    ): Promise<Wallet | null>;
}

export interface PlatformAccountRepository {
    findByCurrencyId(db: GlobalDb, currencyId: CurrencyId): Promise<PlatformAccount | null>;
    /**
     * Updates platform account balance. Positive amount credits/upserts; negative amount debits
     * with atomic balance check (returning null if insufficient funds).
     */
    updateBalance(
        db: GlobalDb,
        currencyId: CurrencyId,
        amount: number,
    ): Promise<PlatformAccount | null>;
}

export interface TransactionRepository {
    find(
        db: GlobalDb,
        filter: TransactionFilter,
        limit: number,
        offset: number,
    ): Promise<{ transactions: Transaction[]; total: number }>;
    create(db: GlobalDb, data: CreateTransactionInput): Promise<Transaction>;
}
