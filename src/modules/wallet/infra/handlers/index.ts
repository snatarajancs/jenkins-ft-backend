import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { WalletService } from "../../app/services.js";
import {
    GetTransactionsQuerySchema,
    AddFundsRequestSchema,
    WithdrawMoneyRequestSchema,
    WalletResponseSchema,
    GetTransactionsResponseSchema,
    AddFundsResponseSchema,
    WithdrawMoneyResponseSchema,
} from "../../app/dtos.js";
import { requireAuth } from "../../../../shared/infra/middlewares.js";
import { getJwtPayload } from "../../../../shared/infra/context.js";
import { CommonErrorResponses } from "../../../../shared/infra/schema.js";
import { defaultHook } from "../../../../shared/infra/default-hook.js";
import { OPENAPI_TAGS } from "../../../../shared/infra/openapi.js";

const WALLET_TAG = OPENAPI_TAGS.wallet.name;

export function createWalletRoutes(walletService: WalletService) {
    const app = new OpenAPIHono({ defaultHook });

    app.use("*", requireAuth);

    app.openapi(
        createRoute({
            method: "get",
            path: "/",
            operationId: "GetWallet",
            tags: [WALLET_TAG],
            responses: {
                200: {
                    content: {
                        "application/json": { schema: WalletResponseSchema },
                    },
                    description: "Get wallet details",
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const res = await walletService.getWallet(
                payload.regionId,
                payload.userId,
            );
            return c.json(res, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/transactions",
            operationId: "GetTransactions",
            tags: [WALLET_TAG],
            request: { query: GetTransactionsQuerySchema },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: GetTransactionsResponseSchema,
                        },
                    },
                    description: "Get wallet transactions",
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const { page, limit } = c.req.valid("query");
            const res = await walletService.getTransactions(
                payload.regionId,
                payload.userId,
                page,
                limit,
            );
            return c.json(res, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/add-funds",
            operationId: "AddFunds",
            tags: [WALLET_TAG],
            request: {
                body: {
                    content: {
                        "application/json": { schema: AddFundsRequestSchema },
                    },
                },
            },
            responses: {
                200: {
                    content: {
                        "application/json": { schema: AddFundsResponseSchema },
                    },
                    description: "Add funds to wallet",
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const { amount, currencyId } = c.req.valid("json");
            const res = await walletService.addFunds(
                payload.regionId,
                payload.userId,
                amount,
                currencyId,
            );
            return c.json(res, 200);
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/withdraw",
            operationId: "WithdrawMoney",
            tags: [WALLET_TAG],
            request: {
                body: {
                    content: {
                        "application/json": {
                            schema: WithdrawMoneyRequestSchema,
                        },
                    },
                },
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: WithdrawMoneyResponseSchema,
                        },
                    },
                    description: "Withdraw money from wallet",
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const { amount, currencyId } = c.req.valid("json");
            const res = await walletService.withdrawMoney(
                payload.regionId,
                payload.userId,
                amount,
                currencyId,
            );
            return c.json(res, 200);
        },
    );

    return app;
}
