import { sql } from "drizzle-orm";
import { pgEnum, pgTable, serial, integer, varchar, timestamp, numeric, boolean, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { JOB_TYPE_VALUES, JOB_STATUS_VALUES, JOB_MODE_VALUES, PAYMENT_TERM_VALUES, SCHEDULE_TYPE_VALUES, CONTACT_TYPE_VALUES, JOB_APPLICATION_STATUS_VALUES } from "../domain/enums.js";

export const jobTypeEnum = pgEnum("job_type", JOB_TYPE_VALUES);
export const jobStatusEnum = pgEnum("job_status", JOB_STATUS_VALUES);
export const jobModeEnum = pgEnum("job_mode", JOB_MODE_VALUES);
export const paymentTermEnum = pgEnum("payment_term", PAYMENT_TERM_VALUES);
export const scheduleTypeEnum = pgEnum("schedule_type", SCHEDULE_TYPE_VALUES);
export const contactTypeEnum = pgEnum("contact_type", CONTACT_TYPE_VALUES);
export const jobApplicationStatusEnum = pgEnum("job_application_status", JOB_APPLICATION_STATUS_VALUES);

export const jobs = pgTable("jobs", {
    id: serial("id").primaryKey(),
    jobNumber: varchar("job_number", { length: 100 }).notNull().unique(),
    clientId: integer("client_id").notNull(),
    clientRegionId: integer("client_region_id").notNull(),
    jobType: jobTypeEnum("job_type").notNull(),
    jobStatus: jobStatusEnum("job_status").notNull(),
    jobMode: jobModeEnum("job_mode").notNull(),
    paymentTerm: paymentTermEnum("payment_term"),
    jobTitleId: integer("job_title_id").notNull(),
    skillLevelId: integer("skill_level_id").notNull(),
    description: varchar("description", { length: 5000 }).notNull(),
    countryId: integer("country_id").notNull(),
    stateId: integer("state_id").notNull(),
    cityId: integer("city_id").notNull(),
    postalCode: varchar("postal_code", { length: 50 }).notNull(),
    streetAddress: varchar("street_address", { length: 255 }).notNull(),
    apartmentUnit: varchar("apartment_unit", { length: 100 }).notNull(),
    attachmentId: integer("attachment_id"),

    // Schedule Fields
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    totalHours: numeric("total_hours", { precision: 5, scale: 2, mode: "number" }),
    shiftStartTime: varchar("shift_start_time", { length: 10 }),
    shiftEndTime: varchar("shift_end_time", { length: 10 }),
    scheduleForAllDay: boolean("schedule_for_all_day"),
    isRecurring: boolean("is_recurring"),
    repeatEvery: varchar("repeat_every", { length: 20 }),
    months: integer("months"),

    // Dedicated Pricing Columns
    currencyId: integer("currency_id").notNull(),
    engineerCost: numeric("engineer_cost", { precision: 12, scale: 2, mode: "number" }).notNull(),
    toolCost: numeric("tool_cost", { precision: 12, scale: 2, mode: "number" }).notNull(),
    travelCost: numeric("travel_cost", { precision: 12, scale: 2, mode: "number" }).notNull(),
    platformFeePercentage: numeric("platform_fee_percentage", { precision: 5, scale: 2, mode: "number" }).notNull(),
    totalPrice: numeric("total_price", { precision: 12, scale: 2, mode: "number" }).notNull(),

    // Audit Timestamps
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
},
    (table) => [
        index("jobs_client_region_created_at_id_idx").on(table.clientRegionId, table.createdAt, table.id),
        index("jobs_client_region_status_idx").on(table.clientRegionId, table.jobStatus),
    ],
);

export const jobApplications = pgTable("job_applications", {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
        .notNull()
        .references(() => jobs.id),
    engineerId: integer("engineer_id").notNull(),
    status: jobApplicationStatusEnum("status").default("APPLIED").notNull(),
    appliedAt: timestamp("applied_at").defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
    uniqueIndex("job_applications_job_id_engineer_id_uniq").on(table.jobId, table.engineerId),
    uniqueIndex("job_applications_one_active_per_job")
        .on(table.jobId)
        .where(sql`status = 'APPLIED'`),
    index("job_applications_job_id_status_idx").on(table.jobId, table.status),
    index("job_applications_engineer_id_idx").on(table.engineerId),
]);

export const jobContacts = pgTable("job_contacts", {
    id: serial("id").primaryKey(),

    jobId: integer("job_id")
        .notNull()
        .references(() => jobs.id),

    contactType: contactTypeEnum("contact_type").notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        index("job_contacts_job_id_idx").on(table.jobId),
    ],
);

export const jobChecklistItems = pgTable("job_checklist_items", {
    id: serial("id").primaryKey(),

    jobId: integer("job_id")
        .notNull()
        .references(() => jobs.id),

    taskName: varchar("task_name", { length: 500 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        index("job_checklist_items_job_id_idx").on(table.jobId),
    ],
);

export const jobScheduleDates = pgTable("job_schedule_dates", {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id),
    date: date("date").notNull(),
    scheduleType: scheduleTypeEnum("schedule_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
},
    (table) => [
        index("job_schedule_dates_job_id_idx").on(table.jobId),
    ],
);

export const jobSkills = pgTable("job_skills", {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id),
    skillId: integer("skill_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        index("job_skills_job_id_idx").on(table.jobId),
    ],
);

export const jobTools = pgTable("job_tools", {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id),
    toolId: integer("tool_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        index("job_tools_job_id_idx").on(table.jobId),
    ],
);


