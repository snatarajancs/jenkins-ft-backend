import { z } from "@hono/zod-openapi";

export const RegionIdSchema = z.number().int().positive().brand("RegionId");
export const UserIdSchema = z.number().int().positive().brand("UserId");
export const RegionIdParamSchema = z.coerce.number().int().positive().brand("RegionId");


