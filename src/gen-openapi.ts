import { makeApp } from "./bootstrap/app.js";
import * as fs from "node:fs";
import { logger } from "./shared/infra/logger.js";

function main() {
    const { app } = makeApp();
    const spec = app.getOpenAPIDocument({
        openapi: "3.1.0",
        info: { title: "Field Techy API", version: "0.1.0" },
    });

    fs.writeFileSync("openapi.json", JSON.stringify(spec, null, 2));
    logger.info("OpenAPI JSON specification generated successfully.");
}

main();
