import { refreshTokens } from "../modules/auth/infra/schema.regional.js";
import { users, clients, engineers, engineerSkills, engineerTools } from "../modules/user/infra/schema.regional.js";
import { files as regionalFiles, fileScopeEnum, fileStatusEnum } from "../modules/files/infra/schema.regional.js";

export const regionalSchema = {
    users,
    refreshTokens,
    clients,
    engineers,
    engineerSkills,
    engineerTools,
    regionalFiles, 
    fileScopeEnum,
    fileStatusEnum
};
