import { hash, verify } from "argon2";
import type { PasswordHasher } from "../../domain/providers.js";

export class Argon2PasswordHasher implements PasswordHasher {
    async hash(password: string): Promise<string> {
        return hash(password);
    }

    async verify(storedHash: string, plain: string): Promise<boolean> {
        return verify(storedHash, plain);
    }
}
