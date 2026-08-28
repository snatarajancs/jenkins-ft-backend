import { describe, it, expect } from "vitest";
import { createClient } from "../client/client/index.js";
import {
    healthGet,
    healthDbGet,
} from "../client/sdk.gen.js";
import { fixture } from "../fixtures/worker-setup.js";

describe("Health routes", () => {
    it("GET /health returns 200 and {status: ok}", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        const res = await healthGet({ client });
        expect(res.response!.status).toBe(200);
        const data = res.data!;
        expect(data).toEqual({ status: "ok" });
    });

    it("GET /health/db returns 200 with global and regional status", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        const res = await healthDbGet({ client });
        expect(res.response!.status).toBe(200);
        const data = res.data!;
        expect(data).toHaveProperty("global");
        expect(data).toHaveProperty("regional");
        expect(data.global).toBe("ok");
        expect(typeof data.regional).toBe("object");
    });
});
