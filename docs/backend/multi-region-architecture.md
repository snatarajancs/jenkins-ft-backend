# FT Architecture

## 1. Purpose

This document is the canonical, self-contained reference for the Field Techy multi-region architecture. It exists to **prevent architecture drift**: every new module, table, and endpoint must conform to the patterns described here. When in doubt, follow this document.

Core ideas:

- **Global DB** holds all business data (branches, files, jobs, chat, notifications, wallets, lookup data)
- **Regional DB** holds only users, user profiles, and refresh tokens (one DB per deployment region)
- **Global S3** stores non-profile files (chat attachments, job files, reports)
- **Regional S3** stores profile images and user-uploaded identity documents
- The architecture is **transparent** — clients talk to one API; routing to the correct regional DB/S3 happens server-side via JWT claims

---

## 2. Data Classification

| Tier            | Contents                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Global DB**   | `user_region_map`, lookup data (countries, states, cities, currencies), branches, files (non-profile), jobs, chat, notifications, wallets |
| **Regional DB** | `users`, `refresh_tokens`, engineer/client profiles, user_status, profile-image file records                                              |
| **Global S3**   | Chat attachments, job files, reports                                                                                                      |
| **Regional S3** | Profile pictures, user-uploaded identity documents                                                                                        |

**Rule of thumb**: Data tied to a specific user account lives in the user's home regional DB. All other data lives in the global DB.

**Region identity is configuration, not data.** There is no `regions` table. A region exists only because it is present in the `REGION_CONFIGS` environment variable, which also defines its database connection string and S3 bucket. Region IDs are plain integers validated against `REGION_CONFIGS` at runtime.

---

## 3. User Model & Roles

### 3.1 Role Definitions

Three roles, defined as an `as const` object literal with the union type derived from it. The tuple `ROLE_VALUES` feeds both zod (`z.enum`) and Drizzle (`pgEnum`), keeping type-level and runtime enums in agreement from a single source:

```typescript
// modules/auth/domain/roles.ts
export const ROLES = {
  admin: "admin",
  engineer: "engineer",
  client: "client",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_VALUES = Object.values(ROLES) as [Role, ...Role[]];
```

| Role       | Description                                    |
| ---------- | ---------------------------------------------- |
| `admin`    | Administers users and data within their region |
| `engineer` | Field engineer / operator within a region      |
| `client`   | End customer within a region                   |

### 3.2 User Identity

Users live in the **regional DB**. Every user belongs to exactly one region. The pair `(id, regionId)` uniquely identifies any user across the system.

```typescript
// modules/auth/infra/schema.regional.ts
export const userRoleEnum = pgEnum("user_role", ROLE_VALUES);

export const users = pgTable("users", {
  id: serial("id").primaryKey(), // serial per region
  regionId: integer("region_id").notNull(), // home region (matches the DB)
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Login routing**: On login, the system looks up the user's home region via `user_region_map` (global DB, keyed by email hash) and routes authentication to the correct regional DB. Once authenticated, the JWT encodes the user's `regionId` so all subsequent requests route directly to the right region.

**Registration** requires both `regionId` and `role` in the request — there are no defaults. Email uniqueness is enforced across the system via `user_region_map.emailHash` (global) plus `users.email` (regional).

### 3.3 JWT Payload

```typescript
interface JWTPayload {
  userId: UserId; // user.id from the regional DB
  regionId: RegionId; // the user's home region (>0)
  role: Role;
  sub: string; // e.g. "1:42" (regionId:userId)
  iat?: number;
  exp?: number;
}
```

`requireAuth` validates the JWT payload through a branded zod schema rather than a raw cast — a token missing `userId`/`regionId` or carrying a non-positive region ID is rejected with 401. Downstream handlers read the validated, branded payload from the request context.

### 3.4 Branded IDs

All numeric identifiers in the domain layer are **branded** using zod's `$brand` type. This makes the system's composite-identity model (`(userId, regionId)`, and later `branchId`, `fileId`, etc.) compile-time enforced: passing a `userId` where a `regionId` is expected is a type error, not a silent bug.

```typescript
// shared/domain/types.ts
import { type $brand } from "zod";

export type RegionId = number & $brand<"RegionId">;
export type UserId = number & $brand<"UserId">;

export const toRegionId = (n: number): RegionId => n as RegionId;
export const toUserId = (n: number): UserId => n as UserId;
```

Branding enters the system at **trust boundaries only**:

1. **Zod validation** — request DTOs and query params use branded schemas (`shared/infra/id-schemas.ts`), so parsed values are already branded with no cast.
2. **JWT verify** — the payload schema in `requireAuth` produces branded fields.
3. **DB rows** — Drizzle returns plain numbers; repo row mappers use `toRegionId`/`toUserId` (the only explicit casts).

A branded ID is assignable to `number`, so it flows into Drizzle inserts, JWT signing, and JSON serialization without further casts.

### 3.5 Cross-Table User References

Tables referencing a user store `(userId, regionId)` as a composite:

```typescript
// Example: a regional table referencing the user who created a record
export const someRecord = pgTable("some_record", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by").notNull(), // users.id
  createdByRegion: integer("created_by_region").notNull(), // users.region_id
  // ...
});
```

No cross-DB foreign key constraints — referential integrity is enforced at the application layer.

---

## 4. Folder Structure

```
backend-new/
  .env
  .gitignore
  .prettierrc
  package.json
  tsconfig.json
  vitest.config.ts
  docker-compose.yml               # postgres:18 + minio for local dev
  my-scripts/
    init-dbs.sql                   # creates per-region databases (ft_region_1, ft_region_2)
    setup.sh                       # waits for containers, creates S3 buckets, runs migrations

  drizzle.global.config.ts         # Schema: ./src/modules/**/schema.global.ts → ./migrations/global
  drizzle.regional.config.ts       # Schema: ./src/modules/**/schema.regional.ts → ./migrations/regional
  migrations/
    global/                        # Global DB migrations
    regional/                      # Regional DB migrations
  scripts/
    migrate-all.ts                 # Reads GLOBAL_DATABASE_URL + REGION_CONFIGS, runs migrations

  src/
    main.ts                        # Entry point (env → loadConfig → makeApp → serve)

    bootstrap/
      app.ts                       # makeApp() — wires infra + all module routes
      global-schema.ts             # Aggregates all module schema.global.ts
      regional-schema.ts           # Aggregates all module schema.regional.ts

    shared/
      domain/
        errors.ts                  # AppError, ClientError, UnauthorizedError, NotFoundError, etc.
        types.ts                   # Branded IDs (RegionId, UserId) via zod $brand + boundary helpers
        unit-of-work.ts            # UnitOfWork interface
        db-types.ts                # GlobalDb, RegionalDb, DbContext
      infra/
        config.ts                  # Zod env schema + loadConfig()
        context.ts                 # AppVariables, getJwtPayload(), getRequiredRegionId(), getDbCtx()
        db-registry.ts             # RegionalDatabaseRegistry
        unit-of-work.ts            # UnitOfWorkImpl
        middlewares.ts             # requireAuth, requireRole, requireAdmin, requireAdminRegion
        id-schemas.ts              # RegionIdSchema, UserIdSchema, RegionIdParamSchema
        schema.ts                  # CommonErrorResponses for OpenAPI
        openapi.ts                 # OPENAPI_TAGS, openapiSpec
        default-hook.ts            # Zod validation error hook for OpenAPI routes
        factories/
          database.ts              # createDatabase() / getRegistry() / closeDatabase()
          s3-registry.ts           # RegionalS3Registry + createS3Registry()

    modules/
      <module>/
        domain/                    # Types, entities, repository interfaces, providers (no framework)
        app/                       # DTOs (zod schemas) + service implementations
        infra/                     # Drizzle schemas, HTTP handlers, repo impls, providers

      health/
        domain/health-types.ts     # DbHealthResult, DbStatus
        app/services.ts            # HealthServiceImpl
        health.routes.ts           # GET /health, GET /health/db

      auth/
        domain/
          entities.ts              # User, RefreshToken, CreateUserInput, CreateRefreshTokenInput
          repos.ts                 # UserRepository, RefreshTokenRepository, UserRegionMapRepository
          providers.ts             # PasswordHasher, JWTProvider
          roles.ts                 # ROLES as-const object, Role type, ROLE_VALUES
        app/
          dtos.ts                  # Login/Register/RefreshToken/Logout schemas
          services.ts              # AuthServiceImpl (uses UoW for global + regional routing)
        infra/
          schema.global.ts         # user_region_map
          schema.regional.ts       # users, refresh_tokens
          handlers/index.ts        # createAuthRoutes()
          repo/index.ts            # UserRepositoryImpl
          repo/refresh-token-repo.ts
          repo/user-region-map-repo.ts
          providers/jwt-provider.ts    # Issues JWT with { userId, regionId, role }
          providers/argon2-hasher.ts

      profile/                     # (planned) Regional DB + regional S3
      branches/                    # (planned) Global DB
      files/                       # (planned) Global DB + global S3

  e2e/
    vitest.config.ts               # pool: threads
    fixtures/
      containers.ts                # startPostgres(), startMinio() via testcontainers
      global-setup.ts              # Spins up 3 Postgres (1 global + 2 regional) + 1 Minio
      worker-fixture.ts            # WorkerFixture: sets env, runs migrations, starts server
      worker-setup.ts              # beforeAll/afterAll
    tests/
      health.test.ts               # /health, /health/db with multi-region checks
      auth.test.ts                 # Region-aware auth
```

**Module convention**: every module follows the same `domain/` → `app/` → `infra/` layering, where `domain/` never imports framework or infrastructure code.

---

## 5. Schema Organization (Per Module)

**No shared `db/` folder.** Each module owns its table definitions:

```
modules/auth/infra/schema.global.ts       → user_region_map
modules/auth/infra/schema.regional.ts     → users, refresh_tokens
modules/profile/infra/schema.regional.ts  → engineer, client profiles, user_status, otps (planned)
modules/branches/infra/schema.global.ts   → branches (planned)
modules/files/infra/schema.global.ts      → files, non-profile (planned)
```

**Schema aggregation** for the DB registry lives in `bootstrap/`:

```typescript
// bootstrap/global-schema.ts
import { userRegionMap } from "../modules/auth/infra/schema.global.js";

export const globalSchema = { userRegionMap };
```

```typescript
// bootstrap/regional-schema.ts
import { users, refreshTokens } from "../modules/auth/infra/schema.regional.js";

export const regionalSchema = { users, refreshTokens };
```

The aggregated schemas are consumed by the composition root only (`shared/infra/factories/database.ts`). Drizzle v1 does **not** take a `schema` argument — instances are created with `drizzle({ client })`, and tables are referenced directly in queries:

```typescript
const client = postgres(url, { max: 10 });
const db = drizzle({ client }) as unknown as RegionalDb;
```

---

## 6. Infrastructure Flow

### 6.1 Startup Sequence

```
main.ts
  loadConfig()                ← GLOBAL_DATABASE_URL + REGION_CONFIGS
  makeApp(config)
    createDatabase(config)
      → createGlobalDatabase(globalUrl, globalSchema)
      → RegionalDatabaseRegistry(globalDb)
      → registry.initFromConfig(regionConfigs, regionalSchema)
    createS3Registry(config)  → RegionalS3Registry
    UnitOfWorkImpl.setRegistry(registry)
    wire health module        → createHealthRouter(HealthServiceImpl)
    wire auth module          → createAuthRoutes(AuthServiceImpl)
    (profile, branches, files → planned)
    wire routes, error handler, OpenAPI doc
```

### 6.2 Request Flow

```
Request
  → Middleware chain
    → requireAuth (JWT verify → zod-validated branded payload → c.set("userId"/"regionId"/"role"))
    → requireRole("admin") / requireRole("engineer") / requireRole("client") (role guard)
    → requireAdminRegion (region scoping for admin cross-region access)
  → Handler: validates params/body (Zod) → calls service.method(c, data)
    → service: uow.transaction(c, async (ctx) => {
        // ctx.regional = user's home regional DB (from c.get("regionId"))
        // ctx.global   = global DB
        const user = await userRepo.findBy(ctx.regional, { id: userId });
        const branch = await branchRepo.findBy(ctx.global, branchId);
      })
  → Handler: sends response
```

### 6.3 DB Routing (UnitOfWork)

| Method                          | Purpose                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `getRegionalDb(c, regionId?)`   | Home region from JWT, or explicit `RegionId`                      |
| `getGlobalDb()`                 | Global DB                                                         |
| `transaction(c, fn, regionId?)` | Regional transaction, `fn` receives `DbContext{regional, global}` |
| `globalTransaction(fn)`         | Global DB transaction                                             |

### 6.4 S3 Routing

- **Profile files**: `s3Registry.getProvider(regionId)` → per-region S3 bucket
- **Non-profile files**: Singleton global S3 client → global bucket

---

## 7. Drizzle Configuration

```typescript
// drizzle.global.config.ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/modules/**/schema.global.ts",
  out: "./migrations/global",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

`drizzle.regional.config.ts` is identical except `schema: "./src/modules/**/schema.regional.ts"` and `out: "./migrations/regional"`.

### Commands

```json
{
  "db:generate:global": "drizzle-kit generate --config=drizzle.global.config.ts",
  "db:generate:regional": "drizzle-kit generate --config=drizzle.regional.config.ts",
  "db:migrate:all": "tsx scripts/migrate-all.ts"
}
```

`scripts/migrate-all.ts` reads `GLOBAL_DATABASE_URL` (global migrations) then iterates `REGION_CONFIGS` running regional migrations against each region's database.

---

## 8. Configuration

### Environment Variables

```env
GLOBAL_DATABASE_URL=postgresql://user:pass@host:5432/ft_global
REGION_CONFIGS=[{"regionId":1,"dbUrl":"postgresql://...","s3Bucket":"profile-files-in","awsRegion":"ap-south-1"}]

JWT_SECRET=super-secret-key-at-least-32-chars!!
JWT_ACCESS_EXPIRY=15 min
JWT_REFRESH_EXPIRY=1 day

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_ENDPOINT_URL=http://localhost:9000   # MinIO override

ENABLE_DEBUG_ENDPOINTS=true
```

### Per-Region Config Schema

```typescript
const regionConfigSchema = z.object({
  regionId: z.coerce.number().int().positive(),
  dbUrl: z.string(),
  s3Bucket: z.string().optional(),
  awsRegion: z.string(),
  awsEndpoint: z.string().optional(),
});
```

---

## 9. Health API

```
GET /health      → 200 { "status": "ok" }            (no DB calls)
GET /health/db   → pings global DB + every registered regional DB with SELECT 1
```

- All healthy → `200 { "global": "ok", "regional": { "1": "ok", "2": "ok" } }`
- Any DB unreachable → `503 { "error": "...", "details": { "global": "ok", "regional": { "1": "ok", "2": "error" } } }` — the `details` object pinpoints exactly which DB(s) failed.

The health module follows the standard layering: `HealthService` (app) delegates DB pings through `UnitOfWork.getGlobalDb()` / `getAllRegionalDbs()`.

---

## 10. E2E Tests

```
e2e/
  vitest.config.ts
  fixtures/
    containers.ts         # startPostgres() (postgres:18), startMinio() (minio/minio:latest)
    global-setup.ts       # 3 Postgres (1 global + 2 regional) + 1 Minio per test run
    worker-fixture.ts     # Sets env, runs migrations, starts in-process server
    worker-setup.ts       # beforeAll/afterAll lifecycle
  tests/
    health.test.ts        # Multi-region health checks
    auth.test.ts          # Region-aware auth (register/login/refresh/logout)
```

Per-worker environment drives the app exactly like production:

```typescript
process.env.GLOBAL_DATABASE_URL = globalConnectionString;
process.env.REGION_CONFIGS = JSON.stringify([
  {
    regionId: 1,
    dbUrl: region1ConnectionString,
    s3Bucket: "test-bucket-r1",
    awsRegion: "ap-south-1",
  },
  {
    regionId: 2,
    dbUrl: region2ConnectionString,
    s3Bucket: "test-bucket-r2",
    awsRegion: "eu-west-2",
  },
]);
```
