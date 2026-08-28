import { pino } from "pino";
import type { MiddlewareHandler } from "hono";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: isDev
        ? {
              target: "pino-pretty",
              options: {
                  colorize: true,
              },
          }
        : undefined,
});

export function initLogger(): MiddlewareHandler {
    return async (c, next) => {
        const { method, url } = c.req;
        const start = Date.now();
        await next();
        const duration = Date.now() - start;
        logger.info(`${method} ${url} - ${c.res.status} - ${duration}ms`);
    };
}
