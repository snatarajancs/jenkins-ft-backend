import { eq, and } from "drizzle-orm";
import type { FileId, RegionId, UserId } from "../../../../shared/domain/types.js";
import type { CreateFileRecordInput, FileRepository } from "../../domain/repos.js";
import type { FileRecord, FileScope, FileStatus } from "../../domain/entities.js";
import { files as regionalFiles } from "../schema.regional.js";
import { files as globalFiles } from "../schema.global.js";
import { isGlobalFileScope } from "../../domain/enums.js";
import type { GlobalDb, RegionalDb } from "../../../../shared/domain/db-types.js";

export class FileRepositoryImpl implements FileRepository {
    private validateScope(scope: FileScope, regionId: RegionId) {
        if (!isGlobalFileScope(scope) && !regionId) {
            throw new Error("REGION_ID_REQUIRED");
        }
    }

    async createPending(db: GlobalDb | RegionalDb, input: CreateFileRecordInput): Promise<FileId> {
        this.validateScope(input.scope, input.regionId);
        if (isGlobalFileScope(input.scope)) {
            const [row] = await (db as GlobalDb).insert(globalFiles).values({
                userId: input.userId,
                createdByRegion: input.regionId,
                scope: input.scope,
                status: "pending",
                objectKey: input.objectKey,
                mimeType: input.mimeType,
                sizeBytes: input.sizeBytes,
            }).returning({ id: globalFiles.id });
            return row.id as FileId;
        } else {
            const [row] = await (db as RegionalDb).insert(regionalFiles).values({
                userId: input.userId,
                scope: input.scope,
                status: "pending",
                objectKey: input.objectKey,
                mimeType: input.mimeType,
                sizeBytes: input.sizeBytes,
            }).returning({ id: regionalFiles.id });
            return row.id as FileId;
        }
    }

    async findByIdWithRegion(db: GlobalDb | RegionalDb, id: FileId, scope: FileScope, regionId: RegionId): Promise<FileRecord | null> {
        this.validateScope(scope, regionId);
        if (isGlobalFileScope(scope)) {
            const [row] = await (db as GlobalDb).select().from(globalFiles).where(and(eq(globalFiles.id, id), eq(globalFiles.scope, scope)));
            if (!row) return null;
            return {
                id: row.id as FileId,
                userId: row.userId as UserId,
                regionId: row.createdByRegion as RegionId,
                scope: row.scope as FileScope,
                status: row.status as FileStatus,
                objectKey: row.objectKey,
                mimeType: row.mimeType,
                sizeBytes: row.sizeBytes,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            };
        } else {
            const [row] = await (db as RegionalDb).select().from(regionalFiles).where(and(eq(regionalFiles.id, id), eq(regionalFiles.scope, scope)));
            if (!row) return null;
            return {
                id: row.id as FileId,
                userId: row.userId as UserId,
                regionId,
                scope: row.scope as FileScope,
                status: row.status as FileStatus,
                objectKey: row.objectKey,
                mimeType: row.mimeType,
                sizeBytes: row.sizeBytes,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            };
        }
    }

    async markUploaded(db: GlobalDb | RegionalDb, id: FileId, scope: FileScope, regionId: RegionId): Promise<void> {
        this.validateScope(scope, regionId);
        if (isGlobalFileScope(scope)) {
            await (db as GlobalDb).update(globalFiles)
                .set({ status: "uploaded" })
                .where(and(eq(globalFiles.id, id), eq(globalFiles.scope, scope)));
        } else {
            await (db as RegionalDb).update(regionalFiles)
                .set({ status: "uploaded" })
                .where(and(eq(regionalFiles.id, id), eq(regionalFiles.scope, scope)));
        }
    }

    async hardDelete(db: GlobalDb | RegionalDb, id: FileId, scope: FileScope, regionId: RegionId): Promise<void> {
        this.validateScope(scope, regionId);
        if (isGlobalFileScope(scope)) {
            await (db as GlobalDb).delete(globalFiles).where(and(eq(globalFiles.id, id), eq(globalFiles.scope, scope)));
        } else {
            await (db as RegionalDb).delete(regionalFiles).where(and(eq(regionalFiles.id, id), eq(regionalFiles.scope, scope)));
        }
    }
}
