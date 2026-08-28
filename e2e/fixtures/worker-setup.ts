import { beforeAll, afterAll } from "vitest";
import { WorkerFixture } from "./worker-fixture.js";

const fixture = new WorkerFixture();

beforeAll(async () => {
    await fixture.setup();
});

afterAll(async () => {
    await fixture.teardown();
});

export { fixture };
