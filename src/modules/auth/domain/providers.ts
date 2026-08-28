export interface PasswordHasher {
    hash(password: string): Promise<string>;
    verify(hash: string, plain: string): Promise<boolean>;
}

export interface JWTProvider {
    sign(payload: Record<string, unknown>): Promise<string>;
    verify(token: string): Promise<Record<string, unknown>>;
}
