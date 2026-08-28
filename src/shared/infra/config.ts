import { z } from "zod";

export const regionConfigSchema = z.object({
    regionId: z.coerce.number().int().positive(),
    dbUrl: z.string(),
    s3Bucket: z.string().optional(),
    awsRegion: z.string(),
    awsEndpoint: z.string().optional(),
});

export type RegionConfig = z.infer<typeof regionConfigSchema>;

const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
        PORT: z.coerce.number().default(3000),
        GLOBAL_DATABASE_URL: z.string(),
        GLOBAL_S3_BUCKET: z.string(),
        REGION_CONFIGS: z.string().optional().transform((val) => {
            if (!val) return undefined;
            try {
                return regionConfigSchema.array().parse(JSON.parse(val));
            } catch {
                throw new Error(`Invalid REGION_CONFIGS JSON`);
            }
        }),
        JWT_SECRET: z.string(),
        JWT_ACCESS_EXPIRY: z.string().default("15 min"),
        JWT_REFRESH_EXPIRY: z.string().default("1 day"),
        AWS_REGION: z.string().default("us-east-1"),
        AWS_ACCESS_KEY_ID: z.string().optional(),
        AWS_SECRET_ACCESS_KEY: z.string().optional(),
        AWS_ENDPOINT_URL: z.string().optional(),
        S3_PRESIGN_EXPIRES_SECONDS: z.coerce.number().default(900),
        ENABLE_DEBUG_ENDPOINTS: z.coerce.boolean().optional().default(false),
        CORS_ALLOWED_ORIGINS: z.string().optional().transform((val) => {
            if (!val || val.trim() === "") return undefined;
            return val.split(",").map((o) => o.trim()).filter(Boolean);
        }),
    });

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

export function loadConfig(throwOnError = false): AppConfig {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        if (throwOnError) throw result.error;
        console.error("Invalid environment configuration");
        console.error(result.error.format());
        process.exit(1);
    }
    cachedConfig = result.data;
    return cachedConfig;
}

export function getConfig(): AppConfig {
    if (!cachedConfig) throw new Error("Configuration not loaded. Call loadConfig() first.");
    return cachedConfig;
}

export function resetConfig(): void {
    cachedConfig = null;
}
