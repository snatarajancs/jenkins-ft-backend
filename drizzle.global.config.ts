import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/modules/**/schema.global.ts",
    out: "./migrations/global",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
