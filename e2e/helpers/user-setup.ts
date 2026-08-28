import { authRegister, updateEngineerProfile } from "../client/sdk.gen.js";
import type { Client } from "../client/client/index.js";

export async function createEngineerProfile(client: Client) {
    const engineerRes = await authRegister({
        client,
        body: {
            email: `engineer-${Date.now()}@example.com`,
            password: "Password1!",
            regionId: 1,
            role: "engineer",
        },
    });

    const engineerId = engineerRes.data!.id;
    const engineerToken = engineerRes.data!.accessToken;
    const engineerAuthHeader = `Bearer ${engineerToken}`;

    await updateEngineerProfile({
        client,
        body: {
            firstName: "John",
            lastName: "Doe",
            mobileNumber: "1234567890",
            address: "123 Main St",
            city: "New York",
            postalCode: "10001",
            country: "USA",
            experience: 5,
            minRate: 50,
            maxRate: 100,
            onsite: true,
            remote: true,
            travel: false,
            skillLevelId: 1,
            skills: [],
            tools: [],
        },
        headers: { Authorization: engineerAuthHeader },
    });

    return { engineerId, engineerToken, engineerAuthHeader };
}

export async function createAdminUser(client: Client) {
    const adminRes = await authRegister({
        client,
        body: {
            email: `admin-${Date.now()}@example.com`,
            password: "AdminPassword1!",
            regionId: 1,
            role: "admin",
        },
    });

    const adminId = adminRes.data!.id;
    const adminToken = adminRes.data!.accessToken;
    const adminAuthHeader = `Bearer ${adminToken}`;

    return { adminId, adminToken, adminAuthHeader };
}
