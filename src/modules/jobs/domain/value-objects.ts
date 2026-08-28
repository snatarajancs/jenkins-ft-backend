import type { CountryId, StateId, CityId } from "../../../shared/domain/types.js";

export interface WorkAddress {
    countryId: CountryId;
    country?: string;
    stateId: StateId;
    state?: string;
    cityId: CityId;
    city?: string;
    postalCode: string;
    streetAddress: string;
    apartmentUnit: string;
}

export interface ContactPerson {
    name: string;
    phone: string;
    email: string;
}

export interface Contacts {
    spoc?: ContactPerson;
    sme?: ContactPerson;
    reportingManager?: ContactPerson;
}


export interface DispatchSchedule {
    startDate?: string;
    endDate?: string;
    shiftStartTime: string;
    shiftEndTime: string;
    totalHours: number;
}

export interface FullTimeSchedule {
    startDate: string;
    endDate: string;
    shiftStartTime: string;
    shiftEndTime: string;
    months: number;
}

export interface ScheduledSchedule {
    startDate?: string;
    endDate?: string;
    scheduleForAllDay: boolean;
    isRecurring: boolean;
    repeatEvery?: string;
    shiftStartTime: string;
    shiftEndTime: string;
    dates: string[];
}

export type JobSchedule = DispatchSchedule | FullTimeSchedule | ScheduledSchedule;

export interface Pricing {
    currencySymbol: string;
    engineerCost: number;
    toolCost: number;
    travelCost: number;
    platformFeePercentage: number;
    platformFeeAmount: number;
    totalPrice: number;
}
