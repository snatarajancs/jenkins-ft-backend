import { sign, verify } from "hono/jwt";
import type { JWTProvider } from "../../domain/providers.js";

export class JWTProviderImpl implements JWTProvider {
    constructor(private readonly secret: string) {}

    async sign(payload: Record<string, unknown>): Promise<string> {
        return sign(payload, this.secret, "HS256");
    }

    async verify(token: string): Promise<Record<string, unknown>> {
        return await verify(token, this.secret, "HS256");
    }
}
