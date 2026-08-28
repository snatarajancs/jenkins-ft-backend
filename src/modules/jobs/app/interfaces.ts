import type { Pricing } from "../domain/value-objects.js";
import type {
    ToolId,
    SkillLevelId,
    CountryId,
} from "../../../shared/domain/types.js";

export interface JobPriceScheduleDateItem {
    date: string;
    scheduleType?: "FULL_DAY" | "HALF_DAY";
}

export interface JobPriceCalculationInput {
    jobType: string;
    skillLevelId: SkillLevelId;
    toolIds: ToolId[];
    totalHours?: number;
    months?: number;
    scheduleDates?: JobPriceScheduleDateItem[];
    countryId?: CountryId;
}

// TODO(RateCardModule): Move RateCardService interface to dedicated RateCard module when created.
export interface RateCardService {
    calculateJobPrice(input: JobPriceCalculationInput): Promise<Pricing>;
    calculateBatchPrice(pricings: Pricing[]): Pricing;
}
