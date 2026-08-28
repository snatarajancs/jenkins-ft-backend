// TODO: Replace static master data stubs with database-backed master data / metadata service when ready.
export const MASTER_COUNTRIES: Record<
  number,
  {
    id: number;
    code: string;
    name: string;
    regionId: number;
  }
> = {
  1: { id: 1, code: "IN", name: "India", regionId: 1 },
  2: { id: 2, code: "GB", name: "United Kingdom", regionId: 2 },
};

export const MASTER_CURRENCIES: Record<
  number,
  {
    id: number;
    code: string;
    name: string;
    symbol: string;
    countryId: number;
    decimalPlaces: number;
  }
> = {
  1: {
    id: 1,
    code: "INR",
    name: "Indian Rupee",
    symbol: "₹",
    countryId: 1,
    decimalPlaces: 2,
  },
  2: {
    id: 2,
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    countryId: 2,
    decimalPlaces: 2,
  },
};

export const MASTER_STATES: Record<number, { id: number; countryId: number; name: string }> = {
  1: { id: 1, countryId: 1, name: "Karnataka" },
  2: { id: 2, countryId: 1, name: "Maharashtra" },
  3: { id: 3, countryId: 1, name: "Tamil Nadu" },
  4: { id: 4, countryId: 2, name: "Greater London" },
};

export const MASTER_CITIES: Record<number, { id: number; stateId: number; name: string }> = {
  1: { id: 1, stateId: 1, name: "Bengaluru" },
  2: { id: 2, stateId: 2, name: "Mumbai" },
  3: { id: 3, stateId: 3, name: "Chennai" },
  4: { id: 4, stateId: 4, name: "London" },
};

export const MASTER_JOB_TITLES: Record<number, string> = {
  1: "Field Engineer",
  2: "Network Engineer",
  3: "Senior Software Engineer",
  4: "DevOps Engineer",
};

export const MASTER_SKILL_LEVELS: Record<number, string> = {
  1: "Junior (1-3 yrs)",
  2: "Mid-Level (3-5 yrs)",
  3: "Senior (5-8 yrs)",
  4: "Lead / Architect (8+ yrs)",
};

export const MASTER_SKILLS: Record<number, string> = {
  1: "Fiber Optics",
  2: "Networking",
  3: "PostgreSQL Schema Design",
  4: "Docker & Kubernetes",
};

export const MASTER_TOOLS: Record<number, string> = {
  1: "VS Code",
  2: "Docker Desktop",
  3: "Crimping Tool",
  4: "Laptop",
};

export function resolveCountryName(countryId: number): string {
  return MASTER_COUNTRIES[countryId]?.name ?? `Country #${countryId}`;
}

export function resolveCurrency(
  currencyId: number,
) {
  return MASTER_CURRENCIES[currencyId];
}

export function resolveCurrencyCode(currencyId: number): string {
  return MASTER_CURRENCIES[currencyId]?.code ?? `Currency #${currencyId}`;
}

export function resolveCurrencySymbol(currencyId: number): string {
  return MASTER_CURRENCIES[currencyId]?.symbol ?? "";
}

export function resolveCurrencyName(currencyId: number): string {
  return MASTER_CURRENCIES[currencyId]?.name ?? `Currency #${currencyId}`;
}

export function resolveCurrencyByCountryId(
  countryId: number,
) {
  return Object.values(MASTER_CURRENCIES).find(
    (currency) => currency.countryId === countryId,
  );
}

export function getExchangeRate(fromCurrencyId: number, toCurrencyId: number): number {
  if (fromCurrencyId === toCurrencyId) return 1.0;
  if (fromCurrencyId === 2 && toCurrencyId === 1) return 100.0; // GBP -> INR
  if (fromCurrencyId === 1 && toCurrencyId === 2) return 0.01;  // INR -> GBP
  return 1.0;
}

export function resolveStateName(stateId: number): string {
  return MASTER_STATES[stateId]?.name ?? `State #${stateId}`;
}

export function resolveCityName(cityId: number): string {
  return MASTER_CITIES[cityId]?.name ?? `City #${cityId}`;
}

export function resolveJobTitleName(jobTitleId: number): string {
  return MASTER_JOB_TITLES[jobTitleId] ?? `Job Title #${jobTitleId}`;
}

export function resolveSkillLevelName(skillLevelId: number): string {
  return MASTER_SKILL_LEVELS[skillLevelId] ?? `Skill Level #${skillLevelId}`;
}

export function resolveSkillNames(skillIds: number[]): string[] {
  return (skillIds || []).map((id) => MASTER_SKILLS[id] ?? `Skill #${id}`);
}

export function resolveToolNames(toolIds: number[]): string[] {
  return (toolIds || []).map((id) => MASTER_TOOLS[id] ?? `Tool #${id}`);
}

export function resolveCountryIdByName(countryName: string): number | undefined {
    const entry = Object.values(MASTER_COUNTRIES).find(
        (c) => c.name.toLowerCase() === countryName.toLowerCase(),
    );
    return entry?.id;
}

