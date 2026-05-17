# Auth Module

Handles user registration, login, JWT token lifecycle, session management, and audit logging.

## Endpoints

| Method | Route | Auth | Rate limit | Description |
|--------|-------|------|------------|-------------|
| `POST` | `/auth/register` | — | 3 / 60 s | Create account, returns tokens + session |
| `POST` | `/auth/login` | — | 5 / 60 s | Authenticate, returns tokens + session |
| `POST` | `/auth/refresh` | — | 10 / 60 s | Rotate refresh token, issue new access token |
| `GET` | `/auth/me` | JWT | — | Current user profile |
| `GET` | `/auth/sessions` | JWT | — | List active sessions for current user |
| `POST` | `/auth/logout` | JWT | — | Revoke current session, blacklist JTI |
| `DELETE` | `/auth/sessions/:id` | JWT | — | Revoke a specific session by UUID |
| `POST` | `/auth/logout-all` | JWT | — | Revoke all sessions, increment `tokenVersion` |
| `POST` | `/auth/change-password` | JWT | 3 / 60 s | Change password, revoke all sessions |

## Token Design

- **Access token** — JWT, 15 min TTL. Payload: `{ userId, sessionId, v (tokenVersion), jti }`.
- **Refresh token** — 64-char random hex, 7-day TTL. Stored as HMAC-SHA256 hash in `auth_sessions`.
- **Rotation** — each `/auth/refresh` call issues a new refresh token and updates the hash.
- **Reuse detection** — tokens are grouped by `refreshTokenFamily`. If an old token is reused, the entire family is revoked immediately and `REFRESH_REUSE_DETECTED` is logged.
- **JTI blacklist** — on logout, the access token's `jti` is stored in Redis until it naturally expires, preventing reuse of a valid but revoked token.

## Security Measures

- **Password hashing** — argon2 with a server-side pepper (HMAC-SHA256).
- **Brute-force protection**:
  - Per-identifier: tracked in `login_attempts` table (persists across restarts). Limit: configurable via constants.
  - Per-IP: Redis sliding window (fast path). Limit: configurable via constants.
- **Session cap** — maximum active sessions per user enforced; oldest session is revoked on overflow.
- **Logout-all** — atomic transaction: increment `tokenVersion` + revoke all sessions. Any existing JWT with an old `v` value is rejected by `JwtStrategy`.
- **Timing-safe comparison** — refresh token hash comparison uses `timingSafeEqual` to prevent timing attacks.

## Audit Log

Every auth event writes a record to `audit_logs`:

| Event | Trigger |
|-------|---------|
| `LOGIN_SUCCESS` | Successful login or register |
| `REFRESH_SUCCESS` | Token rotated |
| `REFRESH_REUSE_DETECTED` | Stale refresh token submitted |
| `LOGOUT` | Single session logout |
| `LOGOUT_ALL` | All sessions revoked |
| `SESSION_REVOKED` | Specific session deleted |
| `PASSWORD_CHANGED` | Password update |

IP and User-Agent are stored as HMAC-SHA256 hashes (pepper applied) — never in plaintext.

## Key Files

```
auth.controller.ts              — route definitions, throttle decorators
services/auth.service.ts        — all business logic
strategies/jwt.strategy.ts      — validates JWT, checks tokenVersion
guards/jwt-auth.guard.ts        — applies JwtStrategy to protected routes
repositories/user.repository.ts — user CRUD helpers
constants/index.ts              — TTLs, limits, algo name
dto/                            — request/response DTOs
```
