import type { S3ObjectStore } from "../../domain/storage.js";

export class RegionalS3Registry {
    private readonly providers = new Map<number, S3ObjectStore>();

    setProvider(regionId: number, provider: S3ObjectStore): void {
        this.providers.set(regionId, provider);
    }

    getProvider(regionId: number): S3ObjectStore {
        const provider = this.providers.get(regionId);
        if (!provider) {
            throw new Error(
                `RegionalS3Registry: no S3 provider registered for region ${regionId}. ` +
                    `Registered regions: [${[...this.providers.keys()].join(", ")}]`,
            );
        }
        return provider;
    }

    getRegisteredRegions(): number[] {
        return [...this.providers.keys()];
    }
}
