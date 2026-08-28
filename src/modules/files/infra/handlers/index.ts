import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import type { FileService } from "../../domain/file-service.js";
import { uploadedCallbackSchema, createUploadSchema, FileIdParamSchema } from "../../app/dtos.js";
import { requireAuth } from "../../../../shared/infra/middlewares.js";
import { getJwtPayload } from "../../../../shared/infra/context.js";
import type { FileId } from "../../../../shared/domain/types.js";
import type { FileScope } from "../../domain/entities.js";
import { FILE_SCOPE_VALUES } from "../../domain/enums.js";
import { CommonErrorResponses } from "../../../../shared/infra/schema.js";
import { defaultHook } from "../../../../shared/infra/default-hook.js";

export function createFileRoutes(fileService: FileService, enableDebug: boolean) {
    const router = new OpenAPIHono({ defaultHook });

    // Permanent API
    router.openapi(
        createRoute({
            method: "post",
            path: "/uploaded",
            tags: ["files"],
            summary: "Mark file as uploaded",
            description: "Confirm that a file was successfully uploaded to the presigned S3 URL",
            middleware: [requireAuth] as const,
            request: {
                body: {
                    content: { "application/json": { schema: uploadedCallbackSchema } },
                },
            },
            responses: {
                200: {
                    description: "Success",
                    content: { "application/json": { schema: z.object({}) } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const { userId, regionId } = getJwtPayload(c);
            const input = c.req.valid("json");

            const result = await fileService.markUploaded({
                userId,
                regionId,
                fileId: input.fileId as FileId,
                scope: input.scope as FileScope,
            });

            return c.json(result, 200);
        }
    );

    // Debug APIs
    if (enableDebug) {
        router.openapi(
            createRoute({
                method: "post",
                path: "/debug/uploads",
                tags: ["files"],
                summary: "Create presigned upload URL (Debug)",
                description: "Normally called internally by other services",
                middleware: [requireAuth] as const,
                request: {
                    body: {
                        content: { "application/json": { schema: createUploadSchema } },
                    },
                },
                responses: {
                    200: {
                        description: "Presigned URL details",
                        content: { 
                            "application/json": { 
                                schema: z.object({
                                    fileId: z.number().int().positive(),
                                    objectKey: z.string(),
                                    upload: z.object({
                                        url: z.string(),
                                        method: z.literal("POST"),
                                        fields: z.record(z.string(), z.string()),
                                    }),
                                    expiresInSeconds: z.number(),
                                }) 
                            } 
                        },
                    },
                    ...CommonErrorResponses,
                },
            }),
            async (c) => {
                const { userId, regionId } = getJwtPayload(c);
                const input = c.req.valid("json");

                const result = await fileService.createUpload({
                    userId,
                    regionId,
                    scope: input.scope as FileScope,
                    mimeType: input.mimeType,
                    sizeBytes: input.sizeBytes,
                });

                return c.json(result, 200);
            }
        );

        router.openapi(
            createRoute({
                method: "delete",
                path: "/debug/{scope}/{fileId}",
                tags: ["files"],
                summary: "Delete a file (Debug)",
                description: "Normally called internally by other services",
                middleware: [requireAuth] as const,
                request: {
                    params: z.object({
                        scope: z.enum(FILE_SCOPE_VALUES),
                        fileId: FileIdParamSchema,
                    }),
                },
                responses: {
                    200: {
                        description: "Success",
                        content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
                    },
                    ...CommonErrorResponses,
                },
            }),
            async (c) => {
                const { userId, regionId } = getJwtPayload(c);
                const { scope, fileId } = c.req.valid("param");

                await fileService.deleteFile({
                    userId,
                    regionId,
                    fileId: fileId as FileId,
                    scope: scope as FileScope,
                });

                return c.json({ success: true }, 200);
            }
        );

        router.openapi(
            createRoute({
                method: "get",
                path: "/download/{scope}/{fileId}",
                tags: ["files"],
                summary: "Get file download URL (Debug)",
                description: "Get a presigned S3 URL to download a file",
                middleware: [requireAuth] as const,
                request: {
                    params: z.object({
                        scope: z.enum(FILE_SCOPE_VALUES),
                        fileId: FileIdParamSchema,
                    }),
                },
                responses: {
                    200: {
                        description: "Success",
                        content: { "application/json": { schema: z.object({ url: z.string() }) } },
                    },
                    ...CommonErrorResponses,
                },
            }),
            async (c) => {
                const { userId, regionId } = getJwtPayload(c);
                const { scope, fileId } = c.req.valid("param");

                const result = await fileService.getDownloadUrl({
                    userId,
                    regionId,
                    fileId: fileId as FileId,
                    scope: scope as FileScope,
                });

                return c.json(result, 200);
            }
        );
    }

    return router;
}
