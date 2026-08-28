import { type $brand } from "zod";

export type RegionId = number & $brand<"RegionId">;
export type UserId = number & $brand<"UserId">;
export type WalletId = number & $brand<"WalletId">;
export type TransactionId = number & $brand<"TransactionId">;

export type JobId = number & $brand<"JobId">;
export type ClientId = number & $brand<"ClientId">;
export type EngineerId = number & $brand<"EngineerId">;
export type ClientRegionId = number & $brand<"ClientRegionId">;
export type JobTitleId = number & $brand<"JobTitleId">;
export type SkillLevelId = number & $brand<"SkillLevelId">;
export type SkillId = number & $brand<"SkillId">;
export type ToolId = number & $brand<"ToolId">;
export type AttachmentId = number & $brand<"AttachmentId">;
export type CountryId = number & $brand<"CountryId">;
export type StateId = number & $brand<"StateId">;
export type CityId = number & $brand<"CityId">;
export type CurrencyId = number & $brand<"CurrencyId">;
export type PlatformAccountId = number & $brand<"PlatformAccountId">;
export type FileId = number & $brand<"FileId">;

export const toRegionId = (n: number): RegionId => n as RegionId;
export const toUserId = (n: number): UserId => n as UserId;
export const toWalletId = (n: number): WalletId => n as WalletId;
export const toTransactionId = (n: number): TransactionId => n as TransactionId;

export const toJobId = (n: number): JobId => n as JobId;
export const toClientId = (n: number): ClientId => n as ClientId;
export const toEngineerId = (n: number): EngineerId => n as EngineerId;
export const toClientRegionId = (n: number): ClientRegionId => n as ClientRegionId;
export const toJobTitleId = (n: number): JobTitleId => n as JobTitleId;
export const toSkillLevelId = (n: number): SkillLevelId => n as SkillLevelId;
export const toSkillId = (n: number): SkillId => n as SkillId;
export const toToolId = (n: number): ToolId => n as ToolId;
export const toAttachmentId = (n: number): AttachmentId => n as AttachmentId;
export const toCountryId = (n: number): CountryId => n as CountryId;
export const toStateId = (n: number): StateId => n as StateId;
export const toCityId = (n: number): CityId => n as CityId;
export const toCurrencyId = (n: number): CurrencyId => n as CurrencyId;
export const toPlatformAccountId = (n: number): PlatformAccountId => n as PlatformAccountId;
export const toFileId = (n: number): FileId => n as FileId;


