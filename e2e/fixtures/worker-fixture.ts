import type { ServerType } from "@hono/node-server";
import postgres from "postgres";
import { inject } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import type { OpenAPIHono } from "@hono/zod-openapi";

export class WorkerFixture {
    readonly workerId: string;
    readonly appPort: number;
    readonly appBaseUrl: string;
    private appServer: ServerType | null = null;
    private honoApp: OpenAPIHono | null = null;
    private outboxRelay: { start: () => void; stop: () => void } | null = null;

    constructor() {
        this.workerId = process.env["VITEST_WORKER_ID"] ?? "0";
        this.appPort = 39000 + Number(this.workerId);
        this.appBaseUrl = `http://localhost:${this.appPort}`;
    }

    async setup(): Promise<void> {
        const globalDbUrl = inject(`E2E_GLOBAL_DB_${this.workerId}`);
        if (typeof globalDbUrl !== "string") throw new Error(`E2E_GLOBAL_DB_${this.workerId} not provided`);

        const regionConfigsJson = inject(`E2E_REGION_CONFIGS_${this.workerId}`);
        if (typeof regionConfigsJson !== "string") throw new Error(`E2E_REGION_CONFIGS_${this.workerId} not provided`);

        const minioEndpoint = inject("E2E_MINIO_ENDPOINT") as string;

        process.env["NODE_ENV"] = "test";
        process.env["GLOBAL_DATABASE_URL"] = globalDbUrl;
        process.env["REGION_CONFIGS"] = regionConfigsJson;
        process.env["JWT_SECRET"] = "test_jwt_secret_for_e2e_at_least_32_chars";
        process.env["JWT_ACCESS_EXPIRY"] = "1 hr";
        process.env["JWT_REFRESH_EXPIRY"] = "1 day";
        process.env["AWS_REGION"] = "us-east-1";
        process.env["AWS_ACCESS_KEY_ID"] = "minioadmin";
        process.env["AWS_SECRET_ACCESS_KEY"] = "minioadmin";
        process.env["AWS_ENDPOINT_URL"] = minioEndpoint || "http://localhost:9000";
        process.env["GLOBAL_S3_BUCKET"] = "test-global-bucket";
        process.env["ENABLE_DEBUG_ENDPOINTS"] = "true";
        // Run migrations
        const globalClient = postgres(globalDbUrl, { max: 1 });
        const globalDbForMigration = drizzle({ client: globalClient });
        await migrate(globalDbForMigration, { migrationsFolder: "migrations/global" });
        await globalClient.end();

        const regionConfigs = JSON.parse(regionConfigsJson);
        for (const cfg of regionConfigs) {
            const client = postgres(cfg.dbUrl, { max: 1 });
            const db = drizzle({ client });
            await migrate(db, { migrationsFolder: "migrations/regional" });
            await client.end();
        }

        // Create app after env vars are set
        const { resetConfig } = await import("../../src/shared/infra/config.js");
        resetConfig();
        const { makeApp } = await import("../../src/bootstrap/app.js");
        const { app, outboxRelay } = makeApp();
        this.honoApp = app;
        this.outboxRelay = outboxRelay;
        this.outboxRelay.start();

        const { serve } = await import("@hono/node-server");
        await new Promise<void>((resolve) => {
            this.appServer = serve({ fetch: app.fetch, port: this.appPort }, () => resolve());
        });
    }

    async cleanup(): Promise<void> {
        const globalDbUrl = process.env["GLOBAL_DATABASE_URL"];
        if (globalDbUrl) {
            const sql = postgres(globalDbUrl, { max: 1 });
            try {
                const tables = await sql<{ tablename: string }[]>`
                    SELECT tablename FROM pg_tables
                    WHERE schemaname = 'public' AND tablename != 'drizzle_migrations'
                `;
                if (tables.length > 0) {
                    const tableList = tables.map((t) => `"${t.tablename}"`).join(", ");
                    await sql.unsafe(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`);
                }
            } finally {
                await sql.end();
            }
        }
        const regionConfigsRaw = process.env["REGION_CONFIGS"];
        if (regionConfigsRaw) {
            const regionConfigs = JSON.parse(regionConfigsRaw);
            for (const cfg of regionConfigs) {
                const sql = postgres(cfg.dbUrl, { max: 1 });
                try {
                    const tables = await sql<{ tablename: string }[]>`
                        SELECT tablename FROM pg_tables
                        WHERE schemaname = 'public' AND tablename != 'drizzle_migrations'
                    `;
                    if (tables.length > 0) {
                        const tableList = tables.map((t) => `"${t.tablename}"`).join(", ");
                        await sql.unsafe(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`);
                    }
                } finally {
                    await sql.end();
                }
            }
        }
    }

    async teardown(): Promise<void> {
        if (this.outboxRelay) {
            this.outboxRelay.stop();
            this.outboxRelay = null;
        }
        if (this.appServer) {
            await new Promise<void>((resolve, reject) => {
                this.appServer!.close((err) => (err ? reject(err) : resolve()));
            });
            this.appServer = null;
        }
    }
}
