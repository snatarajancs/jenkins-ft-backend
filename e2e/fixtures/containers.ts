import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";

export async function startPostgres(): Promise<{
    connectionString: string;
    container: StartedTestContainer;
}> {
    const container = await new PostgreSqlContainer("postgres:18").start();
    return { connectionString: container.getConnectionUri(), container };
}

export async function startMinio(): Promise<{
    endpoint: string;
    accessKey: string;
    secretKey: string;
    container: StartedTestContainer;
}> {
    const container = await new GenericContainer("minio/minio:latest")
        .withExposedPorts(9000)
        .withEnvironment({
            MINIO_ROOT_USER: "minioadmin",
            MINIO_ROOT_PASSWORD: "minioadmin",
        })
        .withCommand(["server", "/data"])
        .start();
    const endpoint = `http://localhost:${container.getMappedPort(9000)}`;
    return { endpoint, accessKey: "minioadmin", secretKey: "minioadmin", container };
}
