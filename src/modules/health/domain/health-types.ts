export const DB_STATUS = ["ok", "error"] as const;
export type DbStatus = (typeof DB_STATUS)[number];

export interface DbHealthResult {
    global: DbStatus;
    regional: Record<string, DbStatus>;
    allHealthy: boolean;
}
