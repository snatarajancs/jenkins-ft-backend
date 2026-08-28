import type { DbContext } from "../../../shared/domain/db-types.js";

export enum OutboxEventType {
    EMAIL = "EMAIL",
    NOTIFICATION = "NOTIFICATION",
}

export type HandlerResult =
    | { outcome: "success" }
    | { outcome: "failed"; reason: string }
    | { outcome: "retryable"; reason: string };

export interface IOutboxEventHandler {
    handle(payload: unknown, tx?: unknown): Promise<HandlerResult>;
}

export interface IOutboxPublisher {
    publish<T extends OutboxEventType>(
        tx: DbContext,
        type: T,
        payload: unknown,
    ): Promise<void>;
}

export interface IOutboxRegistry {
    register(type: OutboxEventType, handler: IOutboxEventHandler): void;
    resolve(type: OutboxEventType): IOutboxEventHandler;
}
