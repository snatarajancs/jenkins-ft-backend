import { eq, inArray, and, or, isNull, lte } from "drizzle-orm";
import { logger } from "../../../shared/infra/logger.js";
import type { IOutboxRegistry, OutboxEventType } from "../domain/outbox.js";
import { outboxEvents } from "./schema.global.js";
import type { RegionalDatabaseRegistry } from "../../../shared/infra/db-registry.js";
import type { GlobalDb } from "../../../shared/domain/db-types.js";

export class OutboxRelay {
    private readonly registry: IOutboxRegistry;
    private readonly globalDb: GlobalDb;
    private readonly intervalMs: number;
    private readonly maxRetries: number;
    private isRunning = false;
    private intervalId: NodeJS.Timeout | null = null;

    constructor(
        registry: IOutboxRegistry,
        dbRegistry: RegionalDatabaseRegistry,
        intervalMs = 5000,
        maxRetries = 3,
    ) {
        this.registry = registry;
        this.globalDb = dbRegistry.getGlobalDb();
        this.intervalMs = intervalMs;
        this.maxRetries = maxRetries;
    }

    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info("OutboxRelay: Starting polling loop");
        this.intervalId = setInterval(
            () => this.pollGlobal().catch((err) => {
                logger.error({ err }, "OutboxRelay: Error in polling loop");
            }),
            this.intervalMs,
        );
    }

    stop(): void {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger.info("OutboxRelay: Stopped");
    }

    private async pollGlobal(): Promise<void> {
        if (!this.isRunning) return;

        await this.globalDb.transaction(async (tx) => {
            // Select pending/retryable events and lock them
            const result = await tx
                .select()
                .from(outboxEvents)
                .where(
                    and(
                        inArray(outboxEvents.status, ['pending', 'retryable']),
                        or(
                            isNull(outboxEvents.nextRetryAt),
                            lte(outboxEvents.nextRetryAt, new Date())
                        )
                    )
                )
                .orderBy(outboxEvents.createdAt)
                .limit(10)
                .for('update', { skipLocked: true });

            if (result.length === 0) {
                return; // Nothing to process
            }

            for (const row of result) {
                const eventId = row.id as string;
                const eventType = row.type as OutboxEventType;
                const payload = row.payload as unknown;
                const currentAttempt = (row.attemptCount as number) || 0;
                const newAttemptCount = currentAttempt + 1;

                // Mark as processing
                await tx
                    .update(outboxEvents)
                    .set({ status: "processing", attemptCount: newAttemptCount })
                    .where(eq(outboxEvents.id, eventId));

                // Fetch handler
                let handler;
                try {
                    handler = this.registry.resolve(eventType);
                } catch (err) {
                    logger.error({ err, eventId, eventType }, "OutboxRelay: Handler not found");
                    await tx
                        .update(outboxEvents)
                        .set({ status: "failed", error: "Handler not registered" })
                        .where(eq(outboxEvents.id, eventId));
                    continue;
                }

                // Process
                let finalStatus: "processed" | "failed" | "retryable";
                let finalError: string | null = null;
                let finalProcessedAt: Date | null = null;
                let finalNextRetryAt: Date | null = null;

                try {
                    // Pass tx to handler as per manager's feedback
                    const handlerResult = await handler.handle(payload, tx);
                    switch (handlerResult.outcome) {
                        case "success":
                            finalStatus = "processed";
                            finalProcessedAt = new Date();
                            break;
                        case "failed":
                            logger.error({ eventId, reason: handlerResult.reason }, "OutboxRelay: Handler permanent failure");
                            finalStatus = "failed";
                            finalError = handlerResult.reason;
                            break;
                        case "retryable":
                            if (newAttemptCount >= this.maxRetries) {
                                logger.error({ eventId, reason: handlerResult.reason }, "OutboxRelay: Handler exceeded max retries");
                                finalStatus = "failed";
                                finalError = "Max retries exceeded: " + handlerResult.reason;
                            } else {
                                finalStatus = "retryable";
                                finalError = handlerResult.reason;
                                // Exponential backoff: 2^currentAttempt * 5000ms
                                const backoffMs = Math.pow(2, currentAttempt) * 5000;
                                finalNextRetryAt = new Date(Date.now() + backoffMs);
                            }
                            break;
                    }
                } catch (err: unknown) {
                    let errorMessage = typeof err === "string" ? err : JSON.stringify(err);
                    if (err instanceof Error) errorMessage = err.message;

                    if (newAttemptCount >= this.maxRetries) {
                        logger.error({ err, eventId }, "OutboxRelay: Handler exceeded max retries after unexpected error");
                        finalStatus = "failed";
                        finalError = "Max retries exceeded: " + (errorMessage || "Unknown error");
                    } else {
                        logger.error({ err, eventId }, "OutboxRelay: Handler threw an unexpected error");
                        finalStatus = "retryable";
                        finalError = errorMessage || "Unknown error";
                        const backoffMs = Math.pow(2, currentAttempt) * 5000;
                        finalNextRetryAt = new Date(Date.now() + backoffMs);
                    }
                }

                await tx
                    .update(outboxEvents)
                    .set({ status: finalStatus, error: finalError, processedAt: finalProcessedAt, nextRetryAt: finalNextRetryAt })
                    .where(eq(outboxEvents.id, eventId));
            }
        });
    }
}
