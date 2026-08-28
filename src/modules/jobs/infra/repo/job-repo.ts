import { eq, ne, count, and, sql, ilike, or, desc, inArray, exists, notExists, type SQL } from "drizzle-orm";
import type { GlobalDb } from "../../../../shared/domain/db-types.js";
import { jobs, jobSkills, jobTools, jobScheduleDates, jobContacts, jobChecklistItems, jobApplications } from "../schema.global.js";
import type { Job, JobApplication } from "../../domain/entities.js";
import { JobStatus, JobMode, ScheduleType, JobApplicationStatus, JobApplicationAction } from "../../domain/enums.js";
import { AppError } from "../../../../shared/domain/errors.js";
import {
    JobNotFoundError,
    JobNotAvailableError,
    JobAlreadyAppliedError,
    JobApplicationNotFoundError,
    JobApplicationInvalidStateError,
} from "../../domain/errors.js";
import type { JobId, ClientId, EngineerId, ClientRegionId, CountryId } from "../../../../shared/domain/types.js";
import type {
    JobRepository,
    JobFilters,
    JobListSummary,
    EngineerJobFilters,
    JobApplicationFilters,
    UpdateApplicationStatusParams,
} from "../../domain/repos.js";

import {
    mapJobToInsertValues,
    mapJobToUpdateValues,
    mapRowToJobEntity,
    mapContactsToInsertValues,
    mapChecklistToInsertValues,
    mapRowsToContacts,
    mapRowsToChecklist,
    mapRowToJobApplicationEntity,
} from "./converter.js";

const jobRelationalSelect = {
    job: jobs,
    skills: sql<number[]>`coalesce((
        select json_agg(${jobSkills.skillId})
        from ${jobSkills}
        where ${jobSkills.jobId} = ${jobs.id}
    ), '[]'::json)`,
    tools: sql<number[]>`coalesce((
        select json_agg(${jobTools.toolId})
        from ${jobTools}
        where ${jobTools.jobId} = ${jobs.id}
    ), '[]'::json)`,
    schedules: sql<Array<{ date: string; scheduleType: string }>>`coalesce((
        select json_agg(json_build_object('date', ${jobScheduleDates.date}, 'scheduleType', ${jobScheduleDates.scheduleType}))
        from ${jobScheduleDates}
        where ${jobScheduleDates.jobId} = ${jobs.id}
    ), '[]'::json)`,
    contacts: sql<Array<{ contactType: string; name: string; phone: string; email: string }>>`coalesce((
        select json_agg(json_build_object('contactType', ${jobContacts.contactType}, 'name', ${jobContacts.name}, 'phone', ${jobContacts.phone}, 'email', ${jobContacts.email}))
        from ${jobContacts}
        where ${jobContacts.jobId} = ${jobs.id}
    ), '[]'::json)`,
    checklist: sql<Array<{ taskName: string }>>`coalesce((
        select json_agg(json_build_object('taskName', ${jobChecklistItems.taskName}))
        from ${jobChecklistItems}
        where ${jobChecklistItems.jobId} = ${jobs.id}
    ), '[]'::json)`,
    assignedEngineerId: sql<number | null>`(
        select ${jobApplications.engineerId}
        from ${jobApplications}
        where ${jobApplications.jobId} = ${jobs.id}
        and ${jobApplications.status} = 'ACCEPTED'
        limit 1
    )`,
};

function mapCompositeJobRow(r: {
    job: typeof jobs.$inferSelect;
    skills: number[];
    tools: number[];
    schedules: Array<{ date: string; scheduleType: string }>;
    contacts: Array<{ contactType: string; name: string; phone: string; email: string }>;
    checklist: Array<{ taskName: string }>;
    assignedEngineerId: number | null;
}): Job {
    const skillIds = r.skills ?? [];
    const toolIds = r.tools ?? [];
    const scheduleDates = (r.schedules ?? []).map((s) => ({
        date: s.date,
        scheduleType: (s.scheduleType as ScheduleType) ?? ScheduleType.FULL_DAY,
    }));
    const contacts = mapRowsToContacts(r.contacts ?? []);
    const checklist = mapRowsToChecklist(r.checklist ?? []);

    return mapRowToJobEntity(r.job, skillIds, toolIds, scheduleDates, contacts, checklist, r.assignedEngineerId ?? null);
}

function buildJobFilters(db: GlobalDb, filters: JobFilters): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.clientId) {
        conditions.push(eq(jobs.clientId, filters.clientId));
    }
    if (filters.clientRegionId) {
        conditions.push(eq(jobs.clientRegionId, filters.clientRegionId));
    }
    if (filters.countryId) {
        conditions.push(eq(jobs.countryId, filters.countryId));
    }
    if (filters.engineerId) {
        conditions.push(
            exists(
                db
                    .select()
                    .from(jobApplications)
                    .where(
                        and(
                            eq(jobApplications.jobId, jobs.id),
                            eq(jobApplications.engineerId, filters.engineerId),
                            eq(jobApplications.status, JobApplicationStatus.ACCEPTED),
                        ),
                    ),
            ),
        );
    }
    if (filters.jobStatus) {
        conditions.push(eq(jobs.jobStatus, filters.jobStatus));
    } else if (filters.engineerId) {
        conditions.push(
            inArray(jobs.jobStatus, [
                JobStatus.ASSIGNED,
                JobStatus.ARRIVED,
                JobStatus.IN_PROGRESS,
                JobStatus.COMPLETED,
                JobStatus.CANCELLED,
            ]),
        );
    }
    if (filters.jobType) {
        conditions.push(eq(jobs.jobType, filters.jobType));
    }
    if (filters.jobMode) {
        conditions.push(eq(jobs.jobMode, filters.jobMode));
    }
    if (filters.skillLevelId) {
        conditions.push(eq(jobs.skillLevelId, filters.skillLevelId));
    }
    if (filters.jobTitleId) {
        conditions.push(eq(jobs.jobTitleId, filters.jobTitleId));
    }
    const searchCondition = buildSearchCondition(filters.search);
    if (searchCondition) {
        conditions.push(searchCondition);
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildSearchCondition(search?: string): SQL | undefined {
    if (!search) return undefined;
    const term = `%${search}%`;
    return or(ilike(jobs.jobNumber, term), ilike(jobs.description, term));
}

function buildEngineerModeCondition(onsite?: boolean, remote?: boolean): SQL | undefined {
    if (onsite && remote) {
        return or(eq(jobs.jobMode, JobMode.ONSITE), eq(jobs.jobMode, JobMode.REMOTE));
    }
    if (onsite) {
        return eq(jobs.jobMode, JobMode.ONSITE);
    }
    if (remote) {
        return eq(jobs.jobMode, JobMode.REMOTE);
    }
    return undefined;
}

function buildEngineerRecommendationFilter(db: GlobalDb, params: EngineerJobFilters): SQL | undefined {
    const recConditions: SQL[] = [];

    if (params.engineerSkillLevelId != null) {
        recConditions.push(eq(jobs.skillLevelId, params.engineerSkillLevelId));
    }

    if (params.engineerSkillIds && params.engineerSkillIds.length > 0) {
        recConditions.push(
            exists(
                db
                    .select()
                    .from(jobSkills)
                    .where(
                        and(
                            eq(jobSkills.jobId, jobs.id),
                            inArray(jobSkills.skillId, params.engineerSkillIds),
                        ),
                    ),
            ),
        );
    }

    if (params.engineerToolIds && params.engineerToolIds.length > 0) {
        recConditions.push(
            exists(
                db
                    .select()
                    .from(jobTools)
                    .where(
                        and(
                            eq(jobTools.jobId, jobs.id),
                            inArray(jobTools.toolId, params.engineerToolIds),
                        ),
                    ),
            ),
        );
    }

    const modeCondition = buildEngineerModeCondition(params.engineerOnsite, params.engineerRemote);
    if (modeCondition) {
        recConditions.push(modeCondition);
    }

    // If engineer has profile preferences/criteria, filter by matching recommendation conditions.
    // If no recommendation conditions are set (e.g. fresh profile), fall back to all available jobs in the country.
    return recConditions.length > 0 ? or(...recConditions) : undefined;
}

function buildEngineerJobFilters(db: GlobalDb, params: EngineerJobFilters): SQL {
    const conditions: SQL[] = [
        eq(jobs.countryId, params.countryId),
        eq(jobs.jobStatus, params.jobStatus ?? JobStatus.POSTED),
        notExists(
            db
                .select()
                .from(jobApplications)
                .where(
                    and(
                        eq(jobApplications.jobId, jobs.id),
                        eq(jobApplications.status, JobApplicationStatus.APPLIED),
                    ),
                ),
        ),
    ];

    if (params.jobType) {
        conditions.push(eq(jobs.jobType, params.jobType));
    }
    if (params.jobMode) {
        conditions.push(eq(jobs.jobMode, params.jobMode));
    }
    if (params.skillLevelId) {
        conditions.push(eq(jobs.skillLevelId, params.skillLevelId));
    }

    const searchCondition = buildSearchCondition(params.search);
    if (searchCondition) {
        conditions.push(searchCondition);
    }

    const recFilter = buildEngineerRecommendationFilter(db, params);
    if (recFilter) {
        conditions.push(recFilter);
    }

    return and(...conditions) ?? eq(jobs.countryId, params.countryId);
}

export class JobRepositoryImpl implements JobRepository {
    async createJobs(db: GlobalDb, jobsToInsert: Job[]): Promise<Job[]> {
        if (jobsToInsert.length === 0) return [];

        const insertedRows = await db
            .insert(jobs)
            .values(jobsToInsert.map(mapJobToInsertValues))
            .returning();

        const skillInserts = insertedRows.flatMap((row, i) =>
            jobsToInsert[i].skillIds.map((skillId) => ({ jobId: row.id, skillId })),
        );
        const toolInserts = insertedRows.flatMap((row, i) =>
            jobsToInsert[i].toolIds.map((toolId) => ({ jobId: row.id, toolId })),
        );
        const scheduleDateInserts = insertedRows.flatMap((row, i) =>
            (jobsToInsert[i].scheduleDates ?? []).map((sd) => ({
                jobId: row.id,
                date: sd.date,
                scheduleType: sd.scheduleType ?? ScheduleType.FULL_DAY,
            })),
        );
        const contactInserts = insertedRows.flatMap((row, i) =>
            mapContactsToInsertValues(row.id, jobsToInsert[i].contacts),
        );
        const checklistInserts = insertedRows.flatMap((row, i) =>
            mapChecklistToInsertValues(row.id, jobsToInsert[i].checklist),
        );

        if (skillInserts.length > 0) {
            await db.insert(jobSkills).values(skillInserts);
        }
        if (toolInserts.length > 0) {
            await db.insert(jobTools).values(toolInserts);
        }
        if (scheduleDateInserts.length > 0) {
            await db.insert(jobScheduleDates).values(scheduleDateInserts);
        }
        if (contactInserts.length > 0) {
            await db.insert(jobContacts).values(contactInserts);
        }
        if (checklistInserts.length > 0) {
            await db.insert(jobChecklistItems).values(checklistInserts);
        }

        return insertedRows.map((row, i) =>
            mapRowToJobEntity(
                row,
                jobsToInsert[i].skillIds,
                jobsToInsert[i].toolIds,
                jobsToInsert[i].scheduleDates ?? [],
                jobsToInsert[i].contacts ?? {},
                jobsToInsert[i].checklist ?? [],
            ),
        );
    }

    async findById(db: GlobalDb, id: JobId, clientId?: ClientId, clientRegionId?: ClientRegionId): Promise<Job | null> {
        const conditions: SQL[] = [eq(jobs.id, id)];
        if (clientId) {
            conditions.push(eq(jobs.clientId, clientId));
        }
        if (clientRegionId) {
            conditions.push(eq(jobs.clientRegionId, clientRegionId));
        }

        const [row] = await db
            .select(jobRelationalSelect)
            .from(jobs)
            .where(and(...conditions));

        if (!row) return null;
        return mapCompositeJobRow(row);
    }

    async update(db: GlobalDb, job: Job, clientId: ClientId, clientRegionId: ClientRegionId): Promise<Job> {
        if (!job.id) {
            throw new AppError("Job ID is required to perform an update", 400);
        }
        const jobId = job.id;

        const [updated] = await db
            .update(jobs)
            .set(mapJobToUpdateValues(job))
            .where(
                and(
                    eq(jobs.id, jobId),
                    eq(jobs.clientId, clientId),
                    eq(jobs.clientRegionId, clientRegionId),
                ),
            )
            .returning();

        await db.delete(jobSkills).where(eq(jobSkills.jobId, jobId));
        if (job.skillIds.length > 0) {
            await db.insert(jobSkills).values(
                job.skillIds.map((skillId) => ({ jobId, skillId })),
            );
        }

        await db.delete(jobTools).where(eq(jobTools.jobId, jobId));
        if (job.toolIds.length > 0) {
            await db.insert(jobTools).values(
                job.toolIds.map((toolId) => ({ jobId, toolId })),
            );
        }

        await db.delete(jobScheduleDates).where(eq(jobScheduleDates.jobId, jobId));
        if ((job.scheduleDates ?? []).length > 0) {
            await db.insert(jobScheduleDates).values(
                (job.scheduleDates ?? []).map((sd) => ({
                    jobId,
                    date: sd.date,
                    scheduleType: sd.scheduleType ?? ScheduleType.FULL_DAY,
                })),
            );
        }

        await db.delete(jobContacts).where(eq(jobContacts.jobId, jobId));
        const contactInserts = mapContactsToInsertValues(jobId, job.contacts);
        if (contactInserts.length > 0) {
            await db.insert(jobContacts).values(contactInserts);
        }

        await db.delete(jobChecklistItems).where(eq(jobChecklistItems.jobId, jobId));
        const checklistInserts = mapChecklistToInsertValues(jobId, job.checklist);
        if (checklistInserts.length > 0) {
            await db.insert(jobChecklistItems).values(checklistInserts);
        }

        return mapRowToJobEntity(
            updated,
            job.skillIds,
            job.toolIds,
            job.scheduleDates ?? [],
            job.contacts ?? {},
            job.checklist ?? [],
        );
    }

    async list(db: GlobalDb, params: JobFilters): Promise<{ jobs: Job[]; total: number; summary: JobListSummary }> {
        const page = params.page ?? 1;
        const limit = params.limit ?? 20;
        const offset = (page - 1) * limit;

        const whereClause = buildJobFilters(db, params);

        const [{ totalCount }] = await db
            .select({ totalCount: count() })
            .from(jobs)
            .where(whereClause);

        const summary = await this.getSummary(
            db,
            params.clientRegionId,
            params.clientId,
            params.engineerId,
            params.countryId,
        );

        if (totalCount === 0) {
            return { jobs: [], total: 0, summary };
        }

        const jobRows = await db
            .select(jobRelationalSelect)
            .from(jobs)
            .where(whereClause)
            .orderBy(desc(jobs.createdAt), desc(jobs.id))
            .limit(limit)
            .offset(offset);

        return { jobs: jobRows.map(mapCompositeJobRow), total: totalCount, summary };
    }

    private async getSummary(
        db: GlobalDb,
        clientRegionId?: ClientRegionId,
        clientId?: ClientId,
        engineerId?: number,
        countryId?: CountryId,
    ): Promise<JobListSummary> {
        const conditions: SQL[] = [];
        if (clientRegionId) {
            conditions.push(eq(jobs.clientRegionId, clientRegionId));
        }
        if (clientId) {
            conditions.push(eq(jobs.clientId, clientId));
        }
        if (countryId) {
            conditions.push(eq(jobs.countryId, countryId));
        }
        if (engineerId) {
            conditions.push(
                exists(
                    db
                        .select()
                        .from(jobApplications)
                        .where(
                            and(
                                eq(jobApplications.jobId, jobs.id),
                                eq(jobApplications.engineerId, engineerId),
                                eq(jobApplications.status, JobApplicationStatus.ACCEPTED),
                            ),
                        ),
                ),
            );
        }

        const [result] = await db
            .select({
                totalJobs: count(),
                posted: sql<number>`count(*) filter (where ${jobs.jobStatus} in (${JobStatus.POSTED}, ${JobStatus.DRAFT}, ${JobStatus.ASSIGNED}))::int`,
                inProgress: sql<number>`count(*) filter (where ${jobs.jobStatus} in (${JobStatus.ARRIVED}, ${JobStatus.IN_PROGRESS}))::int`,
                completed: sql<number>`count(*) filter (where ${jobs.jobStatus} = ${JobStatus.COMPLETED})::int`,
                cancelled: sql<number>`count(*) filter (where ${jobs.jobStatus} = ${JobStatus.CANCELLED})::int`,
            })
            .from(jobs)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        return {
            totalJobs: result?.totalJobs ?? 0,
            posted: result?.posted ?? 0,
            inProgress: result?.inProgress ?? 0,
            completed: result?.completed ?? 0,
            cancelled: result?.cancelled ?? 0,
        };
    }
    async getCountsForClients(db: GlobalDb, clientRegionId: ClientRegionId, clientIds: ClientId[]): Promise<Record<number, number>> {
        if (clientIds.length === 0) return {};

        const results = await db
            .select({
                clientId: jobs.clientId,
                count: sql<number>`count(*)::int`
            })
            .from(jobs)
            .where(and(inArray(jobs.clientId, clientIds), eq(jobs.clientRegionId, clientRegionId)))
            .groupBy(jobs.clientId);

        const counts: Record<number, number> = {};
        for (const row of results) {
            counts[row.clientId] = row.count;
        }

        return counts;
    }

    async listRecommendedForEngineer(db: GlobalDb, params: EngineerJobFilters): Promise<{ jobs: Job[]; total: number }> {
        const page = params.page ?? 1;
        const limit = params.limit ?? 20;
        const offset = (page - 1) * limit;

        const whereClause = buildEngineerJobFilters(db, params);

        const [{ totalCount }] = await db
            .select({ totalCount: count() })
            .from(jobs)
            .where(whereClause);

        if (totalCount === 0) {
            return { jobs: [], total: 0 };
        }

        const jobRows = await db
            .select(jobRelationalSelect)
            .from(jobs)
            .where(whereClause)
            .orderBy(desc(jobs.id))
            .limit(limit)
            .offset(offset);

        return { jobs: jobRows.map(mapCompositeJobRow), total: totalCount };
    }

    async applyForJob(db: GlobalDb, jobId: JobId, engineerId: EngineerId): Promise<JobApplication> {
        const [job] = await db
            .select()
            .from(jobs)
            .where(eq(jobs.id, jobId))
            .for("update");

        if (!job) {
            throw JobNotFoundError(jobId);
        }

        if (job.jobStatus !== JobStatus.POSTED) {
            throw JobNotAvailableError(jobId);
        }

        const [existingEngineerApp] = await db
            .select()
            .from(jobApplications)
            .where(
                and(
                    eq(jobApplications.jobId, jobId),
                    eq(jobApplications.engineerId, engineerId),
                ),
            );

        if (existingEngineerApp) {
            throw JobAlreadyAppliedError(jobId, engineerId);
        }

        try {
            const [inserted] = await db
                .insert(jobApplications)
                .values({
                    jobId,
                    engineerId,
                    status: JobApplicationStatus.APPLIED,
                })
                .returning();

            return mapRowToJobApplicationEntity(inserted);
        } catch (error: unknown) {
            const pgError = (error as { cause?: { code?: string; constraint_name?: string; constraint?: string; detail?: string } })?.cause ??
                (error as { code?: string; constraint_name?: string; constraint?: string; detail?: string });
            if (pgError?.code === "23505") {
                const constraint = pgError.constraint_name ?? pgError.constraint ?? "";
                const detail = pgError.detail ?? "";
                if (constraint.includes("engineer_id") || detail.includes("engineer_id")) {
                    throw JobAlreadyAppliedError(jobId, engineerId);
                }
                throw JobNotAvailableError(jobId, "Job already has an active application");
            }
            throw error;
        }
    }

    async findApplications(db: GlobalDb, filters: JobApplicationFilters): Promise<JobApplication[]> {
        const conditions: SQL[] = [];
        if (filters.id) conditions.push(eq(jobApplications.id, filters.id));
        if (filters.jobId) conditions.push(eq(jobApplications.jobId, filters.jobId));
        if (filters.engineerId) conditions.push(eq(jobApplications.engineerId, filters.engineerId));
        if (filters.status) conditions.push(eq(jobApplications.status, filters.status));

        if (filters.clientId && filters.clientRegionId) {
            conditions.push(
                eq(jobs.clientId, filters.clientId),
                eq(jobs.clientRegionId, filters.clientRegionId),
            );

            const rows = await db
                .select({
                    id: jobApplications.id,
                    jobId: jobApplications.jobId,
                    engineerId: jobApplications.engineerId,
                    status: jobApplications.status,
                    appliedAt: jobApplications.appliedAt,
                    reviewedAt: jobApplications.reviewedAt,
                    createdAt: jobApplications.createdAt,
                    updatedAt: jobApplications.updatedAt,
                })
                .from(jobApplications)
                .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
                .where(and(...conditions))
                .orderBy(desc(jobApplications.appliedAt), desc(jobApplications.id));

            return rows.map(mapRowToJobApplicationEntity);
        }

        const query = db.select().from(jobApplications);
        const rows = conditions.length > 0
            ? await query.where(and(...conditions)).orderBy(desc(jobApplications.appliedAt), desc(jobApplications.id))
            : await query.orderBy(desc(jobApplications.appliedAt), desc(jobApplications.id));

        return rows.map(mapRowToJobApplicationEntity);
    }

    async updateApplicationStatus(
        db: GlobalDb,
        params: UpdateApplicationStatusParams,
    ): Promise<{ application: JobApplication }> {
        const { jobId, applicationId, clientId, clientRegionId, action } = params;

        const [result] = await db
            .select({
                job: jobs,
                application: jobApplications,
            })
            .from(jobApplications)
            .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
            .where(
                and(
                    eq(jobApplications.id, applicationId),
                    eq(jobApplications.jobId, jobId),
                    eq(jobs.clientId, clientId),
                    eq(jobs.clientRegionId, clientRegionId),
                ),
            )
            .for("update");

        if (!result) {
            const [jobExists] = await db
                .select({ id: jobs.id })
                .from(jobs)
                .where(
                    and(
                        eq(jobs.id, jobId),
                        eq(jobs.clientId, clientId),
                        eq(jobs.clientRegionId, clientRegionId),
                    ),
                );
            if (!jobExists) {
                throw JobNotFoundError(jobId);
            }
            throw JobApplicationNotFoundError(applicationId);
        }

        const { job: jobRow, application: appRow } = result;

        if (action === JobApplicationAction.ACCEPT && jobRow.jobStatus !== JobStatus.POSTED) {
            throw new AppError(`Job is in '${jobRow.jobStatus}' status and cannot accept applications`, 409);
        }

        if (appRow.status !== JobApplicationStatus.APPLIED) {
            throw JobApplicationInvalidStateError(appRow.status);
        }

        const now = new Date();
        const nextStatus = action === JobApplicationAction.ACCEPT
            ? JobApplicationStatus.ACCEPTED
            : JobApplicationStatus.REJECTED;

        const [updatedApp] = await db
            .update(jobApplications)
            .set({
                status: nextStatus,
                reviewedAt: now,
                updatedAt: now,
            })
            .where(eq(jobApplications.id, applicationId))
            .returning();

        if (action === JobApplicationAction.ACCEPT) {
            await db
                .update(jobs)
                .set({
                    jobStatus: JobStatus.ASSIGNED,
                    updatedAt: now,
                })
                .where(eq(jobs.id, jobId));

            // Auto-reject remaining pending applications for this job
            await db
                .update(jobApplications)
                .set({
                    status: JobApplicationStatus.REJECTED,
                    reviewedAt: now,
                    updatedAt: now,
                })
                .where(
                    and(
                        eq(jobApplications.jobId, jobId),
                        ne(jobApplications.id, applicationId),
                        eq(jobApplications.status, JobApplicationStatus.APPLIED),
                    ),
                );
        }

        return {
            application: mapRowToJobApplicationEntity(updatedApp),
        };
    }
}
