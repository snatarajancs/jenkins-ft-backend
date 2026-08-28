import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/modules/**/schema.regional.ts",
    out: "./migrations/regional",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
