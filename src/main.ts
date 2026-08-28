import "dotenv/config";
import { serve } from "@hono/node-server";
import { loadConfig } from "./shared/infra/config.js";
import { makeApp } from "./bootstrap/app.js";

const config = loadConfig(true);
const { app, outboxRelay } = makeApp(config);

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});

outboxRelay.start();

process.on("SIGINT", () => {
    outboxRelay.stop();
    process.exit(0);
});
process.on("SIGTERM", () => {
    outboxRelay.stop();
    process.exit(0);
});
