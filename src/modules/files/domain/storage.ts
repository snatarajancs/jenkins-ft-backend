export interface PresignedUpload {
    url: string;
    fields: Record<string, string>;
}

export interface S3ObjectStore {
    createUpload(
        objectKey: string,
        mimeType: string,
        sizeBytes: number,
        expiresInSeconds?: number,
    ): Promise<PresignedUpload>;

    head(objectKey: string): Promise<{ sizeBytes: number } | null>;
    
    delete(objectKey: string): Promise<void>;
    
    getDownloadUrl(objectKey: string, expiresInSeconds?: number): Promise<string>;
}
