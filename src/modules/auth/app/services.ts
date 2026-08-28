import { randomUUID, createHash } from "node:crypto";
import ms from "ms";
import type { StringValue } from "ms";
import type { UnitOfWork } from "../../../shared/domain/unit-of-work.js";
import type {
    UserRepository,
    RefreshTokenRepository,
    UserRegionMapRepository,
} from "../domain/repos.js";
import type { PasswordHasher, JWTProvider } from "../domain/providers.js";
import type {
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    RefreshTokenResponse,
} from "./dtos.js";
import {
    UnauthorizedError,
    ClientError,
} from "../../../shared/domain/errors.js";
import type { RegionId, UserId } from "../../../shared/domain/types.js";
import { toRegionId } from "../../../shared/domain/types.js";
import type { IOutboxPublisher } from "../../outbox/domain/outbox.js";
import { OutboxEventType } from "../../outbox/domain/outbox.js";

export interface LoginResult {
    data: LoginResponse;
    refreshTokenValue: string;
}

export interface RegisterResult {
    data: RegisterResponse;
    refreshTokenValue: string;
}

export interface AuthService {
    login(req: LoginRequest): Promise<LoginResult>;
    register(req: RegisterRequest): Promise<RegisterResult>;
    refreshToken(token: string): Promise<RefreshTokenResponse>;
    logout(regionId: RegionId, userId: UserId): Promise<{ success: true }>;
}

function hashEmail(email: string): string {
    return createHash("sha256").update(email.toLowerCase()).digest("hex");
}

export function getRefreshTokenCookieName(regionId: number): string {
    return `refresh_token_r${regionId}`;
}

export class AuthServiceImpl implements AuthService {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly userRepo: UserRepository,
        private readonly hasher: PasswordHasher,
        private readonly jwt: JWTProvider,
        private readonly refreshTokenRepo: RefreshTokenRepository,
        private readonly userRegionMapRepo: UserRegionMapRepository,
        private readonly accessExpiry: string,
        private readonly refreshExpiry: string,
        private readonly outboxPublisher: IOutboxPublisher,
    ) {
    }

    async login(req: LoginRequest): Promise<LoginResult> {
        const emailHash = hashEmail(req.email);
        const globalDb = this.uow.getGlobalDb();
        const map = await this.userRegionMapRepo.findByEmailHash(
            globalDb,
            emailHash,
        );
        if (!map) throw new UnauthorizedError("Invalid credentials");

        const regionalDb = this.uow.getRegionalDb(undefined, map.regionId);
        const user = await this.userRepo.findBy(regionalDb, {
            email: req.email,
        });
        if (!user) throw new UnauthorizedError("Invalid credentials");
        if (!user.isActive) throw new UnauthorizedError("Account is inactive");

        const valid = await this.hasher.verify(user.passwordHash, req.password);
        if (!valid) throw new UnauthorizedError("Invalid credentials");

        const accessToken = await this.jwt.sign({
            userId: user.id,
            regionId: user.regionId,
            role: user.role,
            sub: `${user.regionId}:${user.id}`,
            exp:
                Math.floor(Date.now() / 1000) +
                ms(this.accessExpiry as StringValue) / 1000,
        });

        const rawToken = randomUUID();
        const refreshTokenValue = `${user.regionId}:${rawToken}`;
        const expiresAt = new Date(
            Date.now() + ms(this.refreshExpiry as StringValue),
        );
        await this.refreshTokenRepo.create(regionalDb, {
            regionId: user.regionId,
            userId: user.id,
            token: refreshTokenValue,
            expiresAt,
        });

        return {
            data: {
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    regionId: user.regionId,
                },
            },
            refreshTokenValue,
        };
    }

    async register(req: RegisterRequest): Promise<RegisterResult> {
        const emailHash = hashEmail(req.email);
        const globalDb = this.uow.getGlobalDb();

        const existing = await this.userRegionMapRepo.findByEmailHash(
            globalDb,
            emailHash,
        );
        if (existing) throw new ClientError("Email already registered");

        const regionalDb = this.uow.getRegionalDb(undefined, req.regionId);

        const existingUser = await this.userRepo.findBy(regionalDb, {
            email: req.email,
        });
        if (existingUser)
            throw new ClientError("Email already registered in this region");

        const passwordHash = await this.hasher.hash(req.password);

        return await this.uow.transaction(undefined, async (tx) => {
            await this.userRegionMapRepo.create(tx.global, {
                emailHash,
                regionId: req.regionId,
            });

            const user = await this.userRepo.create(tx.regional, {
                regionId: req.regionId,
                email: req.email,
                passwordHash,
                role: req.role,
                isActive: true,
            });

            const accessToken = await this.jwt.sign({
                userId: user.id,
                regionId: user.regionId,
                role: user.role,
                sub: `${user.regionId}:${user.id}`,
                exp:
                    Math.floor(Date.now() / 1000) +
                    ms(this.accessExpiry as StringValue) / 1000,
            });

            const rawToken = randomUUID();
            const refreshTokenValue = `${user.regionId}:${rawToken}`;
            const expiresAt = new Date(
                Date.now() + ms(this.refreshExpiry as StringValue),
            );
            await this.refreshTokenRepo.create(tx.regional, {
                regionId: user.regionId,
                userId: user.id,
                token: refreshTokenValue,
                expiresAt,
            });

            // TODO(plan): Email templates should be handled by the email module in the future.
            // Publish welcome fake email event atomically within the same transaction
            await this.outboxPublisher.publish(tx, OutboxEventType.EMAIL, {
                to: user.email,
                subject: "Welcome to Field Techy",
                body: `Hi, your account has been created successfully. Role: ${user.role}`,
            });

            return {
                data: {
                    id: user.id,
                    role: user.role,
                    regionId: user.regionId,
                    accessToken,
                },
                refreshTokenValue,
            };
        }, toRegionId(req.regionId));
    }

    async refreshToken(token: string): Promise<RefreshTokenResponse> {
        if (!token) throw new UnauthorizedError("Refresh token missing");

        const regionId = extractRegionFromToken(token);
        const regionalDb = this.uow.getRegionalDb(undefined, regionId);
        const stored = await this.refreshTokenRepo.findByToken(
            regionalDb,
            token,
        );
        if (!stored) throw new UnauthorizedError("Invalid refresh token");
        if (stored.expiresAt < new Date())
            throw new UnauthorizedError("Refresh token expired");

        const user = await this.userRepo.findBy(regionalDb, {
            id: stored.userId,
        });
        if (!user) throw new UnauthorizedError("User not found");
        if (!user.isActive) throw new UnauthorizedError("Account is inactive");

        const accessToken = await this.jwt.sign({
            userId: user.id,
            regionId: user.regionId,
            role: user.role,
            sub: `${user.regionId}:${user.id}`,
            exp:
                Math.floor(Date.now() / 1000) +
                ms(this.accessExpiry as StringValue) / 1000,
        });

        return { accessToken };
    }

    async logout(
        regionId: RegionId,
        userId: UserId,
    ): Promise<{ success: true }> {
        const regionalDb = this.uow.getRegionalDb(undefined, regionId);
        await this.refreshTokenRepo.deleteByUserId(regionalDb, userId);
        return { success: true };
    }
}

export function extractRegionFromToken(token: string): RegionId {
    const parts = token.split(":");
    if (parts.length >= 2) {
        const rid = Number(parts[0]);
        if (Number.isInteger(rid) && rid > 0) return toRegionId(rid);
    }
    throw new UnauthorizedError("Invalid refresh token format");
}
