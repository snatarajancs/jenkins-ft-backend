import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { UserService } from "../../app/services.js";
import { requireAuth, requireAdminRegion } from "../../../../shared/infra/middlewares.js";
import {
    AdminUserFiltersSchema,
    AdminClientResponseSchema,
    AdminEngineerResponseSchema,
    UpdateUserStatusSchema
} from "../../app/dtos.js";
import { type AppHonoEnv, getRequiredRegionId } from "../../../../shared/infra/context.js";

export function createAdminUserRoutes(userService: UserService) {
    const router = new OpenAPIHono<AppHonoEnv>();

    router.use("*", requireAuth, requireAdminRegion);

    const getClientsRoute = createRoute({
        method: "get",
        path: "/clients",
        tags: ["user"],
        request: {
            query: AdminUserFiltersSchema,
        },
        responses: {
            200: {
                content: { "application/json": { schema: AdminClientResponseSchema } },
                description: "List of clients with summary metrics"
            }
        }
    });

    router.openapi(getClientsRoute, async (c) => {
        const filters = c.req.valid("query");
        const regionId = getRequiredRegionId(c);

        const result = await userService.getAdminClients(regionId, filters);
        return c.json(result);
    });

    const getEngineersRoute = createRoute({
        method: "get",
        path: "/engineers",
        tags: ["user"],
        request: {
            query: AdminUserFiltersSchema,
        },
        responses: {
            200: {
                content: { "application/json": { schema: AdminEngineerResponseSchema } },
                description: "List of engineers with summary metrics"
            }
        }
    });

    router.openapi(getEngineersRoute, async (c) => {
        const filters = c.req.valid("query");
        const regionId = getRequiredRegionId(c);

        const result = await userService.getAdminEngineers(regionId, filters);
        return c.json(result);
    });

    const getLocationsRoute = createRoute({
        method: "get",
        path: "/locations",
        tags: ["user"],
        request: {
            query: z.object({
                role: z.enum(["client", "engineer"])
            })
        },
        responses: {
            200: {
                content: { "application/json": { schema: z.array(z.string()) } },
                description: "List of locations (cities) populated by users"
            }
        }
    });

    router.openapi(getLocationsRoute, async (c) => {
        const { role } = c.req.valid("query");
        const regionId = getRequiredRegionId(c);
        return c.json(await userService.getAdminLocations(regionId, role));
    });

    const updateStatusRoute = createRoute({
        method: "post",
        path: "/{userId}/status",
        tags: ["user"],
        request: {
            params: z.object({
                userId: z.coerce.number().int().positive()
            }),
            body: {
                content: { "application/json": { schema: UpdateUserStatusSchema } }
            }
        },
        responses: {
            204: {
                description: "User status updated"
            }
        }
    });

    router.openapi(updateStatusRoute, async (c) => {
        const { userId } = c.req.valid("param");
        const { isActive } = c.req.valid("json");
        const regionId = getRequiredRegionId(c);

        await userService.updateUserActiveStatus(regionId, userId, isActive);
        return c.body(null, 204);
    });

    // TODO: GET /clients/export  — CSV download of filtered client list (LLD §6)
    // TODO: GET /engineers/export — CSV download of filtered engineer list (LLD §6)

    return router;
}

