import type { FileId, RegionId, UserId } from "../../../shared/domain/types.js";

import { FILE_SCOPE_VALUES, FILE_STATUS_VALUES } from "./enums.js";

export type FileScope = typeof FILE_SCOPE_VALUES[number];
export type FileStatus = typeof FILE_STATUS_VALUES[number];

export interface FileRecord {
    id: FileId;
    userId: UserId;
    regionId: RegionId;
    scope: FileScope;
    status: FileStatus;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    updatedAt: Date;
}
