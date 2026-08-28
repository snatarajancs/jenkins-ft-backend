import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { UserService } from "../../app/services.js";
import {
    AdminProfileListResponseSchema,
    AdminEngineerProfileResponseSchema,
    AdminReviewRequestSchema,
    AdminReviewResponseSchema,
    ClientProfileResponseSchema,
    ClientProfileUpdateRequestSchema,
    EngineerProfileResponseSchema,
    EngineerProfileUpdateRequestSchema,
} from "../../app/dtos.js";
import { CommonErrorResponses } from "../../../../shared/infra/schema.js";
import { defaultHook } from "../../../../shared/infra/default-hook.js";
import { requireAuth, requireRole, requireAdminRegion } from "../../../../shared/infra/middlewares.js";
import { getJwtPayload } from "../../../../shared/infra/context.js";
import { NotFoundError } from "../../../../shared/domain/errors.js";
import { OPENAPI_TAGS } from "../../../../shared/infra/openapi.js";
import { toUserId, type RegionId } from "../../../../shared/domain/types.js";
import { ACCOUNT_STATUS_VALUES } from "../../domain/entities.js";
import { REVIEWABLE_ROLES } from "../../../auth/domain/roles.js";
import {
    toClientProfileResponse,
    toEngineerProfileResponse,
    toEngineerProfileUpdate,
    toAdminProfileListResponse,
} from "./converters.js";

const USER_TAG = OPENAPI_TAGS.user.name;

export function createUserRoutes(userService: UserService) {
    const app = new OpenAPIHono({ defaultHook });

    // Middleware checking authentication
    app.use(requireAuth);

    // Apply role authorization middleware based on route path
    app.use("/client/*", requireRole(["client"]));
    app.use("/engineer/*", requireRole(["engineer"]));

    // 1. GET /api/client/profile
    app.openapi(
        createRoute({
            operationId: "GetClientProfile",
            method: "get",
            path: "/client/profile",
            tags: [USER_TAG],
            responses: {
                200: {
                    description: "Client profile details",
                    content: { "application/json": { schema: ClientProfileResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const profile = await userService.getClientProfile(payload.userId, payload.regionId);
            if (!profile) {
                throw new NotFoundError("Client profile not found");
            }
            return c.json(toClientProfileResponse(profile), 200);
        }
    );

    // 2. PUT /api/client/profile
    app.openapi(
        createRoute({
            operationId: "UpdateClientProfile",
            method: "put",
            path: "/client/profile",
            tags: [USER_TAG],
            request: {
                body: {
                    content: { "application/json": { schema: ClientProfileUpdateRequestSchema } },
                },
            },
            responses: {
                200: {
                    description: "Client profile updated successfully",
                    content: { "application/json": { schema: ClientProfileResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const body = c.req.valid("json");
            const profile = await userService.updateClientProfile(payload.userId, payload.regionId, body);
            return c.json(toClientProfileResponse(profile), 200);
        }
    );

    // 3. GET /api/engineer/profile
    app.openapi(
        createRoute({
            operationId: "GetEngineerProfile",
            method: "get",
            path: "/engineer/profile",
            tags: [USER_TAG],
            responses: {
                200: {
                    description: "Engineer profile details",
                    content: { "application/json": { schema: EngineerProfileResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const profile = await userService.getEngineerProfile(payload.userId, payload.regionId);
            if (!profile) {
                throw new NotFoundError("Engineer profile not found");
            }
            return c.json(toEngineerProfileResponse(profile), 200);
        }
    );

    // 4. PUT /api/engineer/profile
    app.openapi(
        createRoute({
            operationId: "UpdateEngineerProfile",
            method: "put",
            path: "/engineer/profile",
            tags: [USER_TAG],
            request: {
                body: {
                    content: { "application/json": { schema: EngineerProfileUpdateRequestSchema } },
                },
            },
            responses: {
                200: {
                    description: "Engineer profile updated successfully",
                    content: { "application/json": { schema: EngineerProfileResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const body = c.req.valid("json");
            const profile = await userService.updateEngineerProfile(
                payload.userId,
                payload.regionId,
                toEngineerProfileUpdate(body)
            );
            return c.json(toEngineerProfileResponse(profile), 200);
        }
    );

    // 5. GET /api/users/profiles
    app.openapi(
        {
            method: "get",
            path: "/profiles",
            operationId: "getProfilesList",
            summary: "Get pending profiles for admin review",
            tags: [USER_TAG],
            middleware: [requireAdminRegion] as const,
            request: {
                query: z.object({
                    status: z.enum(ACCOUNT_STATUS_VALUES).optional(),
                    role: z.enum(REVIEWABLE_ROLES).optional(),
                    regionId: z.string().optional().openapi({ description: "Required if global admin" }),
                    page: z.coerce.number().int().positive().optional().default(1),
                    limit: z.coerce.number().int().positive().max(100).optional().default(10),
                }),
            },
            responses: {
                200: {
                    description: "List of pending profiles",
                    content: {
                        "application/json": {
                            schema: AdminProfileListResponseSchema,
                        },
                    },
                },
            },
        },
        async (c) => {
            const regionId = c.get("regionId") as RegionId;
            const { status, role, page, limit } = c.req.valid("query");
            const data = await userService.getPendingProfiles(regionId, status, role, page, limit);
            return c.json(toAdminProfileListResponse(data), 200);
        }
    );

    // 6. GET /api/users/profiles/engineer
    app.openapi(
        {
            method: "get",
            path: "/profiles/engineer",
            operationId: "getEngineerProfileById",
            summary: "Get a specific engineer profile by user ID",
            tags: [USER_TAG],
            middleware: [requireAdminRegion] as const,
            request: {
                query: z.object({
                    userId: z.coerce.number().int().positive().openapi({ description: "Engineer's user ID" }),
                    regionId: z.string().optional().openapi({ description: "Required if global admin" }),
                }),
            },
            responses: {
                200: {
                    description: "Engineer profile details",
                    content: {
                        "application/json": {
                            schema: AdminEngineerProfileResponseSchema,
                        },
                    },
                },
                404: { description: "Engineer not found" },
            },
        },
        async (c) => {
            const regionId = c.get("regionId") as RegionId;
            const { userId } = c.req.valid("query");
            const profile = await userService.getEngineerProfileByUserId(toUserId(userId), regionId);
            if (!profile) {
                throw new NotFoundError("Engineer profile not found");
            }
            return c.json({ ...toEngineerProfileResponse(profile), email: profile.email }, 200);
        }
    );

    // 7. POST /api/users/profiles/:userId/review
    app.openapi(
        {
            method: "post",
            path: "/profiles/{userId}/review",
            operationId: "adminReviewProfile",
            summary: "Review a user profile (Send to BGV, Approve, or Reject)",
            tags: [USER_TAG],
            middleware: [requireAdminRegion] as const,
            request: {
                params: z.object({
                    userId: z.coerce.number().int().positive(),
                }),
                query: z.object({
                    regionId: z.string().optional().openapi({ description: "Required if global admin" }),
                }),
                body: {
                    content: {
                        "application/json": {
                            schema: AdminReviewRequestSchema,
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Profile review processed",
                    content: {
                        "application/json": {
                            schema: AdminReviewResponseSchema,
                        },
                    },
                },
                400: { description: "Validation error" },
                404: { description: "User not found" },
            },
        },
        async (c) => {
            const regionId = c.get("regionId") as RegionId;
            const userId = toUserId(c.req.valid("param").userId);
            const body = c.req.valid("json");

            const result = await userService.reviewProfile(regionId, userId, body.action, body.reason ?? null);
            return c.json(result, 200);
        }
    );

    return app;
}
