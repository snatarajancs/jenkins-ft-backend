import type { Role } from "./roles.js";
import type { RegionId, UserId } from "../../../shared/domain/types.js";

export interface User {
    id: UserId;
    regionId: RegionId;
    email: string;
    passwordHash: string;
    role: Role;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserInput {
    regionId: RegionId;
    email: string;
    passwordHash: string;
    role: Role;
    isActive: boolean;
}

export interface RefreshToken {
    id: number;
    regionId: RegionId;
    userId: UserId;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

export interface CreateRefreshTokenInput {
    regionId: RegionId;
    userId: UserId;
    token: string;
    expiresAt: Date;
}
