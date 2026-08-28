import { z, OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { JobService } from "../../app/services.js";
import {
    ClientPostJobRequestSchema,
    ClientPostJobResponseSchema,
    ClientEditJobRequestSchema,
    ClientJobDetailResponseSchema,
    ClientJobListQuerySchema,
    ClientJobListResponseSchema,
    ClientCalculateJobPriceRequestSchema,
    ClientCalculateJobPriceResponseSchema,
    EngineerJobListQuerySchema,
    EngineerJobListResponseSchema,
    EngineerJobDetailResponseSchema,
    EngineerMyJobsQuerySchema,
    EngineerMyJobsResponseSchema,
    JobListApplicationsResponseSchema,
    JobApplicationActionRequestSchema,
    JobApplicationActionResponseSchema,
    JobIdParamSchema,
} from "../../app/dtos.js";
import { CommonErrorResponses } from "../../../../shared/infra/schema.js";
import { OPENAPI_TAGS } from "../../../../shared/infra/openapi.js";
import { defaultHook } from "../../../../shared/infra/default-hook.js";
import { requireAuth, requireClient, requireEngineer } from "../../../../shared/infra/middlewares.js";
import { getJwtPayload, getRequiredRegionId } from "../../../../shared/infra/context.js";

const JOB_TAG = OPENAPI_TAGS.jobs.name;
export function createJobRoutes(jobService: JobService) {
    const app = new OpenAPIHono({ defaultHook });

    // Middleware checking authentication for all job routes
    app.use(requireAuth);

    // Post Job(s) Batch
    app.openapi(
        createRoute({
            operationId: "PostJobs",
            method: "post",
            path: "/",
            tags: [JOB_TAG],
            middleware: [requireClient],
            security: [{ Bearer: [] }],
            request: {
                body: {
                    content: { "application/json": { schema: ClientPostJobRequestSchema } },
                },
            },
            responses: {
                201: {
                    description: "Jobs posted successfully",
                    content: { "application/json": { schema: ClientPostJobResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const clientRegionId = getRequiredRegionId(c);
            const body = c.req.valid("json");
            const result = await jobService.postJobs(clientRegionId, payload.userId, body);
            return c.json(result, 201);
        },
    );

    // List Jobs
    app.openapi(
        createRoute({
            operationId: "ListJobs",
            method: "get",
            path: "/",
            tags: [JOB_TAG],
            middleware: [requireClient],
            security: [{ Bearer: [] }],
            request: {
                query: ClientJobListQuerySchema,
            },
            responses: {
                200: {
                    description: "List of job postings",
                    content: { "application/json": { schema: ClientJobListResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const clientRegionId = getRequiredRegionId(c);
            const query = c.req.valid("query");
            const result = await jobService.listJobs(clientRegionId, payload.userId, query);
            return c.json(result, 200);
        },
    );

    // Calculate Job Price Estimate
    app.openapi(
        createRoute({
            operationId: "CalculateJobPrice",
            method: "post",
            path: "/calculate-price",
            tags: [JOB_TAG],
            middleware: [requireClient],
            security: [{ Bearer: [] }],
            request: {
                body: {
                    content: { "application/json": { schema: ClientCalculateJobPriceRequestSchema } },
                },
            },
            responses: {
                200: {
                    description: "Job price estimated successfully",
                    content: { "application/json": { schema: ClientCalculateJobPriceResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const body = c.req.valid("json");
            const result = await jobService.calculatePrice(body);
            return c.json(result, 200);
        },
    );

    // Engineer — List Jobs
    app.openapi(
        createRoute({
            operationId: "EngineerListJobs",
            method: "get",
            path: "/engineer",
            tags: [JOB_TAG],
            middleware: [requireEngineer],
            security: [{ Bearer: [] }],
            request: {
                query: EngineerJobListQuerySchema,
            },
            responses: {
                200: {
                    description: "List of jobs for the engineer",
                    content: { "application/json": { schema: EngineerJobListResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const query = c.req.valid("query");
            const result = await jobService.listJobsForEngineer(payload.userId, payload.regionId, query);
            return c.json(result, 200);
        },
    );

    // Engineer — My Jobs Dashboard
    app.openapi(
        createRoute({
            operationId: "EngineerListMyJobs",
            method: "get",
            path: "/engineer/my-jobs",
            tags: [JOB_TAG],
            middleware: [requireEngineer],
            security: [{ Bearer: [] }],
            request: {
                query: EngineerMyJobsQuerySchema,
            },
            responses: {
                200: {
                    description: "List of assigned jobs for the engineer",
                    content: { "application/json": { schema: EngineerMyJobsResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const query = c.req.valid("query");
            const result = await jobService.listMyJobsForEngineer(payload.userId, payload.regionId, query);
            return c.json(result, 200);
        },
    );

    // Engineer — Get Job Detail
    app.openapi(
        createRoute({
            operationId: "EngineerGetJobById",
            method: "get",
            path: "/engineer/{id}",
            tags: [JOB_TAG],
            middleware: [requireEngineer],
            security: [{ Bearer: [] }],
            request: {
                params: z.object({
                    id: JobIdParamSchema,
                }),
            },
            responses: {
                200: {
                    description: "Job retrieved successfully for engineer",
                    content: { "application/json": { schema: EngineerJobDetailResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const { id } = c.req.valid("param");
            const result = await jobService.getJobByIdForEngineer(payload.userId, payload.regionId, id);
            return c.json(result, 200);
        },
    );

    // Get Job Detail
    app.openapi(
        createRoute({
            operationId: "GetJobById",
            method: "get",
            path: "/{id}",
            tags: [JOB_TAG],
            middleware: [requireClient],
            security: [{ Bearer: [] }],
            request: {
                params: z.object({
                    id: JobIdParamSchema,
                }),
            },
            responses: {
                200: {
                    description: "Job retrieved successfully",
                    content: { "application/json": { schema: ClientJobDetailResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const clientRegionId = getRequiredRegionId(c);
            const { id } = c.req.valid("param");
            const result = await jobService.getJobById(clientRegionId, id, payload.userId);
            return c.json(result, 200);
        },
    );

    // Update Job
    app.openapi(
        createRoute({
            operationId: "UpdateJob",
            method: "put",
            path: "/{id}",
            tags: [JOB_TAG],
            middleware: [requireClient],
            security: [{ Bearer: [] }],
            request: {
                params: z.object({
                    id: JobIdParamSchema,
                }),
                body: {
                    content: { "application/json": { schema: ClientEditJobRequestSchema } },
                },
            },
            responses: {
                200: {
                    description: "Job updated successfully",
                    content: { "application/json": { schema: ClientJobDetailResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const clientRegionId = getRequiredRegionId(c);
            const { id } = c.req.valid("param");
            const body = c.req.valid("json");
            const result = await jobService.updateJob(clientRegionId, id, payload.userId, body);
            return c.json(result, 200);
        },
    );

    // Cancel Job
    app.openapi(
        createRoute({
            operationId: "CancelJob",
            method: "delete",
            path: "/{id}",
            tags: [JOB_TAG],
            middleware: [requireClient],
            security: [{ Bearer: [] }],
            request: {
                params: z.object({
                    id: JobIdParamSchema,
                }),
            },
            responses: {
                200: {
                    description: "Job cancelled successfully",
                    content: {
                        "application/json": {
                            schema: JobApplicationActionResponseSchema,
                        },
                    },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const clientRegionId = getRequiredRegionId(c);
            const { id } = c.req.valid("param");
            const result = await jobService.cancelJob(clientRegionId, id, payload.userId);
            return c.json(result, 200);
        },
    );

    // Engineer — Apply for Job
    app.openapi(
        createRoute({
            operationId: "EngineerApplyJob",
            method: "post",
            path: "/engineer/{id}/apply",
            tags: [JOB_TAG],
            middleware: [requireEngineer],
            security: [{ Bearer: [] }],
            request: {
                params: z.object({
                    id: JobIdParamSchema,
                }),
            },
            responses: {
                201: {
                    description: "Applied for job successfully",
                    content: { "application/json": { schema: JobApplicationActionResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const { id } = c.req.valid("param");
            const result = await jobService.applyForJob(payload.userId, payload.regionId, id);
            return c.json(result, 201);
        },
    );

    // Client — List Job Applications
    app.openapi(
        createRoute({
            operationId: "ClientListJobApplications",
            method: "get",
            path: "/{id}/applications",
            tags: [JOB_TAG],
            middleware: [requireClient],
            security: [{ Bearer: [] }],
            request: {
                params: z.object({
                    id: JobIdParamSchema,
                }),
            },
            responses: {
                200: {
                    description: "List of job applications retrieved successfully",
                    content: { "application/json": { schema: JobListApplicationsResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const clientRegionId = getRequiredRegionId(c);
            const { id } = c.req.valid("param");
            const result = await jobService.listJobApplications(clientRegionId, payload.userId, id);
            return c.json(result, 200);
        },
    );

    // Client — Job Application Action (Accept / Reject)
    app.openapi(
        createRoute({
            operationId: "ClientJobApplicationAction",
            method: "post",
            path: "/{id}/applications/{appId}/action",
            tags: [JOB_TAG],
            middleware: [requireClient],
            security: [{ Bearer: [] }],
            request: {
                params: z.object({
                    id: JobIdParamSchema,
                    appId: z.coerce.number().int().positive(),
                }),
                body: {
                    content: {
                        "application/json": {
                            schema: JobApplicationActionRequestSchema,
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Application action processed successfully",
                    content: { "application/json": { schema: JobApplicationActionResponseSchema } },
                },
                ...CommonErrorResponses,
            },
        }),
        async (c) => {
            const payload = getJwtPayload(c);
            const clientRegionId = getRequiredRegionId(c);
            const { id, appId } = c.req.valid("param");
            const body = c.req.valid("json");
            const result = await jobService.handleJobApplicationAction(clientRegionId, payload.userId, id, appId, body);
            return c.json(result, 200);
        },
    );

    return app;
}
