import { z } from "@hono/zod-openapi";
import {
    TRANSACTION_TYPE_VALUES,
    REFERENCE_TYPE_VALUES,
    TRANSACTION_STATUS_VALUES,
} from "../domain/enums.js";

export const GetTransactionsQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().optional().default(10),
}).openapi("GetTransactionsQuery");



const MoneyRequestBase = z.object({
    amount: z.number().positive(),
    currencyId: z.number().int().positive(),
});

const MoneyResponseBase = z.object({
    success: z.boolean(),
    message: z.string(),
    newBalance: z.number(),
    currencyId: z.number().int().positive(),
});



export const AddFundsRequestSchema = MoneyRequestBase.openapi("AddFundsRequest");
export const WithdrawMoneyRequestSchema = MoneyRequestBase.openapi("WithdrawMoneyRequest");

export const AddFundsResponseSchema = MoneyResponseBase.openapi("AddFundsResponse");
export const WithdrawMoneyResponseSchema = MoneyResponseBase.openapi("WithdrawMoneyResponse");


export const WalletSchema = z.object({
    balance: z.number(),
    currencyId: z.number().int().positive(),
    currencyCode: z.string(),
}).openapi("Wallet");

export const WalletResponseSchema = WalletSchema.openapi("WalletResponse");


export const TransactionSchema = z.object({
    id: z.number(),
    walletId: z.number().nullable(),
    platformAccountId: z.number().nullable(),
    type: z.enum(TRANSACTION_TYPE_VALUES),
    status: z.enum(TRANSACTION_STATUS_VALUES),
    amount: z.number(),
    currencyId: z.number().int().positive(),
    referenceType: z.enum(REFERENCE_TYPE_VALUES),
    referenceId: z.number().nullable(),
    createdAt: z.coerce.date(),
}).openapi("Transaction");

export const GetTransactionsResponseSchema = z.object({
    transactions: z.array(TransactionSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
}).openapi("GetTransactionsResponse");



export type GetTransactionsQuery = z.infer<typeof GetTransactionsQuerySchema>;
export type AddFundsRequest = z.infer<typeof AddFundsRequestSchema>;
export type WithdrawMoneyRequest = z.infer<typeof WithdrawMoneyRequestSchema>;
export type WalletResponse = z.infer<typeof WalletResponseSchema>;
export type GetTransactionsResponse = z.infer<typeof GetTransactionsResponseSchema>;
export type AddFundsResponse = z.infer<typeof AddFundsResponseSchema>;
export type WithdrawMoneyResponse = z.infer<typeof WithdrawMoneyResponseSchema>;
