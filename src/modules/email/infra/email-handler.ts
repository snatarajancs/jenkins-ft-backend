import { logger } from "../../../shared/infra/logger.js";
import { z } from "zod";
import type {
    IOutboxEventHandler,
    HandlerResult,
} from "../../outbox/domain/outbox.js";

/**
 * Fake email handler for testing the outbox pipeline.
 * Prints the email payload to the logger instead of sending a real email.
 * Replace with a real SES/SMTP handler when needed.
 */
export class EmailHandler implements IOutboxEventHandler {
    async handle(rawPayload: unknown): Promise<HandlerResult> {
        const emailPayloadSchema = z.object({
            to: z.string().email(),
            subject: z.string(),
            body: z.string(),
        });
        const payload = emailPayloadSchema.parse(rawPayload);
        if (payload.to === "fail@example.com") {
            logger.warn({ to: payload.to }, "[EmailHandler] Simulated failure triggered");
            return { outcome: "failed", reason: "Simulated permanent failure for fail@example.com" };
        }

        if (payload.to === "retry@example.com") {
            logger.warn({ to: payload.to }, "[EmailHandler] Simulated retryable state triggered");
            return { outcome: "retryable", reason: "Simulated rate limit hit, try again later" };
        }

        if (payload.to === "throw@example.com") {
            logger.error({ to: payload.to }, "[EmailHandler] Simulated unexpected exception triggered");
            throw new Error("Simulated unexpected crash during email send");
        }

        logger.info({ to: payload.to, subject: payload.subject }, "[EmailHandler] Sending email (simulated)");
        logger.debug({ body: payload.body }, "[EmailHandler] Email body");
        return { outcome: "success" };
    }
}
