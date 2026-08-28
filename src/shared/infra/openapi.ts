export const OPENAPI_TAGS = {
    health: { name: "health", description: "Health check endpoints" },
    auth: { name: "auth", description: "Authentication endpoints" },
    user: { name: "user", description: "User profile endpoints" },
    jobs: { name: "jobs", description: "Job endpoints" },
    files: { name: "files", description: "File upload and management endpoints" },
    wallet: { name: "wallet", description: "Wallet endpoints" },
} as const;
