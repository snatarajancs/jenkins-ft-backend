import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { regionConfigSchema } from "../src/shared/infra/config.js";

async function run() {
    const globalUrl = process.env.GLOBAL_DATABASE_URL;
    if (!globalUrl) throw new Error("GLOBAL_DATABASE_URL is required");

    console.log("Migrating global database...");
    const globalClient = postgres(globalUrl, { max: 1 });
    const globalDb = drizzle({ client: globalClient });
    await migrate(globalDb, { migrationsFolder: "migrations/global" });
    await globalClient.end();
    console.log("Global database migrated successfully.");

    const regionConfigsRaw = process.env.REGION_CONFIGS;
    if (!regionConfigsRaw) throw new Error("REGION_CONFIGS is required");

    const regionConfigs = regionConfigSchema.array().parse(JSON.parse(regionConfigsRaw));
    for (const cfg of regionConfigs) {
        console.log(`Migrating region ${cfg.regionId} database...`);
        const client = postgres(cfg.dbUrl, { max: 1 });
        const db = drizzle({ client });
        await migrate(db, { migrationsFolder: "migrations/regional" });
        await client.end();
        console.log(`Region ${cfg.regionId} database migrated successfully.`);
    }

    console.log("All migrations complete.");
}

run().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
