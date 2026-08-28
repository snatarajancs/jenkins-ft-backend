import { S3Client, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost, type PresignedPostOptions } from "@aws-sdk/s3-presigned-post";
import type { PresignedUpload, S3ObjectStore } from "../../domain/storage.js";
import type { AppConfig } from "../../../../shared/infra/config.js";
import { RegionalS3Registry } from "./s3-registry.js";

export class AwsS3Provider implements S3ObjectStore {
    private readonly client: S3Client;

    constructor(
        private readonly bucket: string,
        region: string,
        endpoint?: string,
        accessKeyId?: string,
        secretAccessKey?: string,
    ) {
        const credentials =
            accessKeyId && secretAccessKey
                ? { accessKeyId, secretAccessKey }
                : undefined;

        this.client = new S3Client({
            region,
            endpoint,
            credentials,
            forcePathStyle: !!endpoint, // Required for MinIO
        });
    }

    async createUpload(
        objectKey: string,
        mimeType: string,
        sizeBytes: number,
        expiresInSeconds: number = 900,
    ): Promise<PresignedUpload> {
        const Conditions: NonNullable<PresignedPostOptions["Conditions"]> = [
            { acl: "private" },
            { bucket: this.bucket },
            ["starts-with", "$key", objectKey],
            ["eq", "$Content-Type", mimeType],
            ["content-length-range", sizeBytes, sizeBytes], // Exact match required
        ];

        const { url, fields } = await createPresignedPost(this.client, {
            Bucket: this.bucket,
            Key: objectKey,
            Conditions,
            Fields: {
                acl: "private",
                "Content-Type": mimeType,
            },
            Expires: expiresInSeconds,
        });

        return { url, fields };
    }

    async head(objectKey: string): Promise<{ sizeBytes: number } | null> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
            });
            const response = await this.client.send(command);
            return {
                sizeBytes: response.ContentLength ?? 0,
            };
        } catch (error: unknown) {
            const err = error as Error & { $metadata?: { httpStatusCode?: number } };
            const status = err.$metadata?.httpStatusCode;
            if (err.name === "NotFound" || status === 404 || status === 403) {
                return null;
            }
            throw error;
        }
    }

    async delete(objectKey: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: objectKey,
        });
        await this.client.send(command);
    }

    async getDownloadUrl(objectKey: string, expiresInSeconds: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: objectKey,
        });
        return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    }
}

export function createS3Registry(config: AppConfig): RegionalS3Registry {
    const registry = new RegionalS3Registry();
    for (const regionCfg of config.REGION_CONFIGS ?? []) {
        if (!regionCfg.s3Bucket) continue;
        
        const provider = new AwsS3Provider(
            regionCfg.s3Bucket,
            regionCfg.awsRegion,
            regionCfg.awsEndpoint || config.AWS_ENDPOINT_URL,
            config.AWS_ACCESS_KEY_ID,
            config.AWS_SECRET_ACCESS_KEY,
        );
        registry.setProvider(regionCfg.regionId, provider);
    }
    return registry;
}

export function createGlobalS3Provider(config: AppConfig): S3ObjectStore {
    return new AwsS3Provider(
        config.GLOBAL_S3_BUCKET,
        config.AWS_REGION,
        config.AWS_ENDPOINT_URL,
        config.AWS_ACCESS_KEY_ID,
        config.AWS_SECRET_ACCESS_KEY,
    );
}
