import type { Env } from "hono";
import type { Hook } from "@hono/zod-openapi";

export const defaultHook: Hook<unknown, Env, string, Response | void> = (result, c) => {
    if (!result.success) {
        return c.json(
            {
                error: "Validation error",
                details: result.error.issues.map((i) => ({
                    path: i.path.join("."),
                    message: i.message,
                })),
            },
            422,
        );
    }
};
