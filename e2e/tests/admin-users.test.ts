import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "../client/client/index.js";
import { authRegister, authLogin, updateClientProfile } from "../client/sdk.gen.js";
import { fixture } from "../fixtures/worker-setup.js";

function adminGet(path: string, token: string, query?: Record<string, string>) {
    const url = new URL(`${fixture.appBaseUrl}/api/admin/users${path}`);
    if (query) {
        Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

function adminPost(path: string, token: string, body: unknown) {
    return fetch(`${fixture.appBaseUrl}/api/admin/users${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function register(role: "client" | "engineer" | "admin", regionId: number) {
    const sdk = createClient({ baseUrl: fixture.appBaseUrl });
    const email = `${role}-${regionId}-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test`;
    const res = await authRegister({
        client: sdk,
        body: {
            email,
            password: "TestPass123!",
            regionId,
            role,
        },
    });
    if (res.response!.status !== 201) throw new Error(`Register failed: ${res.response!.status}`);
    return { ...res.data!, email };
}

async function login(email: string, password: string) {
    const sdk = createClient({ baseUrl: fixture.appBaseUrl });
    return authLogin({ client: sdk, body: { email, password } });
}

let regionalAdminToken: string;
let clientToken: string;
let engineerToken: string;
let suspendTargetEmail: string;
let suspendTargetUserId: number;

beforeAll(async () => {
    const regionalAdmin = await register("admin", 1);
    regionalAdminToken = regionalAdmin.accessToken;

    const sdk = createClient({ baseUrl: fixture.appBaseUrl });
    const clientUser = await register("client", 1);
    clientToken = clientUser.accessToken;

    await updateClientProfile({
        client: sdk,
        headers: { Authorization: `Bearer ${clientToken}` },
        body: {
            firstName: "Alice",
            lastName: "Admin",
            mobileNumber: "+911234567890",
            companyName: "Test Corp",
            address: "1 Test St",
            city: "Mumbai",
            postalCode: "400001",
            country: "India",
        },
    });

    const engineerUser = await register("engineer", 1);
    engineerToken = engineerUser.accessToken;

    const suspendTarget = await register("client", 1);
    suspendTargetEmail = suspendTarget.email;
    suspendTargetUserId = suspendTarget.id;
});

describe("Admin User Management — Role Enforcement", () => {
    it("GET /clients returns 403 for a client user", async () => {
        const res = await adminGet("/clients", clientToken, { regionId: "1" });
        expect(res.status).toBe(403);
    });

    it("GET /clients returns 403 for an engineer user", async () => {
        const res = await adminGet("/clients", engineerToken, { regionId: "1" });
        expect(res.status).toBe(403);
    });

    it("GET /clients returns 401 with no token", async () => {
        const res = await fetch(`${fixture.appBaseUrl}/api/admin/users/clients?regionId=1`);
        expect(res.status).toBe(401);
    });
});

describe("Admin User Management — Regional Isolation", () => {
    it("regional admin cannot query a different region", async () => {
        const res = await adminGet("/clients", regionalAdminToken, { regionId: "2" });
        expect(res.status).toBe(403);
    });

    it("regional admin gets their region's users without regionId param", async () => {
        const res = await adminGet("/clients", regionalAdminToken);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.data)).toBe(true);
    });
});

describe("Admin User Management — Clients List", () => {
    it("returns correct summary and pagination shape", async () => {
        const res = await adminGet("/clients", regionalAdminToken);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.summary).toMatchObject({
            totalCount: expect.any(Number),
            activeCount: expect.any(Number),
            suspendedCount: expect.any(Number),
            activityDistribution: {
                active: expect.any(Number),
                inactive: expect.any(Number),
                suspended: expect.any(Number),
            },
        });
        expect(body.pagination).toMatchObject({
            total: expect.any(Number),
            page: expect.any(Number),
            limit: expect.any(Number),
            totalPages: expect.any(Number),
        });
    });

    it("search by name filters results", async () => {
        const res = await adminGet("/clients", regionalAdminToken, { search: "Alice" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.length).toBeGreaterThan(0);
        expect(body.data[0].name).toContain("Alice");
    });

    it("search with no match returns empty data", async () => {
        const res = await adminGet("/clients", regionalAdminToken, { search: "zzznomatch" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveLength(0);
    });

    it("limit=1 returns at most 1 record", async () => {
        const res = await adminGet("/clients", regionalAdminToken, { limit: "1", page: "1" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.length).toBeLessThanOrEqual(1);
        expect(body.pagination.limit).toBe(1);
    });

    it("status=active returns only Active records", async () => {
        const res = await adminGet("/clients", regionalAdminToken, { status: "active" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.every((u: { status: string }) => u.status === "Active")).toBe(true);
    });

    it("sortBy=name&sortOrder=asc returns alphabetically sorted results", async () => {
        const res = await adminGet("/clients", regionalAdminToken, { sortBy: "name", sortOrder: "asc" });
        expect(res.status).toBe(200);
        const body = await res.json();
        const names: string[] = body.data.map((u: { name: string }) => u.name);
        expect(names).toEqual([...names].sort());
    });
});

describe("Admin User Management — Engineers List", () => {
    it("returns correct structure", async () => {
        const res = await adminGet("/engineers", regionalAdminToken);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty("data");
        expect(body).toHaveProperty("summary");
        expect(body).toHaveProperty("pagination");
    });

    it("engineers without profile have Pending status and null jobMode", async () => {
        const res = await adminGet("/engineers", regionalAdminToken, { status: "pending" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.length).toBeGreaterThan(0);
        expect(body.data[0].status).toBe("Pending");
        expect(body.data[0].jobMode).toBeNull();
    });
});

describe("Admin User Management — Locations", () => {
    it("returns list of cities for role=client", async () => {
        const res = await adminGet("/locations", regionalAdminToken, { role: "client" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body).toContain("Mumbai");
    });

    it("returns 422 when role param is missing", async () => {
        const res = await adminGet("/locations", regionalAdminToken);
        expect(res.status).toBe(422);
    });
});

describe("Admin User Management — Account Suspension", () => {
    it("suspending a user sets their status to Suspended", async () => {
        const res = await adminPost(`/${suspendTargetUserId}/status`, regionalAdminToken, { isActive: false });
        expect(res.status).toBe(204);

        const listRes = await adminGet("/clients", regionalAdminToken, { status: "suspended" });
        expect(listRes.status).toBe(200);
        const body = await listRes.json();
        const found = body.data.find((u: { userId: number }) => u.userId === suspendTargetUserId);
        expect(found?.status).toBe("Suspended");
    });

    it("suspended user cannot log in", async () => {
        const loginRes = await login(suspendTargetEmail, "TestPass123!");
        expect(loginRes.response!.status).toBe(401);
    });

    it("reactivating a user sets their status back to Pending (no profile)", async () => {
        const res = await adminPost(`/${suspendTargetUserId}/status`, regionalAdminToken, { isActive: true });
        expect(res.status).toBe(204);

        const listRes = await adminGet("/clients", regionalAdminToken, { status: "pending" });
        expect(listRes.status).toBe(200);
        const body = await listRes.json();
        const found = body.data.find((u: { userId: number }) => u.userId === suspendTargetUserId);
        expect(found?.status).toBe("Pending");
    });

    it("invalid body returns 422", async () => {
        const res = await adminPost(`/${suspendTargetUserId}/status`, regionalAdminToken, { isActive: "yes" });
        expect(res.status).toBe(422);
    });
});
