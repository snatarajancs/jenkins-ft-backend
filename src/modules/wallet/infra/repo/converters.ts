import { wallets, transactions, platformAccounts } from "../schema.global.js";
import type { WalletId, UserId, CurrencyId, PlatformAccountId, RegionId } from "../../../../shared/domain/types.js";
import type { Wallet, Transaction, TransactionType, PlatformAccount } from "../../domain/entities.js";
import type { TransactionStatus } from "../../domain/enums.js";

type WalletRow = typeof wallets.$inferSelect;
type TransactionRow = typeof transactions.$inferSelect;
type PlatformAccountRow = typeof platformAccounts.$inferSelect;

export function toWalletEntity(row: WalletRow): Wallet {
    return {
        id: row.id as WalletId,
        regionId: row.regionId as RegionId,
        userId: row.userId as UserId,
        balance: row.balance,
        currencyId: row.currencyId as CurrencyId,
    };
}

export function toTransactionEntity(row: TransactionRow): Transaction {
    return {
        id: row.id as Transaction["id"],
        walletId: row.walletId as WalletId | null,
        platformAccountId: row.platformAccountId as PlatformAccountId | null,
        type: row.type as TransactionType,
        status: row.status as TransactionStatus,
        amount: row.amount,
        currencyId: row.currencyId as CurrencyId,
        referenceType: row.referenceType,
        referenceId: row.referenceId ?? null,
        createdAt: row.createdAt,
    };
}

export function toPlatformAccountEntity(row: PlatformAccountRow): PlatformAccount {
    return {
        id: row.id as PlatformAccountId,
        balance: row.balance,
        currencyId: row.currencyId as CurrencyId,
    };
}
