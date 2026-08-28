import type { StartedTestContainer } from "testcontainers";
import postgres from "postgres";
import { startPostgres, startMinio } from "./containers.js";

const MAX_WORKERS = 4;
const NUM_REGIONS = 2;

let startedContainers: StartedTestContainer[] = [];

export async function setup(context: {
    provide: (key: string, value: string) => void;
}): Promise<void> {
    const [globalPg, region1Pg, region2Pg, minio] = await Promise.all([
        startPostgres(),
        startPostgres(),
        startPostgres(),
        startMinio(),
    ]);
    startedContainers = [globalPg.container, region1Pg.container, region2Pg.container, minio.container];

    // Create per-worker databases
    for (let i = 0; i < MAX_WORKERS; i++) {
        // Global DB per worker
        const globalAdminSql = postgres(globalPg.connectionString, { max: 1 });
        await globalAdminSql.unsafe(`CREATE DATABASE test_worker_${i}_global`);
        await globalAdminSql.end();

        // Regional DBs per worker
        for (let r = 0; r < NUM_REGIONS; r++) {
            const regionConn = r === 0 ? region1Pg.connectionString : region2Pg.connectionString;
            const regionAdminSql = postgres(regionConn, { max: 1 });
            await regionAdminSql.unsafe(`CREATE DATABASE test_worker_${i}_region_${r + 1}`);
            await regionAdminSql.end();
        }
    }

    // Provide connection strings per worker
    for (let i = 0; i < MAX_WORKERS; i++) {
        const globalBaseUrl = new URL(globalPg.connectionString);
        globalBaseUrl.pathname = `/test_worker_${i}_global`;
        const globalUrl = globalBaseUrl.toString();
        process.env[`E2E_GLOBAL_DB_${i}`] = globalUrl;
        context.provide(`E2E_GLOBAL_DB_${i}`, globalUrl);

        const regionConns = [region1Pg.connectionString, region2Pg.connectionString];
        const regionConfigs = [];
        for (let r = 0; r < NUM_REGIONS; r++) {
            const url = new URL(regionConns[r]);
            url.pathname = `/test_worker_${i}_region_${r + 1}`;
            const dbUrl = url.toString();
            const regionId = r + 1;
            process.env[`E2E_REGION_DB_${i}_${regionId}`] = dbUrl;
            context.provide(`E2E_REGION_DB_${i}_${regionId}`, dbUrl);
            regionConfigs.push({
                regionId,
                dbUrl,
                s3Bucket: `test-bucket-r${regionId}`,
                awsRegion: regionId === 1 ? "ap-south-1" : "eu-west-2",
            });
        }
        const regionConfigsJson = JSON.stringify(regionConfigs);
        process.env[`E2E_REGION_CONFIGS_${i}`] = regionConfigsJson;
        context.provide(`E2E_REGION_CONFIGS_${i}`, regionConfigsJson);
    }

    process.env["E2E_MINIO_ENDPOINT"] = minio.endpoint;
    process.env["E2E_MINIO_ACCESS_KEY"] = minio.accessKey;
    process.env["E2E_MINIO_SECRET_KEY"] = minio.secretKey;
}

export async function teardown(): Promise<void> {
    await Promise.all(startedContainers.map((c) => c.stop()));
}
