import type { RegionalDb, GlobalDb } from "../../../shared/domain/db-types.js";
import type { User, CreateUserInput, RefreshToken, CreateRefreshTokenInput } from "./entities.js";
import type { RegionId, UserId } from "../../../shared/domain/types.js";

export interface UserRepository {
    findBy(db: RegionalDb, filter: { email?: string; id?: UserId }): Promise<User | null>;
    create(db: RegionalDb, data: CreateUserInput): Promise<User>;
}

export interface RefreshTokenRepository {
    create(db: RegionalDb, data: CreateRefreshTokenInput): Promise<RefreshToken>;
    findByToken(db: RegionalDb, token: string): Promise<RefreshToken | null>;
    deleteByUserId(db: RegionalDb, userId: UserId): Promise<void>;
}

export interface UserRegionMap {
    id: number;
    emailHash: string;
    regionId: RegionId;
}

export interface UserRegionMapRepository {
    findByEmailHash(db: GlobalDb, emailHash: string): Promise<UserRegionMap | null>;
    create(db: GlobalDb, data: { emailHash: string; regionId: RegionId }): Promise<UserRegionMap>;
}
