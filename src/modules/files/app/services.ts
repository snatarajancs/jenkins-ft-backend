import { v4 as uuidv4 } from "uuid";
import type { UnitOfWork } from "../../../shared/domain/unit-of-work.js";
import { ClientError, NotFoundError, ForbiddenError, ConflictError } from "../../../shared/domain/errors.js";
import { toRegionId } from "../../../shared/domain/types.js";
import { isGlobalFileScope } from "../domain/enums.js";
import type { RegionalS3Registry } from "../infra/storage/s3-registry.js";
import type { S3ObjectStore } from "../domain/storage.js";
import type { FileService, CreateUploadInput, CreateUploadResult, FileActionInput } from "../domain/file-service.js";
import type { FileRepository } from "../domain/repos.js";
import type { AppConfig } from "../../../shared/infra/config.js";
import type { FileRecord } from "../domain/entities.js";
import type { DbContext, GlobalDb, RegionalDb } from "../../../shared/domain/db-types.js";

export class FileServiceImpl implements FileService {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly fileRepo: FileRepository,
        private readonly regionalS3Registry: RegionalS3Registry,
        private readonly globalS3Provider: S3ObjectStore,
        private readonly config: AppConfig,
    ) {}

    private getS3Provider(scope: string, regionId: number): S3ObjectStore {
        if (isGlobalFileScope(scope)) {
            return this.globalS3Provider;
        }
        return this.regionalS3Registry.getProvider(regionId);
    }

    private getDb(scope: string, regionId: number, tx?: DbContext): GlobalDb | RegionalDb {
        if (isGlobalFileScope(scope)) {
            return tx ? tx.global : this.uow.getGlobalDb();
        }
        return tx ? tx.regional : this.uow.getRegionalDb(undefined, toRegionId(regionId));
    }

    private validateScope(scope: string, regionId: number) {
        if (!isGlobalFileScope(scope) && !regionId) {
            throw new ClientError("REGION_ID_REQUIRED");
        }
    }

    async createUpload(input: CreateUploadInput, tx?: DbContext): Promise<CreateUploadResult> {
        this.validateScope(input.scope, input.regionId);
        if (input.sizeBytes <= 0) {
            throw new ClientError("INVALID_SIZE");
        }

        const ext = input.mimeType.split("/")[1] || "bin";
        const uniqueToken = uuidv4();
        const objectKey = `${input.userId}/${input.scope}/${uniqueToken}.${ext}`;

        const s3Provider = this.getS3Provider(input.scope, input.regionId);

        const presigned = await s3Provider.createUpload(
            objectKey,
            input.mimeType,
            input.sizeBytes,
            this.config.S3_PRESIGN_EXPIRES_SECONDS,
        );

        const fileId = await this.fileRepo.createPending(this.getDb(input.scope, input.regionId, tx), {
            userId: input.userId,
            regionId: input.regionId,
            scope: input.scope,
            objectKey,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
        });

        return {
            fileId,
            objectKey,
            upload: {
                url: presigned.url,
                method: "POST",
                fields: presigned.fields,
            },
            expiresInSeconds: this.config.S3_PRESIGN_EXPIRES_SECONDS,
        };
    }

    async markUploaded(input: FileActionInput, tx?: DbContext): Promise<FileRecord> {
        this.validateScope(input.scope, input.regionId);
        const db = this.getDb(input.scope, input.regionId, tx);
        const file = await this.fileRepo.findByIdWithRegion(db, input.fileId, input.scope, input.regionId);

        if (!file) {
            throw new NotFoundError("FILE_NOT_FOUND");
        }

        if (file.userId !== input.userId) {
            throw new ForbiddenError("FORBIDDEN");
        }

        if (file.status === "uploaded") {
            throw new ConflictError("ALREADY_UPLOADED");
        }

        const s3Provider = this.getS3Provider(input.scope, input.regionId);
        const s3Object = await s3Provider.head(file.objectKey);

        if (!s3Object) {
            throw new ConflictError("UPLOAD_INCOMPLETE");
        }

        if (s3Object.sizeBytes !== file.sizeBytes) {
            throw new ConflictError("SIZE_MISMATCH");
        }

        const run = async (ctx: DbContext) => {
            await this.fileRepo.markUploaded(this.getDb(input.scope, input.regionId, ctx), input.fileId, input.scope, input.regionId);
        };

        if (tx) {
            await run(tx);
        } else {
            await this.uow.transaction(undefined, run, input.regionId);
        }

        return {
            ...file,
            status: "uploaded",
            updatedAt: new Date()
        };
    }

    async deleteFile(input: FileActionInput, tx?: DbContext): Promise<void> {
        this.validateScope(input.scope, input.regionId);
        const db = this.getDb(input.scope, input.regionId, tx);
        const file = await this.fileRepo.findByIdWithRegion(db, input.fileId, input.scope, input.regionId);

        if (!file) {
            return; // Idempotent
        }

        if (file.userId !== input.userId) {
            throw new ForbiddenError("FORBIDDEN");
        }

        const s3Provider = this.getS3Provider(input.scope, input.regionId);

        // Delete from S3 first, then DB hard delete
        await s3Provider.delete(file.objectKey);
        const run = async (ctx: DbContext) => {
            await this.fileRepo.hardDelete(this.getDb(input.scope, input.regionId, ctx), input.fileId, input.scope, input.regionId);
        };

        if (tx) {
            await run(tx);
        } else {
            await this.uow.transaction(undefined, run, input.regionId);
        }
    }

    async getDownloadUrl(input: FileActionInput, tx?: DbContext): Promise<{ url: string }> {
        this.validateScope(input.scope, input.regionId);
        const db = this.getDb(input.scope, input.regionId, tx);
        const file = await this.fileRepo.findByIdWithRegion(db, input.fileId, input.scope, input.regionId);

        if (!file) {
            throw new NotFoundError("FILE_NOT_FOUND");
        }

        if (file.userId !== input.userId) {
            throw new ForbiddenError("FORBIDDEN");
        }

        const s3Provider = this.getS3Provider(input.scope, input.regionId);
        const url = await s3Provider.getDownloadUrl(file.objectKey);
        
        return { url };
    }
}
