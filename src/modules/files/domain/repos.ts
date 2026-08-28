import type { GlobalDb, RegionalDb } from "../../../shared/domain/db-types.js";
import type { FileId, RegionId, UserId } from "../../../shared/domain/types.js";
import type { FileRecord, FileScope } from "./entities.js";

export interface CreateFileRecordInput {
    userId: UserId;
    regionId: RegionId;
    scope: FileScope;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
}

export interface FileRepository {
    createPending(db: GlobalDb | RegionalDb, input: CreateFileRecordInput): Promise<FileId>;
    findByIdWithRegion(db: GlobalDb | RegionalDb, id: FileId, scope: FileScope, regionId: RegionId): Promise<FileRecord | null>;
    markUploaded(db: GlobalDb | RegionalDb, id: FileId, scope: FileScope, regionId: RegionId): Promise<void>;
    hardDelete(db: GlobalDb | RegionalDb, id: FileId, scope: FileScope, regionId: RegionId): Promise<void>;
}
