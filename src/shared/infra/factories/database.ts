import type { AppConfig } from "../config.js";
import { RegionalDatabaseRegistry, createGlobalDatabase } from "../db-registry.js";

let registry: RegionalDatabaseRegistry | null = null;

export function createDatabase(
    config: AppConfig,
    globalSchema: Record<string, unknown>,
    regionalSchema: Record<string, unknown>,
): { registry: RegionalDatabaseRegistry } {
    if (!config.REGION_CONFIGS || config.REGION_CONFIGS.length === 0) {
        throw new Error(
            "REGION_CONFIGS is required. Set it to a JSON array of region configurations.",
        );
    }
    if (!config.GLOBAL_DATABASE_URL) {
        throw new Error("GLOBAL_DATABASE_URL is required.");
    }
    const maxConnections = config.NODE_ENV === "test" ? 5 : 10;
    const globalDb = createGlobalDatabase(config.GLOBAL_DATABASE_URL, globalSchema, maxConnections);
    registry = new RegionalDatabaseRegistry(globalDb);
    registry.initFromConfig(config.REGION_CONFIGS, regionalSchema, maxConnections);
    return { registry };
}

export function getRegistry(): RegionalDatabaseRegistry {
    if (!registry) {
        throw new Error("Database registry not initialized. Call createDatabase() first.");
    }
    return registry;
}

export async function closeDatabase(): Promise<void> {
    if (registry) {
        await registry.closeAll().catch(() => undefined);
        registry = null;
    }
}
