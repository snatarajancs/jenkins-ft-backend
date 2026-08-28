import { describe, it, expect } from "vitest";
import { createClient } from "../client/client/index.js";
import {
    authRegister,
    getClientProfile,
    updateClientProfile,
    getEngineerProfile,
    updateEngineerProfile,
} from "../client/sdk.gen.js";
import { fixture } from "../fixtures/worker-setup.js";

describe("Profile routes", () => {
    it("completes Client and Engineer profile flows successfully", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });

        // --- 1. Client Signup ---
        const clientEmail = `client-profile-${Date.now()}@example.com`;
        const clientRes = await authRegister({
            client,
            body: {
                email: clientEmail,
                password: "ClientPassword1!",
                regionId: 1,
                role: "client",
            },
        });
        expect(clientRes.response!.status).toBe(201);
        const clientData = clientRes.data!;
        expect(clientData.role).toBe("client");
        expect(clientData.regionId).toBe(1);
        const clientToken = clientData.accessToken;

        const authHeader = `Bearer ${clientToken}`;

        // --- 2. Retrieve Empty Client Profile Stub (returns 404 since no stub is pre-created) ---
        const clientGetRes = await getClientProfile({
            client,
            headers: { Authorization: authHeader },
        });
        expect(clientGetRes.response!.status).toBe(404);

        // --- 3. Update Client Profile (first time creates the record) ---
        const clientUpdateRes = await updateClientProfile({
            client,
            body: {
                firstName: "Jane",
                lastName: "Smith",
                mobileNumber: "+919000000001",
                companyName: "Acme Industries",
                address: "42 Galaxy Way",
                city: "Chennai",
                postalCode: "600001",
                country: "India",
                hearAboutUs: "Google Search",
            },
            headers: { Authorization: authHeader },
        });
        expect(clientUpdateRes.response!.status).toBe(200);
        const clientProfileUpdated = clientUpdateRes.data!;
        expect(clientProfileUpdated.firstName).toBe("Jane");
        expect(clientProfileUpdated.companyName).toBe("Acme Industries");
        expect(clientProfileUpdated.hearAboutUs).toBe("Google Search");

        // --- 4. Re-retrieve Client Profile ---
        const clientGetRes2 = await getClientProfile({
            client,
            headers: { Authorization: authHeader },
        });
        expect(clientGetRes2.response!.status).toBe(200);
        const clientProfile = clientGetRes2.data!;
        expect(clientProfile.userId).toBe(clientData.id);
        expect(clientProfile.firstName).toBe("Jane");

        // --- 5. Engineer Signup ---
        const engineerEmail = `engineer-profile-${Date.now()}@example.com`;
        const engineerRes = await authRegister({
            client,
            body: {
                email: engineerEmail,
                password: "EngineerPassword1!",
                regionId: 1,
                role: "engineer",
            },
        });
        expect(engineerRes.response!.status).toBe(201);
        const engineerData = engineerRes.data!;
        expect(engineerData.role).toBe("engineer");
        expect(engineerData.regionId).toBe(1);
        const engineerToken = engineerData.accessToken;

        const engineerAuthHeader = `Bearer ${engineerToken}`;

        // --- 6. Retrieve Empty Engineer Profile (returns 404 since no stub is pre-created) ---
        const engineerGetRes = await getEngineerProfile({
            client,
            headers: { Authorization: engineerAuthHeader },
        });
        expect(engineerGetRes.response!.status).toBe(404);

        // --- 7. Cross-Role Authorization Check (Forbidden) ---
        const forbiddenRes = await getClientProfile({
            client,
            headers: { Authorization: engineerAuthHeader },
        });
        expect(forbiddenRes.response!.status).toBe(403);

        // --- 8. Update Engineer Profile (first time creates the record and skills/tools) ---
        const engineerUpdateRes = await updateEngineerProfile({
            client,
            body: {
                firstName: "Bob",
                lastName: "Builder",
                mobileNumber: "+919000000002",
                address: "1 Hammer Rd",
                city: "Bangalore",
                postalCode: "560001",
                country: "India",
                experience: 5,
                minRate: 25,
                maxRate: 50,
                onsite: true,
                remote: false,
                travel: true,
                skillLevelId: 2,
                skills: [10, 11],
                tools: [101, 102],
            },
            headers: { Authorization: engineerAuthHeader },
        });
        expect(engineerUpdateRes.response!.status).toBe(200);
        const engineerProfileUpdated = engineerUpdateRes.data!;
        expect(engineerProfileUpdated.firstName).toBe("Bob");
        expect(engineerProfileUpdated.experience).toBe(5);
        expect(engineerProfileUpdated.onsite).toBe(true);
        expect(engineerProfileUpdated.remote).toBe(false);
        expect(engineerProfileUpdated.skillLevelId).toBe(2);

        // --- 9. Re-retrieve Profile and Verify Skills/Tools Mapping ---
        const engineerGetUpdatedRes = await getEngineerProfile({
            client,
            headers: { Authorization: engineerAuthHeader },
        });
        expect(engineerGetUpdatedRes.response!.status).toBe(200);
        const engineerProfileFinal = engineerGetUpdatedRes.data!;
        expect(engineerProfileFinal.skills).toHaveLength(2);
        expect(engineerProfileFinal.skills[0].skillId).toBe(10);
        expect(engineerProfileFinal.tools).toHaveLength(2);
        expect(engineerProfileFinal.tools[0].toolId).toBe(101);
    });
});
