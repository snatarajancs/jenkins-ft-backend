import { desc, eq, and, count } from "drizzle-orm";
import type { GlobalDb } from "../../../../shared/domain/db-types.js";
import type {
    WalletRepository,
    TransactionRepository,
    PlatformAccountRepository,
    CreateWalletInput,
    CreateTransactionInput,
    TransactionFilter,
} from "../../domain/repos.js";
import type {
    Wallet,
    Transaction,
    PlatformAccount,
} from "../../domain/entities.js";
import type {
    UserId,
    CurrencyId,
    PlatformAccountId,
    RegionId,
} from "../../../../shared/domain/types.js";
import { wallets, transactions, platformAccounts } from "../schema.global.js";
import {
    toWalletEntity,
    toTransactionEntity,
    toPlatformAccountEntity,
} from "./converters.js";

export class WalletRepositoryImpl implements WalletRepository {
    async findByUserId(
        db: GlobalDb,
        regionId: RegionId,
        userId: UserId,
    ): Promise<Wallet | null> {
        const [row] = await db
            .select()
            .from(wallets)
            .where(
                and(
                    eq(wallets.regionId, regionId),
                    eq(wallets.userId, userId),
                ),
            )
            .limit(1);

        return row ? toWalletEntity(row) : null;
    }

    async create(db: GlobalDb, data: CreateWalletInput): Promise<Wallet> {
        const [row] = await db
            .insert(wallets)
            .values({
                regionId: data.regionId,
                userId: data.userId,
                currencyId: data.currencyId,
            })
            .returning();
        return toWalletEntity(row);
    }

    /**
     * Atomic balance update: positive amount credits/upserts the wallet;
     * negative amount debits with atomic overdraft guard (returns null if insufficient funds).
     * Uses pessimistic locking (.for("update")) within the transaction to prevent race conditions.
     */
    async updateBalance(
        db: GlobalDb,
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: CurrencyId,
    ): Promise<Wallet | null> {
        const [existing] = await db
            .select()
            .from(wallets)
            .where(
                and(
                    eq(wallets.regionId, regionId),
                    eq(wallets.userId, userId),
                ),
            )
            .for("update")
            .limit(1);

        if (existing) {
            const newBalance = existing.balance + amount;

            if (amount < 0 && newBalance < 0) {
                return null;
            }

            const [row] = await db
                .update(wallets)
                .set({
                    balance: newBalance,
                })
                .where(eq(wallets.id, existing.id))
                .returning();
            return toWalletEntity(row);
        } else {
            if (amount < 0) return null;

            const [row] = await db
                .insert(wallets)
                .values({
                    regionId,
                    userId,
                    currencyId,
                    balance: amount,
                })
                .returning();
            return toWalletEntity(row);
        }
    }
}

export class PlatformAccountRepositoryImpl implements PlatformAccountRepository {
    async findByCurrencyId(
        db: GlobalDb,
        currencyId: CurrencyId,
    ): Promise<PlatformAccount | null> {
        const [row] = await db
            .select()
            .from(platformAccounts)
            .where(eq(platformAccounts.currencyId, currencyId))
            .limit(1);
        return row ? toPlatformAccountEntity(row) : null;
    }

    /**
     * Atomic balance update: positive amount credits/upserts the platform account;
     * negative amount debits with atomic overdraft guard (returns null if insufficient funds).
     * Uses pessimistic locking (.for("update")) within the transaction to prevent race conditions.
     */
    async updateBalance(
        db: GlobalDb,
        currencyId: CurrencyId,
        amount: number,
    ): Promise<PlatformAccount | null> {
        const [existing] = await db
            .select()
            .from(platformAccounts)
            .where(eq(platformAccounts.currencyId, currencyId))
            .for("update")
            .limit(1);

        if (existing) {
            const newBalance = existing.balance + amount;

            if (amount < 0 && newBalance < 0) {
                return null;
            }

            const [row] = await db
                .update(platformAccounts)
                .set({
                    balance: newBalance,
                })
                .where(eq(platformAccounts.id, existing.id))
                .returning();
            return toPlatformAccountEntity(row);
        } else {
            if (amount < 0) return null;

            const [row] = await db
                .insert(platformAccounts)
                .values({
                    currencyId,
                    balance: amount,
                })
                .returning();
            return toPlatformAccountEntity(row);
        }
    }
}

export class TransactionRepositoryImpl implements TransactionRepository {
    async find(
        db: GlobalDb,
        filter: TransactionFilter,
        limit: number,
        offset: number,
    ): Promise<{ transactions: Transaction[]; total: number }> {
        const condition = eq(transactions.walletId, filter.walletId);

        const rows = await db
            .select()
            .from(transactions)
            .where(condition)
            .orderBy(desc(transactions.createdAt))
            .limit(limit)
            .offset(offset);

        const [{ count: total }] = await db
            .select({ count: count() })
            .from(transactions)
            .where(condition);

        return {
            transactions: rows.map(toTransactionEntity),
            total,
        };
    }

    async create(
        db: GlobalDb,
        data: CreateTransactionInput,
    ): Promise<Transaction> {
        const [row] = await db
            .insert(transactions)
            .values({
                walletId: data.walletId ?? null,
                platformAccountId: (data.platformAccountId ?? null) as PlatformAccountId | null,
                type: data.type,
                amount: data.amount,
                currencyId: data.currencyId,
                referenceType: data.referenceType,
                referenceId: data.referenceId ?? null,
            })
            .returning();
        return toTransactionEntity(row);
    }
}
