import { describe, it, expect } from "vitest";
import { createClient } from "../client/client/index.js";
import {
    getProfilesList,
    adminReviewProfile,
} from "../client/sdk.gen.js";
import { fixture } from "../fixtures/worker-setup.js";
import { createEngineerProfile, createAdminUser } from "../helpers/user-setup.js";

describe("Admin BGV Review Flow", () => {
    it("allows admin to view pending profiles and update their statuses", async () => {
        const client = createClient({ baseUrl: fixture.appBaseUrl });

        // 1. Setup Data using helpers
        const { engineerId } = await createEngineerProfile(client);
        const { adminAuthHeader } = await createAdminUser(client);

        // 2. Admin fetches pending profiles
        const pendingRes = await getProfilesList({
            client,
            query: {
                regionId: "1",
                role: "engineer",
                status: "submitted",
            },
            headers: { Authorization: adminAuthHeader },
        });
        expect(pendingRes.response!.status).toBe(200);
        
        const profiles = pendingRes.data!.profiles;
        // The newly registered engineer should be in the list
        const foundEngineer = profiles.find((p) => p.userId === engineerId);
        expect(foundEngineer).toBeDefined();
        expect(foundEngineer!.accountStatus).toBe("submitted");
        
        // Assert UI placeholder stubs are present
        expect(foundEngineer!.documents).toBe("#1");
        expect(foundEngineer!.category).toBe("IT Solutions");
        expect(foundEngineer!.verifiedDate).toBeNull(); // null because status is 'submitted'

        // Assert summary counts are present and valid
        const summary = pendingRes.data!.summary;
        expect(summary.pending).toBeGreaterThanOrEqual(1); // at least our engineer is pending
        expect(summary.inProgress).toBeGreaterThanOrEqual(0);
        expect(summary.completed).toBeGreaterThanOrEqual(0);
        expect(summary.rejected).toBeGreaterThanOrEqual(0);

        // Assert pagination metadata is present
        const pagination = pendingRes.data!.pagination;
        expect(pagination.page).toBe(1);
        expect(pagination.limit).toBe(10);
        expect(pagination.total).toBeGreaterThanOrEqual(1);

        // 3. Admin reviews profile (Send to BGV)
        const reviewRes = await adminReviewProfile({
            client,
            path: { userId: engineerId },
            body: { action: "send_for_bgv" },
            headers: { Authorization: adminAuthHeader },
        });
        expect(reviewRes.response!.status).toBe(200);
        expect(reviewRes.data!.accountStatus).toBe("in_progress");

        // Note: The mock webhook waits 10 seconds to transition to bgv_completed.

        // 4. Admin rejects the profile
        const rejectRes = await adminReviewProfile({
            client,
            path: { userId: engineerId },
            body: { action: "reject", reason: "Incomplete details" },
            headers: { Authorization: adminAuthHeader },
        });
        expect(rejectRes.response!.status).toBe(200);
        expect(rejectRes.data!.accountStatus).toBe("rejected");

        // 5. Admin approves the profile
        const approveRes = await adminReviewProfile({
            client,
            path: { userId: engineerId },
            body: { action: "approve" },
            headers: { Authorization: adminAuthHeader },
        });
        expect(approveRes.response!.status).toBe(200);
        expect(approveRes.data!.accountStatus).toBe("verified");
    });
});
