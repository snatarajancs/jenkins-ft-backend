import type { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import { z } from "@hono/zod-openapi";
import { getConfig } from "./config.js";
import { UnauthorizedError, ForbiddenError, ClientError } from "../domain/errors.js";
import type { AppHonoEnv } from "./context.js";
import { getJwtPayload } from "./context.js";
import { RegionIdSchema, UserIdSchema, RegionIdParamSchema } from "./id-schemas.js";
import { ROLE_VALUES } from "../../modules/auth/domain/roles.js";
import type { Role } from "../../modules/auth/domain/roles.js";

const jwtPayloadSchema = z.object({
    userId: UserIdSchema,
    regionId: RegionIdSchema,
    role: z.enum(ROLE_VALUES),
    sub: z.string(),
    iat: z.number().optional(),
    exp: z.number().optional(),
});

export const requireAuth: MiddlewareHandler<AppHonoEnv> = async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        throw new UnauthorizedError("Missing or invalid Authorization header");
    }
    const token = authHeader.slice(7);
    try {
        const verified = await verify(token, getConfig().JWT_SECRET, "HS256");
        const payload = jwtPayloadSchema.parse(verified);
        c.set("jwtPayload", payload);
        c.set("userId", payload.userId);
        c.set("regionId", payload.regionId);
        c.set("role", payload.role);
        await next();
    } catch {
        throw new UnauthorizedError("Invalid or expired JWT");
    }
};

export function requireRole(
    allowedRoles: Role[],
): MiddlewareHandler<AppHonoEnv> {
    return async (c, next) => {
        const payload = getJwtPayload(c);
        if (!allowedRoles.includes(payload.role)) {
            throw new ForbiddenError("Insufficient permissions");
        }
        await next();
    };
}

export const requireAdmin: MiddlewareHandler<AppHonoEnv> = async (c, next) => {
    const payload = getJwtPayload(c);
    if (payload.role !== "admin") {
        throw new ForbiddenError("Admin access required");
    }
    await next();
};

export const requireClient: MiddlewareHandler<AppHonoEnv> = async (c, next) => {
    const payload = getJwtPayload(c);
    if (payload.role !== "client") {
        throw new ForbiddenError("Client access required");
    }
    await next();
};

export const requireEngineer: MiddlewareHandler<AppHonoEnv> = async (c, next) => {
    const payload = getJwtPayload(c);
    if (payload.role !== "engineer") {
        throw new ForbiddenError("Engineer access required");
    }
    await next();
};

export const requireAdminRegion: MiddlewareHandler<AppHonoEnv> = async (c, next) => {
    await requireAdmin(c, async () => {});
    const payload = getJwtPayload(c);
    const requestedRegionIdRaw = c.req.query("regionId");
    const parsedRegionId = requestedRegionIdRaw !== undefined
        ? RegionIdParamSchema.safeParse(requestedRegionIdRaw)
        : undefined;
    if (requestedRegionIdRaw !== undefined && !parsedRegionId!.success) {
        throw new ClientError("regionId query parameter must be a positive integer");
    }
    const requestedRegionId = parsedRegionId?.success ? parsedRegionId.data : undefined;
    if (payload.regionId === -1) {
        if (!requestedRegionId) {
            throw new ClientError("regionId query parameter is required for global admin access");
        }
        c.set("regionId", requestedRegionId);
        await next();
        return;
    }
    if (requestedRegionId && requestedRegionId !== payload.regionId) {
        throw new ForbiddenError("Admin cannot access data outside assigned region");
    }
    c.set("regionId", payload.regionId);
    await next();
};
