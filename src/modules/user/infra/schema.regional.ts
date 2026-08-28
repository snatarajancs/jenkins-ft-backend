import { pgEnum, pgTable, serial, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { ROLE_VALUES } from "../../auth/domain/roles.js";
import { ACCOUNT_STATUS_VALUES } from "../domain/entities.js";

export const userRoleEnum = pgEnum("user_role", ROLE_VALUES);

export const accountStatusEnum = pgEnum("account_status", ACCOUNT_STATUS_VALUES);

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    regionId: integer("region_id").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const clients = pgTable("clients", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    mobileNumber: varchar("mobile_number", { length: 20 }).notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    address: varchar("address", { length: 255 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    country: varchar("country", { length: 100 }).notNull(),
    hearAboutUs: varchar("hear_about_us", { length: 255 }),
    avatarId: integer("avatar_id"),
    accountStatus: accountStatusEnum("account_status").default("submitted").notNull(),
    statusReason: varchar("status_reason", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const engineers = pgTable("engineers", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    mobileNumber: varchar("mobile_number", { length: 20 }).notNull(),
    address: varchar("address", { length: 255 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    country: varchar("country", { length: 100 }).notNull(),
    avatarId: integer("avatar_id"),
    education: varchar("education", { length: 255 }),
    specialization: varchar("specialization", { length: 255 }),
    certifications: varchar("certifications", { length: 500 }),
    experience: integer("experience"),
    minRate: integer("min_rate"),
    maxRate: integer("max_rate"),
    onsite: boolean("onsite").notNull(),
    remote: boolean("remote").notNull(),
    travel: boolean("travel").notNull(),
    urgent: boolean("urgent").notNull(),
    fullTime: boolean("full_time").notNull(),
    notification: boolean("notification").notNull(),
    radius: integer("radius"),
    workExpiry: timestamp("work_expiry"),
    resumeId: integer("resume_id"),
    coverLetterId: integer("cover_letter_id"),
    eligibilityId: integer("eligibility_id"),
    skillLevelId: integer("skill_level_id"),
    accountStatus: accountStatusEnum("account_status").default("submitted").notNull(),
    statusReason: varchar("status_reason", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const engineerSkills = pgTable("engineer_skills", {
    id: serial("id").primaryKey(),
    engineerId: integer("engineer_id")
        .notNull()
        .references(() => engineers.id, { onDelete: "cascade" }),
    skillId: integer("skill_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const engineerTools = pgTable("engineer_tools", {
    id: serial("id").primaryKey(),
    engineerId: integer("engineer_id")
        .notNull()
        .references(() => engineers.id, { onDelete: "cascade" }),
    toolId: integer("tool_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
