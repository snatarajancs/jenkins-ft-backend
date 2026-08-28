import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { AppError } from "../shared/domain/errors.js";
import { defaultHook } from "../shared/infra/default-hook.js";
import { loadConfig, type AppConfig } from "../shared/infra/config.js";
import { createDatabase } from "../shared/infra/factories/database.js";
import { createS3Registry, createGlobalS3Provider } from "../modules/files/infra/storage/providers.js";
import { UnitOfWorkImpl } from "../shared/infra/unit-of-work.js";
import { globalSchema } from "./global-schema.js";
import { regionalSchema } from "./regional-schema.js";
import { createHealthRouter } from "../modules/health/health.routes.js";
import { HealthServiceImpl } from "../modules/health/app/services.js";
import { createAuthRoutes } from "../modules/auth/infra/handlers/index.js";
import { AuthServiceImpl } from "../modules/auth/app/services.js";
import { UserRepositoryImpl } from "../modules/auth/infra/repo/index.js";
import { RefreshTokenRepositoryImpl } from "../modules/auth/infra/repo/refresh-token-repo.js";
import { UserRegionMapRepositoryImpl } from "../modules/auth/infra/repo/user-region-map-repo.js";
import { Argon2PasswordHasher } from "../modules/auth/infra/providers/argon2-hasher.js";
import { JWTProviderImpl } from "../modules/auth/infra/providers/jwt-provider.js";
import { ClientRepositoryImpl } from "../modules/user/infra/repo/client-repo.js";
import { EngineerRepositoryImpl } from "../modules/user/infra/repo/engineer-repo.js";
import { UserRepositoryImpl as UserDomainRepositoryImpl } from "../modules/user/infra/repo/user-repo.js";
import { UserServiceImpl } from "../modules/user/app/services.js";
import { createUserRoutes } from "../modules/user/infra/handlers/handlers.js";
import { AdminReviewRepositoryImpl } from "../modules/user/infra/repo/admin-review-repo.js";
import { AdminUserRepositoryImpl } from "../modules/user/infra/repo/admin-repo.js";
import { createAdminUserRoutes } from "../modules/user/infra/handlers/admin.js";
import { initLogger } from "../shared/infra/logger.js";
import { createJobRoutes } from "../modules/jobs/infra/handlers/index.js";
import { JobServiceImpl } from "../modules/jobs/app/services.js";
import { JobRepositoryImpl } from "../modules/jobs/infra/repo/job-repo.js";
import { RateCardStub } from "../modules/jobs/app/stubs/rate-card-stub.js";
import { FileServiceImpl } from "../modules/files/app/services.js";
import { FileRepositoryImpl } from "../modules/files/infra/repo/index.js";
import { createFileRoutes } from "../modules/files/infra/handlers/index.js";
import { WalletServiceImpl } from "../modules/wallet/app/services.js";
import { WalletRepositoryImpl, TransactionRepositoryImpl, PlatformAccountRepositoryImpl } from "../modules/wallet/infra/repo/index.js";
import { createWalletRoutes } from "../modules/wallet/infra/handlers/index.js";
import { OutboxRegistryImpl } from "../modules/outbox/infra/registry.js";
import { OutboxPublisherImpl } from "../modules/outbox/infra/publisher.js";
import { OutboxRelay } from "../modules/outbox/infra/relay.js";
import { OutboxEventType } from "../modules/outbox/domain/outbox.js";
import { EmailHandler } from "../modules/email/infra/email-handler.js";

export function makeApp(config?: AppConfig) {
    const cfg = config ?? loadConfig();
    const app = new OpenAPIHono({ defaultHook });

    const { registry } = createDatabase(cfg, globalSchema, regionalSchema);
    const uow = new UnitOfWorkImpl();
    uow.setRegistry(registry);
    const s3Registry = createS3Registry(cfg);
    const globalS3Provider = createGlobalS3Provider(cfg);

    const outboxRegistry = new OutboxRegistryImpl();
    outboxRegistry.register(OutboxEventType.EMAIL, new EmailHandler());
    const outboxPublisher = new OutboxPublisherImpl();
    const outboxRelay = new OutboxRelay(outboxRegistry, registry, 5000);

    // Pino HTTP logger middleware
    app.use(initLogger());
    // CORS
    app.use(cors({
        origin: cfg.CORS_ALLOWED_ORIGINS ?? ((origin) => origin || "*"),
        credentials: true,
    }));

    app.onError((err, c) => {
        if (err instanceof AppError) {
            return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
        }
        console.error(err);
        return c.json({ error: "Internal server error" }, 500);
    });

    const healthService = new HealthServiceImpl(uow);
    app.route("/health", createHealthRouter(healthService));

    const clientRepo = new ClientRepositoryImpl();
    const engineerRepo = new EngineerRepositoryImpl();
    const walletService = new WalletServiceImpl(
        uow,
        new WalletRepositoryImpl(),
        new TransactionRepositoryImpl(),
        new PlatformAccountRepositoryImpl()
    );
    app.route("/api/wallet", createWalletRoutes(walletService));

    const adminUserRepo = new AdminUserRepositoryImpl();

    const authService = new AuthServiceImpl(
        uow,
        new UserRepositoryImpl(),
        new Argon2PasswordHasher(),
        new JWTProviderImpl(cfg.JWT_SECRET),
        new RefreshTokenRepositoryImpl(),
        new UserRegionMapRepositoryImpl(),
        cfg.JWT_ACCESS_EXPIRY,
        cfg.JWT_REFRESH_EXPIRY,
        outboxPublisher,
    );
    app.route(
        "/api/auth",
        createAuthRoutes(authService, cfg.ENABLE_DEBUG_ENDPOINTS),
    );

    const userService = new UserServiceImpl(uow, clientRepo, engineerRepo, new UserDomainRepositoryImpl(), new AdminReviewRepositoryImpl(), adminUserRepo);
    app.route("/api/users", createUserRoutes(userService));
    app.route("/api/admin/users", createAdminUserRoutes(userService));

    const fileService = new FileServiceImpl(
        uow,
        new FileRepositoryImpl(),
        s3Registry,
        globalS3Provider,
        cfg,
    );
    app.route("/api/files", createFileRoutes(fileService, cfg.ENABLE_DEBUG_ENDPOINTS));

    const jobService = new JobServiceImpl(
        uow,
        new JobRepositoryImpl(),
        new RateCardStub(),
        userService,
        walletService,
        fileService,
    );
    userService.setJobAdminService(jobService);
    app.route("/api/jobs", createJobRoutes(jobService));

    app.doc31("/openapi.json", {
        openapi: "3.1.0",
        info: { title: "Field Techy API", version: "0.1.0" },
    });

    app.get("/", Scalar({ spec: { url: "/openapi.json" } }));

    return { app, uow, s3Registry, registry, outboxRelay };
}

export type AppType = ReturnType<typeof makeApp>["app"];
