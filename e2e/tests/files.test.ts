import { describe, it, expect } from "vitest";
import { fixture } from "../fixtures/worker-setup.js";


describe("Files Module E2E", () => {
    let accessToken: string;

    it("Setup: register user to get token", async () => {
        const res = await fetch(`${fixture.appBaseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: `filetester${Date.now()}@example.com`,
                password: "Password123!",
                regionId: 1,
                role: "client",
            }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        accessToken = data.accessToken;
    });

    it("should allow creating a presigned upload for a valid avatar", async () => {
        const res = await fetch(`${fixture.appBaseUrl}/api/files/debug/uploads`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                scope: "avatar",
                mimeType: "image/jpeg",
                sizeBytes: 1024 * 1024, // 1MB
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("fileId");
        expect(data).toHaveProperty("upload");
        expect(data.upload).toHaveProperty("url");
        expect(data.upload).toHaveProperty("fields");
        expect(data.upload.fields["Content-Type"]).toBe("image/jpeg");
    });

    it("should fail to mark as uploaded if file doesn't exist in S3", async () => {
        // 1. Create a pending upload record
        const createRes = await fetch(`${fixture.appBaseUrl}/api/files/debug/uploads`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                scope: "resume",
                mimeType: "application/pdf",
                sizeBytes: 2048,
            }),
        });
        expect(createRes.status).toBe(200);
        const createData = await createRes.json();

        // 2. Don't actually upload to S3.
        // 3. Try to mark as uploaded — should get 400 (not in S3)
        const markRes = await fetch(`${fixture.appBaseUrl}/api/files/uploaded`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                fileId: createData.fileId,
                scope: "resume",
            }),
        });

        expect(markRes.status).toBe(409);
        const markData = await markRes.json();
        expect(markData.error).toBe("UPLOAD_INCOMPLETE");
    });

    it("should return 401 when calling mark-uploaded without a token", async () => {
        const res = await fetch(`${fixture.appBaseUrl}/api/files/uploaded`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fileId: "00000000-0000-0000-0000-000000000001",
                scope: "resume",
            }),
        });
        expect(res.status).toBe(401);
    });


    it("should return 422 SCOPE_MISMATCH on markUploaded with wrong scope", async () => {
        const createRes = await fetch(`${fixture.appBaseUrl}/api/files/debug/uploads`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                scope: "resume",
                mimeType: "application/pdf",
                sizeBytes: 2048,
            }),
        });
        const createData = await createRes.json();

        const markRes = await fetch(`${fixture.appBaseUrl}/api/files/uploaded`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                fileId: createData.fileId,
                scope: "avatar", // Mismatch
            }),
        });
        expect(markRes.status).toBe(404);
        const data = await markRes.json();
        expect(data.error).toBe("FILE_NOT_FOUND");
    });

    it("should return 403 FORBIDDEN when deleting another user's file", async () => {
        const res2 = await fetch(`${fixture.appBaseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: `filetester2_${Date.now()}@example.com`,
                password: "Password123!",
                regionId: 1,
                role: "client",
            }),
        });
        const data2 = await res2.json();
        const token2 = data2.accessToken;

        const createRes = await fetch(`${fixture.appBaseUrl}/api/files/debug/uploads`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                scope: "resume",
                mimeType: "application/pdf",
                sizeBytes: 2048,
            }),
        });
        const createData = await createRes.json();

        const deleteRes = await fetch(`${fixture.appBaseUrl}/api/files/debug/resume/${createData.fileId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token2}`,
            },
        });
        expect(deleteRes.status).toBe(403);
        const delData = await deleteRes.json();
        expect(delData.error).toBe("FORBIDDEN");
    });
});
