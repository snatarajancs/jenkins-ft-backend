import { eq } from "drizzle-orm";
import type { RegionalDb } from "../../../../shared/domain/db-types.js";
import { engineers, engineerSkills, engineerTools, users } from "../schema.regional.js";
import type { EngineerProfile, EngineerSkillMapping, EngineerToolMapping } from "../../domain/entities.js";
import type { EngineerRepository } from "../../domain/repos.js";
import { toEngineerInsert } from "./converters.js";

export class EngineerRepositoryImpl implements EngineerRepository {
    async findByUserId(db: RegionalDb, userId: number): Promise<EngineerProfile | null> {
        const [row] = await db.select().from(engineers).where(eq(engineers.userId, userId)).limit(1);
        return row || null;
    }

    async findByUserIdWithEmail(db: RegionalDb, userId: number): Promise<(EngineerProfile & { email: string }) | null> {
        const [row] = await db
            .select({ engineer: engineers, email: users.email })
            .from(engineers)
            .innerJoin(users, eq(engineers.userId, users.id))
            .where(eq(engineers.userId, userId))
            .limit(1);
        if (!row) return null;
        return { ...row.engineer, email: row.email };
    }

    async upsert(
        db: RegionalDb,
        userId: number,
        profile: Partial<EngineerProfile>
    ): Promise<EngineerProfile> {
        const [row] = await db
            .insert(engineers)
            .values(toEngineerInsert(userId, profile))
            .onConflictDoUpdate({
                target: engineers.userId,
                set: {
                    ...profile,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return row;
    }

    async getSkills(db: RegionalDb, engineerId: number): Promise<EngineerSkillMapping[]> {
        return db.select().from(engineerSkills).where(eq(engineerSkills.engineerId, engineerId));
    }

    async getTools(db: RegionalDb, engineerId: number): Promise<EngineerToolMapping[]> {
        return db.select().from(engineerTools).where(eq(engineerTools.engineerId, engineerId));
    }

    async replaceSkills(db: RegionalDb, engineerId: number, skills: readonly number[]): Promise<void> {
        await db.delete(engineerSkills).where(eq(engineerSkills.engineerId, engineerId));
        const uniqueSkills = [...new Set(skills)];
        if (uniqueSkills.length > 0) {
            await db.insert(engineerSkills).values(
                uniqueSkills.map((skillId) => ({
                    engineerId,
                    skillId,
                }))
            );
        }
    }

    async replaceTools(db: RegionalDb, engineerId: number, tools: readonly number[]): Promise<void> {
        await db.delete(engineerTools).where(eq(engineerTools.engineerId, engineerId));
        const uniqueTools = [...new Set(tools)];
        if (uniqueTools.length > 0) {
            await db.insert(engineerTools).values(
                uniqueTools.map((toolId) => ({
                    engineerId,
                    toolId,
                }))
            );
        }
    }
}
