export const FILE_SCOPE_VALUES = ["avatar", "resume", "cover_letter", "eligibility", "job"] as const;
export const REGIONAL_FILE_SCOPES = ["avatar", "resume", "cover_letter", "eligibility"] as const;
export const GLOBAL_FILE_SCOPES = ["job"] as const;

export const isGlobalFileScope = (scope: string): boolean =>
    (GLOBAL_FILE_SCOPES as readonly string[]).includes(scope);

export const FILE_STATUS_VALUES = ["pending", "uploaded"] as const;
