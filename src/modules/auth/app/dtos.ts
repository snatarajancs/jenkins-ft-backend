import { z } from "@hono/zod-openapi";
import { ROLE_VALUES } from "../domain/roles.js";
import { RegionIdSchema } from "../../../shared/infra/id-schemas.js";

export const LoginRequestSchema = z
    .object({
        email: z.string().email(),
        password: z.string().min(1),
    })
    .openapi("LoginRequest");

export const LoginResponseSchema = z
    .object({
        accessToken: z.string(),
        user: z.object({
            id: z.number(),
            email: z.string(),
            role: z.enum(ROLE_VALUES),
            regionId: z.number(),
        }),
    })
    .openapi("LoginResponse");

export const RegisterRequestSchema = z
    .object({
        email: z.string().email(),
        password: z.string().min(8),
        regionId: RegionIdSchema,
        role: z.enum(ROLE_VALUES),
    })
    .openapi("RegisterRequest");

export const RegisterResponseSchema = z
    .object({
        id: z.number(),
        role: z.enum(ROLE_VALUES),
        regionId: z.number(),
        accessToken: z.string(),
    })
    .openapi("RegisterResponse");

export const RefreshTokenResponseSchema = z
    .object({
        accessToken: z.string(),
    })
    .openapi("RefreshTokenResponse");

export const LogoutResponseSchema = z
    .object({
        success: z.literal(true),
    })
    .openapi("LogoutResponse");

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type RefreshTokenResponse = z.infer<typeof RefreshTokenResponseSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
