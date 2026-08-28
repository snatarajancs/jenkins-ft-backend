import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import ms from "ms";
import type { StringValue } from "ms";
import type { AuthService } from "../../app/services.js";
import {
    LoginRequestSchema,
    LoginResponseSchema,
    RegisterRequestSchema,
    RegisterResponseSchema,
    LogoutResponseSchema,
    RefreshTokenResponseSchema,
} from "../../app/dtos.js";
import { CommonErrorResponses } from "../../../../shared/infra/schema.js";
import { OPENAPI_TAGS } from "../../../../shared/infra/openapi.js";
import { defaultHook } from "../../../../shared/infra/default-hook.js";
import { requireAuth } from "../../../../shared/infra/middlewares.js";
import { getJwtPayload } from "../../../../shared/infra/context.js";

const AUTH_TAG = OPENAPI_TAGS.auth.name;

export function createAuthRoutes(authService: AuthService, enableDebug = false) {
    const app = new OpenAPIHono({ defaultHook });

    app.openapi(
        createRoute({
            operationId: "AuthRegister",
            method: "post",
            path: "/register",
            tags: [AUTH_TAG],
            request: {
                body: {
                    content: { "application/json": { schema: RegisterRequestSchema } },
                },
            },
            responses: {
                201: {
                    description: "Registration successful",
                    content: { "application/json": { schema: RegisterResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const body = c.req.valid("json");
            const { data, refreshTokenValue } = await authService.register(body);
            setCookie(c, "refresh_token", refreshTokenValue, {
                httpOnly: true,
                secure: true,
                sameSite: "Lax",
                path: "/api/auth",
                maxAge: ms("7 days" as StringValue) / 1000,
            });
            return c.json(data, 201);
        },
    );

    app.openapi(
        createRoute({
            operationId: "AuthLogin",
            method: "post",
            path: "/login",
            tags: [AUTH_TAG],
            request: {
                body: {
                    content: { "application/json": { schema: LoginRequestSchema } },
                },
            },
            responses: {
                200: {
                    description: "Login successful",
                    content: { "application/json": { schema: LoginResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const body = c.req.valid("json");
            const { data, refreshTokenValue } = await authService.login(body);
            setCookie(c, "refresh_token", refreshTokenValue, {
                httpOnly: true,
                secure: true,
                sameSite: "Lax",
                path: "/api/auth",
                maxAge: ms("7 days" as StringValue) / 1000,
            });
            return c.json(data, 200);
        },
    );

    app.openapi(
        createRoute({
            operationId: "AuthRefreshToken",
            method: "post",
            path: "/refresh-token",
            tags: [AUTH_TAG],
            responses: {
                200: {
                    description: "Token refreshed",
                    content: { "application/json": { schema: RefreshTokenResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const token = getCookie(c, "refresh_token");
            const result = await authService.refreshToken(token ?? "");
            return c.json(result, 200);
        },
    );

    app.use("/logout", requireAuth);

    app.openapi(
        createRoute({
            operationId: "AuthLogout",
            method: "post",
            path: "/logout",
            tags: [AUTH_TAG],
            responses: {
                200: {
                    description: "Logout successful",
                    content: { "application/json": { schema: LogoutResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const result = await authService.logout(payload.regionId, payload.userId);
            deleteCookie(c, "refresh_token", { path: "/api/auth" });
            return c.json(result, 200);
        },
    );

    if (enableDebug) {
        app.openapi(
            createRoute({
                operationId: "DebugDbReset",
                method: "post",
                path: "/debug/reset",
                tags: [AUTH_TAG],
                responses: {
                    200: {
                        description: "Test only - clear all refresh tokens",
                        content: { "application/json": { schema: LogoutResponseSchema } },
                    },
                },
            }),
            async (c) => {
                const payload = getJwtPayload(c);
                await authService.logout(payload.regionId, payload.userId);
                return c.json({ success: true as const }, 200);
            },
        );
    }

    return app;
}
