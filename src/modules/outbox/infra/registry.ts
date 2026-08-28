import type { IOutboxEventHandler, IOutboxRegistry, OutboxEventType } from "../domain/outbox.js";

export class OutboxRegistryImpl implements IOutboxRegistry {
    private readonly handlers = new Map<OutboxEventType, IOutboxEventHandler>();

    register(type: OutboxEventType, handler: IOutboxEventHandler): void {
        if (this.handlers.has(type)) {
            throw new Error(`Handler already registered for event type: ${type}`);
        }
        this.handlers.set(type, handler);
    }

    resolve(type: OutboxEventType): IOutboxEventHandler {
        const handler = this.handlers.get(type);
        if (!handler) {
            throw new Error(`Outbox handler not registered for event type: ${type}`);
        }
        return handler;
    }
}
