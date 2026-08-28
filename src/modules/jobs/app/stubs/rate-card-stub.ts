import type { RateCardService, JobPriceCalculationInput } from "../interfaces.js";
import type { Pricing } from "../../domain/value-objects.js";
import { JobType } from "../../domain/enums.js";
import { resolveCurrencySymbol } from "./master-data-stub.js";

const PLATFORM_FEE_PERCENT = 5;

// Base Rate Card (Base Currency = INR ₹)
const BASE_HOURLY_RATE = 500;
const BASE_HALF_DAY_RATE = 2000;
const BASE_FULL_DAY_RATE = 4000;
const BASE_MONTHLY_RATE = 80000;
const BASE_TOOL_COST_PER_ITEM = 1500;

// Country exchange rates relative to Base Currency (1 INR = 0.01 GBP)
const COUNTRY_CURRENCY_CONFIG: Record<
    number,
    {
        currencyId: number;
        exchangeRate: number; // multiplier to convert base currency to target currency
    }
> = {
    1: { currencyId: 1, exchangeRate: 1.0 },   // INR (India)
    2: { currencyId: 2, exchangeRate: 0.01 },  // GBP (UK) - 1 GBP = 100 INR
};

const DEFAULT_CURRENCY_CONFIG = { currencyId: 1, exchangeRate: 1.0 };

// TODO(RateCardModule): Replace RateCardStub with actual RateCardService implementation when RateCard module is created.
export class RateCardStub implements RateCardService {
    async calculateJobPrice(input: JobPriceCalculationInput): Promise<Pricing> {
        let baseEngineerCost = 0;

        if (input.jobType === JobType.DISPATCH) {
            baseEngineerCost = BASE_HOURLY_RATE * (input.totalHours ?? 8);
        } else if (input.jobType === JobType.SCHEDULED) {
            const dates = input.scheduleDates ?? [];
            if (dates.length === 0) {
                baseEngineerCost = BASE_FULL_DAY_RATE;
            } else {
                for (const d of dates) {
                    baseEngineerCost += d.scheduleType === "HALF_DAY" ? BASE_HALF_DAY_RATE : BASE_FULL_DAY_RATE;
                }
            }
        } else {
            baseEngineerCost = BASE_MONTHLY_RATE * (input.months ?? 1);
        }

        const baseToolCost = (input.toolIds ?? []).length * BASE_TOOL_COST_PER_ITEM;
        const baseTravelCost = 0;
        const baseSubtotal = baseEngineerCost + baseToolCost + baseTravelCost;
        const basePlatformFeeAmount = Math.round((baseSubtotal * PLATFORM_FEE_PERCENT) / 100 * 100) / 100;
        const baseTotalPrice = Math.round((baseSubtotal + basePlatformFeeAmount) * 100) / 100;

        // Determine target currency and conversion rate
        const config = input.countryId
            ? (COUNTRY_CURRENCY_CONFIG[input.countryId] ?? DEFAULT_CURRENCY_CONFIG)
            : DEFAULT_CURRENCY_CONFIG;
        const rate = config.exchangeRate;

        // Convert all pricing amounts to target country currency
        const engineerCost = Math.round(baseEngineerCost * rate * 100) / 100;
        const toolCost = Math.round(baseToolCost * rate * 100) / 100;
        const travelCost = Math.round(baseTravelCost * rate * 100) / 100;
        const platformFeeAmount = Math.round(basePlatformFeeAmount * rate * 100) / 100;
        const totalPrice = Math.round(baseTotalPrice * rate * 100) / 100;

        const currencySymbol = resolveCurrencySymbol(config.currencyId) || "$";

        return {
            currencySymbol,
            engineerCost,
            toolCost,
            travelCost,
            platformFeePercentage: PLATFORM_FEE_PERCENT,
            platformFeeAmount,
            totalPrice,
        };
    }

    calculateBatchPrice(pricings: Pricing[]): Pricing {
        const result = pricings.reduce(
            (acc, p) => ({
                engineerCost: Math.round((acc.engineerCost + p.engineerCost) * 100) / 100,
                toolCost: Math.round((acc.toolCost + p.toolCost) * 100) / 100,
                travelCost: Math.round((acc.travelCost + p.travelCost) * 100) / 100,
                platformFeeAmount: Math.round((acc.platformFeeAmount + p.platformFeeAmount) * 100) / 100,
                totalPrice: Math.round((acc.totalPrice + p.totalPrice) * 100) / 100,
            }),
            { engineerCost: 0, toolCost: 0, travelCost: 0, platformFeeAmount: 0, totalPrice: 0 }
        );

        const firstSymbol = pricings[0]?.currencySymbol ?? "$";

        return {
            currencySymbol: firstSymbol,
            ...result,
            platformFeePercentage: PLATFORM_FEE_PERCENT,
        };
    }
}
