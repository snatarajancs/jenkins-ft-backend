import { z } from "@hono/zod-openapi";

const ErrorSchema = z.object({ error: z.string() });

export const CommonErrorResponses = {
    400: { description: "Bad Request", content: { "application/json": { schema: ErrorSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not Found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Internal Server Error", content: { "application/json": { schema: ErrorSchema } } },
};
