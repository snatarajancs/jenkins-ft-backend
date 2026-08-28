import type { DbContext } from "../../../shared/domain/db-types.js";
import type { IOutboxPublisher, OutboxEventType } from "../domain/outbox.js";
import { outboxEvents } from "./schema.global.js";

export class OutboxPublisherImpl implements IOutboxPublisher {
    async publish<T extends OutboxEventType>(
        tx: DbContext,
        type: T,
        payload: unknown,
    ): Promise<void> {
        await tx.global.insert(outboxEvents).values({
            type,
            payload,
            status: "pending",
        });
    }
}
