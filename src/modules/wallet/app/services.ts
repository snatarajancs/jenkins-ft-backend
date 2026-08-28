import type { UnitOfWork } from "../../../shared/domain/unit-of-work.js";
import type {
    WalletRepository,
    TransactionRepository,
    PlatformAccountRepository,
} from "../domain/repos.js";
import {
    toCurrencyId,
    type RegionId,
    type UserId,
    type WalletId,
    type CurrencyId,
    type PlatformAccountId,
} from "../../../shared/domain/types.js";
import { NotFoundError, ClientError } from "../../../shared/domain/errors.js";
import {
    TRANSACTION_TYPES,
    REFERENCE_TYPES,
    type ReferenceType,
} from "../domain/enums.js";
import { eq } from "drizzle-orm";
import { currencies } from "../infra/schema.global.js";
import type { GlobalDb } from "../../../shared/domain/db-types.js";
import type {
    WalletResponse,
    GetTransactionsResponse,
    AddFundsResponse,
    WithdrawMoneyResponse,
} from "./dtos.js";


export interface WalletService {
    getWallet(regionId: RegionId, userId: UserId): Promise<WalletResponse>;
    getTransactions(
        regionId: RegionId,
        userId: UserId,
        page: number,
        limit: number,
    ): Promise<GetTransactionsResponse>;

    addFunds(
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: number,
    ): Promise<AddFundsResponse>;
    withdrawMoney(
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: number,
    ): Promise<WithdrawMoneyResponse>;

    increaseWallet(
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: number,
        referenceType: ReferenceType,
        referenceId?: number,
    ): Promise<{ success: boolean; balance: number }>;
    decreaseWallet(
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: number,
        referenceType: ReferenceType,
        referenceId?: number,
    ): Promise<{ success: boolean; balance: number }>;
}


/**
 * Asserts the wallet exists and has sufficient funds.
 * Call after a failed updateBalance (debit) to surface the correct domain error.
 */
async function assertWalletSolvent(
    walletRepo: WalletRepository,
    db: GlobalDb,
    regionId: RegionId,
    userId: UserId,
): Promise<never> {
    const existing = await walletRepo.findByUserId(
        db,
        regionId,
        userId,
    );
    if (!existing) {
        throw new NotFoundError("Wallet not found");
    }
    throw new ClientError("Insufficient funds");
}

/**
 * Creates a double-entry ledger pair: one transaction against the user
 * wallet and one against the platform account.
 */
async function createDoubleEntryLedger(
    transactionRepo: TransactionRepository,
    db: GlobalDb,
    walletId: WalletId,
    platformAccountId: number,
    amount: number,
    currencyId: CurrencyId,
    referenceType: ReferenceType,
    referenceId: number | null,
    walletTxType: "credit" | "debit",
): Promise<void> {
    const platformTxType =
        walletTxType === "credit"
            ? TRANSACTION_TYPES.debit
            : TRANSACTION_TYPES.credit;

    await Promise.all([
        transactionRepo.create(db, {
            walletId,
            type: TRANSACTION_TYPES[walletTxType],
            amount,
            currencyId,
            referenceType,
            referenceId,
        }),
        transactionRepo.create(db, {
            platformAccountId: platformAccountId as PlatformAccountId,
            type: platformTxType,
            amount,
            currencyId,
            referenceType,
            referenceId,
        }),
    ]);
}

export class WalletServiceImpl implements WalletService {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly walletRepo: WalletRepository,
        private readonly transactionRepo: TransactionRepository,
        private readonly platformAccountRepo: PlatformAccountRepository,
    ) {}

    async getWallet(
        regionId: RegionId,
        userId: UserId,
    ): Promise<WalletResponse> {
        const globalDb = this.uow.getGlobalDb();
        const userWallet = await this.walletRepo.findByUserId(
            globalDb,
            regionId,
            userId,
        );

        if (!userWallet) {
            const defaultCurrencyId = toCurrencyId(regionId === 2 ? 2 : 1);
            const [defaultCurrency] = await globalDb
                .select()
                .from(currencies)
                .where(eq(currencies.id, defaultCurrencyId))
                .limit(1);

            return {
                balance: 0,
                currencyId: defaultCurrencyId,
                currencyCode: defaultCurrency?.code ?? (defaultCurrencyId === 2 ? "GBP" : "INR"),
            };
        }

        const [currency] = await globalDb
            .select()
            .from(currencies)
            .where(eq(currencies.id, userWallet.currencyId))
            .limit(1);

        return {
            balance: userWallet.balance,
            currencyId: userWallet.currencyId,
            currencyCode: currency?.code ?? "UNKNOWN",
        };
    }

    async getTransactions(
        regionId: RegionId,
        userId: UserId,
        page: number,
        limit: number,
    ) {
        const globalDb = this.uow.getGlobalDb();
        const userWallet = await this.walletRepo.findByUserId(
            globalDb,
            regionId,
            userId,
        );
        if (!userWallet) {
            return { transactions: [], total: 0, page, limit };
        }
        const offset = (page - 1) * limit;
        const result = await this.transactionRepo.find(
            globalDb,
            { walletId: userWallet.id },
            limit,
            offset,
        );
        return { ...result, page, limit };
    }

    async addFunds(
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: number,
    ) {
        return await this.uow.globalTransaction(async (db) => {
            const cId = toCurrencyId(currencyId);
            const wallet = await this.walletRepo.updateBalance(
                db,
                regionId,
                userId,
                amount,
                cId,
            );
            await this.transactionRepo.create(db, {
                walletId: wallet!.id,
                type: TRANSACTION_TYPES.credit,
                amount,
                currencyId: cId,
                referenceType: REFERENCE_TYPES.deposit,
            });
            return {
                success: true,
                message: `Successfully added ${amount} to wallet.`,
                newBalance: wallet!.balance,
                currencyId: cId,
            };
        });
    }

    async withdrawMoney(
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: number,
    ) {
        return await this.uow.globalTransaction(async (db) => {
            const cId = toCurrencyId(currencyId);
            const wallet = await this.walletRepo.updateBalance(
                db,
                regionId,
                userId,
                -amount,
                cId,
            );
            if (!wallet) {
                await assertWalletSolvent(this.walletRepo, db, regionId, userId);
            }
            await this.transactionRepo.create(db, {
                walletId: wallet!.id,
                type: TRANSACTION_TYPES.debit,
                amount,
                currencyId: cId,
                referenceType: REFERENCE_TYPES.withdrawal,
            });
            return {
                success: true,
                message: `Successfully withdrew ${amount} from wallet.`,
                newBalance: wallet!.balance,
                currencyId: cId,
            };
        });
    }

    // -----------------------------------------------------------------------
    // WalletService (Internal System Actions)
    // -----------------------------------------------------------------------

    async increaseWallet(
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: number,
        referenceType: ReferenceType,
        referenceId?: number,
    ) {
        return await this.uow.globalTransaction(async (db) => {
            const cId = toCurrencyId(currencyId);
            const refId = referenceId ?? null;

            // Debit platform account first
            const platformAccount =
                await this.platformAccountRepo.updateBalance(
                    db,
                    cId,
                    -amount,
                );
            if (!platformAccount) {
                throw new ClientError("Insufficient platform funds");
            }

            // Credit user wallet
            const wallet = await this.walletRepo.updateBalance(
                db,
                regionId,
                userId,
                amount,
                cId,
            );

            await createDoubleEntryLedger(
                this.transactionRepo,
                db,
                wallet!.id,
                platformAccount.id,
                amount,
                cId,
                referenceType,
                refId,
                "credit",
            );

            return { success: true, balance: wallet!.balance };
        });
    }

    async decreaseWallet(
        regionId: RegionId,
        userId: UserId,
        amount: number,
        currencyId: number,
        referenceType: ReferenceType,
        referenceId?: number,
    ) {
        return await this.uow.globalTransaction(async (db) => {
            const cId = toCurrencyId(currencyId);
            const refId = referenceId ?? null;

            // Credit platform account
            const platformAccount =
                await this.platformAccountRepo.updateBalance(
                    db,
                    cId,
                    amount,
                );

            // Debit user wallet
            const wallet = await this.walletRepo.updateBalance(
                db,
                regionId,
                userId,
                -amount,
                cId,
            );
            if (!wallet) {
                await assertWalletSolvent(this.walletRepo, db, regionId, userId);
            }

            await createDoubleEntryLedger(
                this.transactionRepo,
                db,
                wallet!.id,
                platformAccount!.id,
                amount,
                cId,
                referenceType,
                refId,
                "debit",
            );

            return { success: true, balance: wallet!.balance };
        });
    }
}
