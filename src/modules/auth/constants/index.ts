export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const MAX_SESSIONS_PER_USER = 10;

export const PASSWORD_ALGO = "argon2id-v1";

export const IDENTIFIER_FAIL_LIMIT = 5;
export const IDENTIFIER_FAIL_WINDOW_MS = 15 * 60_000; // 15 minutes

export const IP_FAIL_LIMIT = 20;
export const IP_FAIL_WINDOW_MS = 15 * 60_000; // 15 minutes
