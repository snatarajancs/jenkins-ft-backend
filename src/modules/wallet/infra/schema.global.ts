import {
    pgTable,
    serial,
    integer,
    numeric,
    text,
    timestamp,
    pgEnum,
    unique,
} from "drizzle-orm/pg-core";
import {
    REFERENCE_TYPE_VALUES,
    TRANSACTION_STATUS_VALUES,
    TRANSACTION_TYPE_VALUES,
} from "../domain/enums.js";

export const currencies = pgTable("currencies", {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
});

export const transactionTypeEnum = pgEnum("transaction_type", [
    ...TRANSACTION_TYPE_VALUES,
]);
export const referenceTypeEnum = pgEnum("reference_type", [
    ...REFERENCE_TYPE_VALUES,
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
    ...TRANSACTION_STATUS_VALUES,
]);

export const platformAccounts = pgTable(
    "platform_accounts",
    {
        id: serial("id").primaryKey(),
        balance: numeric("balance", { precision: 12, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        currencyId: integer("currency_id")
            .notNull()
            .references(() => currencies.id),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (t) => [unique("uq_platform_accounts_currency").on(t.currencyId)],
);

export const wallets = pgTable(
    "wallets",
    {
        id: serial("id").primaryKey(),
        regionId: integer("region_id").notNull(),
        userId: integer("user_id").notNull(),
        balance: numeric("balance", { precision: 12, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        currencyId: integer("currency_id")
            .notNull()
            .references(() => currencies.id),
        updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
    },
    (t) => [unique("uq_wallets_region_user").on(t.regionId, t.userId)],
);

export const transactions = pgTable("transactions", {
    id: serial("id").primaryKey(),
    walletId: integer("wallet_id").references(() => wallets.id),
    platformAccountId: integer("platform_account_id").references(
        () => platformAccounts.id,
    ),
    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    currencyId: integer("currency_id")
        .notNull()
        .references(() => currencies.id),
    referenceType: referenceTypeEnum("reference_type").notNull(),
    referenceId: integer("reference_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});
