import type { FileId, RegionId, UserId } from "../../../shared/domain/types.js";
import type { FileScope, FileRecord } from "./entities.js";
import type { DbContext } from "../../../shared/domain/db-types.js";

export interface CreateUploadInput {
    userId: UserId;
    regionId: RegionId;
    scope: FileScope;
    mimeType: string;
    sizeBytes: number;
}

export interface CreateUploadResult {
    fileId: FileId;
    objectKey: string;
    upload: {
        url: string;
        method: "POST";
        fields: Record<string, string>;
    };
    expiresInSeconds: number;
}

export interface FileActionInput {
    userId: UserId;
    regionId: RegionId;
    fileId: FileId;
    scope: FileScope;
}

export interface FileService {
    createUpload(input: CreateUploadInput, tx?: DbContext): Promise<CreateUploadResult>;
    markUploaded(input: FileActionInput, tx?: DbContext): Promise<FileRecord>;
    deleteFile(input: FileActionInput, tx?: DbContext): Promise<void>;
    getDownloadUrl(input: FileActionInput, tx?: DbContext): Promise<{ url: string }>;
}
