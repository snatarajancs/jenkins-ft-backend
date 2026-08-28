import { z } from "zod";
import { FILE_SCOPE_VALUES } from "../domain/enums.js";

export const FileIdSchema = z.number().int().positive().brand("FileId");
export const FileIdParamSchema = z.coerce.number().int().positive().brand("FileId");

export const createUploadSchema = z.object({
    scope: z.enum(FILE_SCOPE_VALUES),
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
});

export const uploadedCallbackSchema = z.object({
    fileId: z.coerce.number().int().positive(),
    scope: z.enum(FILE_SCOPE_VALUES),
});
