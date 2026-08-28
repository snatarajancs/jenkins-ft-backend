export const ROLES = {
    admin: "admin",
    engineer: "engineer",
    client: "client",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_VALUES = Object.values(ROLES) as [Role, ...Role[]];

export const REVIEWABLE_ROLES: [Role, ...Role[]] = ["client", "engineer"];

export type ReviewableRole = (typeof REVIEWABLE_ROLES)[number];
