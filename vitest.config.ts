import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["e2e/tests/**/*.test.ts"],
        globalSetup: ["e2e/fixtures/global-setup.ts"],
        setupFiles: ["e2e/fixtures/worker-setup.ts"],
        teardownTimeout: 30_000,
        pool: "threads",
        maxWorkers: 4,
        testTimeout: 30_000,
    },
});
