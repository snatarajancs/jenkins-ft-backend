import { describe, it, expect } from "vitest";
import postgres from "postgres";
import { createClient } from "../client/client/index.js";
import { authRegister } from "../client/sdk.gen.js";
import { fixture } from "../fixtures/worker-setup.js";

/**
 * Polls the outbox_events table until the most recent EMAIL event reaches
 * the expected status, or the timeout is exceeded.
 */
async function pollOutboxStatus(
    dbUrl: string,
    expectedStatus: string,
    timeoutMs = 12_000,
    intervalMs = 1_000,
): Promise<string> {
    const sql = postgres(dbUrl, { max: 1 });
    const deadline = Date.now() + timeoutMs;
    let lastStatus = "";

    try {
        while (Date.now() < deadline) {
            const rows = await sql<{ status: string }[]>`
                SELECT status FROM outbox_events
                WHERE type = 'EMAIL'
                ORDER BY created_at DESC
                LIMIT 1
            `;
            lastStatus = rows[0]?.status ?? "";
            if (lastStatus === expectedStatus) break;
            await new Promise((r) => setTimeout(r, intervalMs));
        }
    } finally {
        await sql.end();
    }

    return lastStatus;
}

describe("Outbox pipeline — user sign-up", () => {
    it("register inserts an EMAIL event in outbox_events atomically", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });

        await authRegister({
            client,
            body: {
                email: `outbox-insert-${Date.now()}@example.com`,
                password: "TestPass123!",
                regionId: 1,
                role: "client",
            },
        });

        // Connect directly to the global DB and assert the row was created
        // TODO: Refactor this to only observe API responses or API side effects
        // DB access in E2E tests is generally an anti-pattern.
        const dbUrl = process.env["GLOBAL_DATABASE_URL"]!;


        const sql = postgres(dbUrl, { max: 1 });
        const rows = await sql<{ type: string; status: string; payload: unknown }[]>`
            SELECT type, status, payload FROM outbox_events
            WHERE type = 'EMAIL'
            ORDER BY created_at DESC
            LIMIT 1
        `;
        await sql.end();

        expect(rows).toHaveLength(1);
        expect(rows[0].type).toBe("EMAIL");
        // Must be one of the valid pre-relay statuses (relay may have already picked it up)
        expect(["pending", "processing", "processed"]).toContain(rows[0].status);

        const payload = rows[0].payload as Record<string, string>;
        expect(payload).toHaveProperty("to");
        expect(payload).toHaveProperty("subject");
        expect(payload.subject).toBe("Welcome to Field Techy");
    });

    it("outbox relay processes the EMAIL event to 'processed' within 12s", { timeout: 20_000 }, async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });

        await authRegister({
            client,
            body: {
                email: `outbox-relay-${Date.now()}@example.com`,
                password: "TestPass123!",
                regionId: 1,
                role: "client",
            },
        });

        // TODO: Refactor this to only observe API responses or API side effects
        // DB access in E2E tests is generally an anti-pattern.
        const dbUrl = process.env["GLOBAL_DATABASE_URL"]!;

        const finalStatus = await pollOutboxStatus(dbUrl, "processed");

        expect(finalStatus).toBe("processed");
    });

    it("outbox relay handles permanent failure for fail@example.com", { timeout: 20_000 }, async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        await authRegister({
            client,
            body: {
                email: `fail@example.com`,
                password: "TestPass123!",
                regionId: 1,
                role: "client",
            },
        });
        const dbUrl = process.env["GLOBAL_DATABASE_URL"]!;
        const finalStatus = await pollOutboxStatus(dbUrl, "failed");
        expect(finalStatus).toBe("failed");
    });

    it("outbox relay handles retryable failure for retry@example.com", { timeout: 20_000 }, async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        await authRegister({
            client,
            body: {
                email: `retry@example.com`,
                password: "TestPass123!",
                regionId: 1,
                role: "client",
            },
        });
        const dbUrl = process.env["GLOBAL_DATABASE_URL"]!;
        const finalStatus = await pollOutboxStatus(dbUrl, "retryable");
        expect(finalStatus).toBe("retryable");
    });

    it("outbox relay handles exception for throw@example.com", { timeout: 20_000 }, async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        await authRegister({
            client,
            body: {
                email: `throw@example.com`,
                password: "TestPass123!",
                regionId: 1,
                role: "client",
            },
        });
        const dbUrl = process.env["GLOBAL_DATABASE_URL"]!;
        const finalStatus = await pollOutboxStatus(dbUrl, "retryable");
        expect(finalStatus).toBe("retryable");
    });
});
