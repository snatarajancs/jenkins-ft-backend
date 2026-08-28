import { describe, it, expect } from "vitest";
import { createClient } from "../client/client/index.js";
import {
    authRegister,
    authLogin,
    authRefreshToken,
    authLogout,
} from "../client/sdk.gen.js";
import { fixture } from "../fixtures/worker-setup.js";

const TEST_USER = {
    email: `auth-test-${Date.now()}@example.com`,
    password: "TestPass123!",
    regionId: 1,
    role: "client" as const,
};

describe("Auth routes", () => {
    let accessToken: string;
    let refreshToken: string;

    it("POST /api/auth/register creates a new user", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        const res = await authRegister({ client, body: TEST_USER });
        expect(res.response!.status).toBe(201);
        const data = res.data!;
        expect(data).toHaveProperty("id");
        expect(data.role).toBe("client");
        expect(data.regionId).toBe(1);
        expect(data).toHaveProperty("accessToken");
    });

    it("POST /api/auth/login returns JWT and refresh token cookie", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        const res = await authLogin({
            client,
            body: { email: TEST_USER.email, password: TEST_USER.password },
        });
        expect(res.response!.status).toBe(200);
        const data = res.data!;
        expect(data).toHaveProperty("accessToken");
        expect(data.user.email).toBe(TEST_USER.email);
        expect(data.user.role).toBe("client");
        expect(data.user.regionId).toBe(1);

        const setCookie = res.response!.headers.get("set-cookie");
        expect(setCookie).toBeTruthy();
        expect(setCookie).toContain("refresh_token");

        accessToken = data.accessToken;
        refreshToken = extractCookieValue(setCookie!, "refresh_token");
    });

    it("POST /api/auth/refresh-token returns new access token", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        const res = await authRefreshToken({
            client,
            headers: { Cookie: `refresh_token=${refreshToken}` },
        });
        expect(res.response!.status).toBe(200);
        const data = res.data!;
        expect(data).toHaveProperty("accessToken");
    });

    it("POST /api/auth/logout requires auth and clears tokens", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        const res = await authLogout({
            client,
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        expect(res.response!.status).toBe(200);
        const data = res.data!;
        expect(data).toEqual({ success: true });
    });

    it("POST /api/auth/login with wrong password returns 401", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        const res = await authLogin({
            client,
            body: { email: TEST_USER.email, password: "wrong" },
        });
        expect(res.response!.status).toBe(401);
    });

    it("POST /api/auth/logout without auth returns 401", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });
        const res = await authLogout({ client });
        expect(res.response!.status).toBe(401);
    });
});

function extractCookieValue(cookieHeader: string, name: string): string {
    const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : "";
}
