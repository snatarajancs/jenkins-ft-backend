import type { Context } from "hono";
import type { DbContext } from "../domain/db-types.js";
import type { RegionId, UserId } from "../domain/types.js";
import type { Role } from "../../modules/auth/domain/roles.js";

export type JWTPayload = {
    userId: UserId;
    regionId: RegionId;
    role: Role;
    sub: string;
    iat?: number;
    exp?: number;
};

export type AppVariables = {
    jwtPayload?: JWTPayload;
    regionId?: RegionId;
    role?: Role;
    userId?: UserId;
    dbCtx?: DbContext;
};

export type AppHonoEnv = {
    Variables: AppVariables;
};

export type AppContext = Context<AppHonoEnv>;

export function getJwtPayload(c: Context): JWTPayload {
    const payload = c.get("jwtPayload");
    if (!payload) throw new Error("JWT payload not found in context");
    return payload as unknown as JWTPayload;
}

export function getOptionalRegionId(c: Context): RegionId | undefined {
    return c.get("regionId");
}

export function getRequiredRegionId(c: Context): RegionId {
    const regionId = c.get("regionId");
    if (!Number.isInteger(regionId) || regionId <= 0) {
        throw new Error("Region context is missing or invalid");
    }
    return regionId;
}

export function getDbCtx(c: Context): DbContext | undefined {
    return c.get("dbCtx");
}

export function getRequiredDbCtx(c: Context): DbContext {
    const dbCtx = c.get("dbCtx");
    if (!dbCtx) throw new Error("Database transaction context is missing");
    return dbCtx;
}
