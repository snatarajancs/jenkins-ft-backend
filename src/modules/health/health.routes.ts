import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { HealthService } from "./app/services.js";
import { OPENAPI_TAGS } from "../../shared/infra/openapi.js";

const HealthSchema = z.object({ status: z.literal("ok") });

const DbHealthSuccessSchema = z.object({
    global: z.literal("ok"),
    regional: z.record(z.string(), z.literal("ok")),
});

const DbHealthErrorSchema = z.object({
    error: z.string(),
    details: z.object({
        global: z.enum(["ok", "error"]),
        regional: z.record(z.string(), z.enum(["ok", "error"])),
    }),
});

const HEALTH_TAG = OPENAPI_TAGS.health.name;

const healthRoute = createRoute({
    method: "get",
    path: "/",
    operationId: "HealthGet",
    tags: [HEALTH_TAG],
    responses: {
        200: {
            content: { "application/json": { schema: HealthSchema } },
            description: "Health check",
        },
    },
});

const dbHealthRoute = createRoute({
    method: "get",
    path: "/db",
    operationId: "HealthDbGet",
    tags: [HEALTH_TAG],
    responses: {
        200: {
            content: { "application/json": { schema: DbHealthSuccessSchema } },
            description: "All databases reachable",
        },
        503: {
            content: { "application/json": { schema: DbHealthErrorSchema } },
            description: "One or more databases unreachable",
        },
    },
});

export function createHealthRouter(healthService: HealthService): OpenAPIHono {
    const router = new OpenAPIHono();

    router.openapi(healthRoute, (c) => {
        return c.json({ status: "ok" as const }, 200);
    });

    router.openapi(dbHealthRoute, async (c) => {
        const result = await healthService.checkDbHealth();
        if (result.allHealthy) {
            return c.json(
                { global: "ok" as const, regional: result.regional as Record<string, "ok"> },
                200,
            );
        }
        return c.json(
            {
                error: "Some databases are unreachable",
                details: { global: result.global, regional: result.regional },
            },
            503,
        );
    });

    return router;
}
