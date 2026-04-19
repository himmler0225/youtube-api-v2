# 🔐 Auth System Implementation Guide

## 🎯 Mục Tiêu
Xây dựng auth system enterprise-grade với:
- ✅ Refresh token rotation
- ✅ Device binding
- ✅ Reuse detection
- ✅ Token versioning
- ✅ Rate limiting
- ✅ Audit logging

---

## 📊 Flow Diagrams

### 1. REGISTER FLOW
```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ POST /auth/register
     │ {username, email, password, deviceId, deviceName}
     ▼
┌─────────────────────────────────────────────┐
│          AuthController.register()          │
└────┬────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│          AuthService.register()             │
│                                             │
│  1. Validate DTO                            │
│  2. Check username/email exists?            │
│     └─ YES → throw CONFLICT                 │
│  3. Hash password (argon2id)                │
│  4. Create User:                            │
│     ├─ username, email, passwordHash        │
│     ├─ passwordAlgo: "argon2id-v1"          │
│     ├─ tokenVersion: 0                      │
│     └─ status: ACTIVE                       │
│  5. Call createSession()                    │
└────┬────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│       AuthService.createSession()           │
│                                             │
│  1. Generate:                               │
│     ├─ sessionId (UUID)                     │
│     ├─ refreshToken (32 random bytes)       │
│     └─ refreshTokenFamily (UUID)            │
│  2. Hash:                                   │
│     ├─ refreshTokenHash = hash(token)       │
│     ├─ ipHash = hash(req.ip)                │
│     └─ userAgentHash = hash(req.ua)         │
│  3. Create AuthSession:                     │
│     ├─ sessionId, userId, deviceId          │
│     ├─ refreshTokenHash                     │
│     ├─ refreshTokenFamily                   │
│     ├─ refreshExpiresAt = now + 30d         │
│     ├─ ipHash, userAgentHash                │
│     └─ status: ACTIVE                       │
│  4. Generate accessToken (JWT):             │
│     ├─ payload: {userId, sessionId, v: 0}   │
│     └─ expires: 15min                       │
│  5. Log: AuditLog (LOGIN_SUCCESS)           │
└────┬────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│              Response                       │
│  {                                          │
│    accessToken: "eyJ...",                   │
│    refreshToken: "abc123...",               │
│    user: {...}                              │
│  }                                          │
└─────────────────────────────────────────────┘
```

---

### 2. LOGIN FLOW
```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ POST /auth/login
     │ {identifier, password, deviceId, deviceName}
     ▼
┌─────────────────────────────────────────────┐
│          AuthController.login()             │
└────┬────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│           AuthService.login()               │
│                                             │
│  1. Find user by identifier:                │
│     └─ username OR email OR phone           │
│  2. NOT FOUND → track + throw 401           │
│  3. Check user.status:                      │
│     ├─ BANNED → throw FORBIDDEN             │
│     └─ DELETED → throw NOT_FOUND            │
│  4. Verify password:                        │
│     └─ argon2.verify(hash, password)        │
│  5. FAILED →                                │
│     ├─ Track LoginAttempt (fail)            │
│     ├─ Check rate limit (5 fails/15min)     │
│     └─ throw UNAUTHORIZED                   │
│  6. SUCCESS →                               │
│     ├─ Track LoginAttempt (success)         │
│     ├─ Find existing session (same device)  │
│     │  └─ IF exists → revoke old session    │
│     └─ Call createSession()                 │
└────┬────────────────────────────────────────┘
     │
     ▼
   (Same as Register: createSession)
```

---

### 3. REFRESH FLOW (🔥 QUAN TRỌNG NHẤT!)
```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ POST /auth/refresh
     │ {refreshToken, deviceId}
     ▼
┌─────────────────────────────────────────────────────┐
│          AuthController.refresh()                   │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│           AuthService.refresh()                     │
│                                                     │
│  1. Parse refreshToken → sessionId                  │
│  2. Find AuthSession by sessionId                   │
│  3. NOT FOUND → throw UNAUTHORIZED                  │
│                                                     │
│  4. Validate:                                       │
│     ├─ session.status === ACTIVE                    │
│     ├─ deviceId === session.deviceId (binding!)     │
│     ├─ refreshExpiresAt > now                       │
│     └─ hash(refreshToken) === refreshTokenHash      │
│                                                     │
│  5. 🚨 REUSE DETECTION:                             │
│     IF (lastRotatedAt exists &&                     │
│         now - lastRotatedAt < 5 seconds):           │
│       ┌─────────────────────────────────────┐       │
│       │  🚨 TOKEN REUSE DETECTED!           │       │
│       │  1. Revoke ALL sessions in family   │       │
│       │  2. Log: REFRESH_REUSE_DETECTED     │       │
│       │  3. throw UNAUTHORIZED              │       │
│       └─────────────────────────────────────┘       │
│                                                     │
│  6. Valid → ROTATE TOKEN:                           │
│     ├─ Generate new refreshToken                    │
│     ├─ Update session:                              │
│     │  ├─ refreshTokenHash = hash(new token)        │
│     │  ├─ lastRotatedAt = now                       │
│     │  ├─ lastSeenAt = now                          │
│     │  └─ ipHash, userAgentHash (update)            │
│     ├─ Generate new accessToken (JWT)               │
│     └─ Log: REFRESH_SUCCESS                         │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│              Response                       │
│  {                                          │
│    accessToken: "eyJ...",                   │
│    refreshToken: "xyz789..." (NEW!)         │
│  }                                          │
└─────────────────────────────────────────────┘
```

---

### 4. LOGOUT FLOW
```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ POST /auth/logout
     │ Authorization: Bearer <accessToken>
     ▼
┌─────────────────────────────────────────────┐
│     @UseGuards(JwtAuthGuard)                │
│     AuthController.logout()                 │
└────┬────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│           AuthService.logout()              │
│                                             │
│  1. Get sessionId from JWT payload          │
│  2. Update AuthSession:                     │
│     ├─ status = REVOKED                     │
│     └─ revokedAt = now                      │
│  3. Log: AuditLog (LOGOUT)                  │
└────┬────────────────────────────────────────┘
     │
     ▼
   { message: "Logged out successfully" }
```

---

### 5. LOGOUT ALL FLOW
```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ POST /auth/logout-all
     │ Authorization: Bearer <accessToken>
     ▼
┌─────────────────────────────────────────────┐
│     @UseGuards(JwtAuthGuard)                │
│     AuthController.logoutAll()              │
└────┬────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│         AuthService.logoutAll()             │
│                                             │
│  1. Get userId from JWT                     │
│  2. Increment user.tokenVersion:            │
│     └─ tokenVersion++                       │
│     └─ → Invalidate ALL JWT tokens!         │
│  3. Revoke ALL sessions:                    │
│     └─ Update all sessions (REVOKED)        │
│  4. Log: AuditLog (LOGOUT_ALL)              │
└────┬────────────────────────────────────────┘
     │
     ▼
   { message: "All sessions revoked" }
```

---

## 📋 Implementation Checklist

### ✅ **PHASE 1: Setup & DTOs**

**1.1 Install Dependencies**
```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install argon2
npm install --save-dev @types/passport-jwt
```

**1.2 Create DTOs**
- [ ] `src/modules/auth/dto/register.dto.ts`
  - username, email?, phone?, password, deviceId, deviceName?
- [ ] `src/modules/auth/dto/login.dto.ts`
  - identifier, password, deviceId, deviceName?
- [ ] `src/modules/auth/dto/refresh.dto.ts`
  - refreshToken, deviceId

**1.3 Create Response Types**
- [ ] `src/modules/auth/types/auth-response.ts`
  ```typescript
  export type AuthResponse = {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      username: string;
      email?: string;
    };
  };
  ```

---

### ✅ **PHASE 2: Auth Service - Core Logic**

**File: `src/modules/auth/auth.service.ts`**

**2.1 Helper Methods**
- [ ] `hashPassword(password: string): Promise<string>`
  - Use: `argon2.hash(password)`
- [ ] `verifyPassword(hash: string, password: string): Promise<boolean>`
  - Use: `argon2.verify(hash, password)`
- [ ] `generateRefreshToken(): string`
  - Use: `crypto.randomBytes(32).toString('hex')`
- [ ] `hashToken(token: string): string`
  - Use: `crypto.createHash('sha256').update(token).digest('hex')`
- [ ] `hashIp(ip: string): string`
- [ ] `hashUserAgent(ua: string): string`

**2.2 Main Methods**
- [ ] `register(dto: RegisterDto, req): Promise<AuthResponse>`
  1. Check if username/email exists
  2. Hash password
  3. Create User (passwordHash, passwordAlgo, tokenVersion=0)
  4. Call `createSession()`
  5. Return tokens + user

- [ ] `login(dto: LoginDto, req): Promise<AuthResponse>`
  1. Find user by identifier (username/email/phone)
  2. Check user.status
  3. Verify password
  4. Track LoginAttempt
  5. Check rate limit
  6. Revoke old session (same deviceId)
  7. Call `createSession()`
  8. Return tokens + user

- [ ] `createSession(user, deviceId, deviceName, req): Promise<AuthResponse>`
  1. Generate sessionId, refreshToken, refreshTokenFamily
  2. Hash refreshToken, ip, userAgent
  3. Create AuthSession in DB
  4. Generate accessToken (JWT)
  5. Log AuditLog (LOGIN_SUCCESS)
  6. Return { accessToken, refreshToken, user }

- [ ] `refresh(dto: RefreshDto, req): Promise<Omit<AuthResponse, 'user'>>`
  1. Find AuthSession by refreshToken
  2. Validate session (status, deviceId, expiry, hash)
  3. **Check reuse detection** (lastRotatedAt)
  4. If reuse → revoke family + throw error
  5. Rotate token:
     - Generate new refreshToken
     - Update session (hash, lastRotatedAt, lastSeenAt)
     - Generate new accessToken
  6. Log REFRESH_SUCCESS
  7. Return new tokens

- [ ] `logout(sessionId: string): Promise<void>`
  1. Update session (status=REVOKED, revokedAt=now)
  2. Log LOGOUT

- [ ] `logoutAll(userId: string): Promise<void>`
  1. Increment user.tokenVersion
  2. Revoke all sessions
  3. Log LOGOUT_ALL

**2.3 Helper Private Methods**
- [ ] `trackLoginAttempt(identifier, success, reason?, req)`
- [ ] `checkRateLimit(identifier): Promise<void>`
  - Count failed attempts in last 15 min
  - If >= 5 → throw error
- [ ] `revokeSessionFamily(familyId: string): Promise<void>`
  - Update all sessions with same refreshTokenFamily
- [ ] `logAudit(event, userId, sessionId?, meta?, req)`

---

### ✅ **PHASE 3: JWT Strategy & Guards**

**3.1 Create JWT Strategy**
- [ ] `src/modules/auth/strategies/jwt.strategy.ts`
  ```typescript
  @Injectable()
  export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private prisma: PrismaService) {
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET,
      });
    }

    async validate(payload: any) {
      // 1. Find user
      // 2. Check tokenVersion
      // 3. Check session exists & ACTIVE
      // 4. Return user (inject vào @CurrentUser)
    }
  }
  ```

**3.2 Create Guards**
- [ ] `src/common/guards/jwt-auth.guard.ts`
  ```typescript
  @Injectable()
  export class JwtAuthGuard extends AuthGuard('jwt') {}
  ```

**3.3 Create Decorators**
- [ ] `src/common/decorators/current-user.decorator.ts`
  ```typescript
  export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();
      return request.user;
    },
  );
  ```

---

### ✅ **PHASE 4: Auth Controller**

**File: `src/modules/auth/auth.controller.ts`**

- [ ] `POST /auth/register`
  ```typescript
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req) {
    return this.authService.register(dto, req);
  }
  ```

- [ ] `POST /auth/login`
  ```typescript
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req) {
    return this.authService.login(dto, req);
  }
  ```

- [ ] `POST /auth/refresh`
  ```typescript
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto, @Req() req) {
    return this.authService.refresh(dto, req);
  }
  ```

- [ ] `POST /auth/logout`
  ```typescript
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user) {
    await this.authService.logout(user.sessionId);
    return { message: 'Logged out' };
  }
  ```

- [ ] `POST /auth/logout-all`
  ```typescript
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user) {
    await this.authService.logoutAll(user.id);
    return { message: 'All sessions revoked' };
  }
  ```

- [ ] `GET /auth/me`
  ```typescript
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user) {
    return user;
  }
  ```

---

### ✅ **PHASE 5: Auth Module Setup**

**File: `src/modules/auth/auth.module.ts`**

```typescript
@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    PassportModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

**Update AppModule:**
```typescript
@Module({
  imports: [
    PrismaModule,
    AuthModule, // Add this!
  ],
  // ...
})
```

---

### ✅ **PHASE 6: Environment Variables**

**Add to `.env`:**
```env
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
```

---

## 🧪 Testing Flow

### 1. Register
```bash
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "Test1234",
  "deviceId": "device-uuid-123",
  "deviceName": "iPhone 14"
}
```

### 2. Login
```bash
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "identifier": "testuser",
  "password": "Test1234",
  "deviceId": "device-uuid-123"
}
```

### 3. Refresh
```bash
POST http://localhost:3000/auth/refresh
Content-Type: application/json

{
  "refreshToken": "abc123...",
  "deviceId": "device-uuid-123"
}
```

### 4. Access Protected Route
```bash
GET http://localhost:3000/auth/me
Authorization: Bearer eyJhbGc...
```

### 5. Test Reuse Detection
```bash
# 1. Refresh lần 1 → get new tokens
# 2. Refresh lần 2 với OLD token
# 3. Should return 401 + revoke all sessions
```

---

## 🎯 Success Criteria

- [ ] Register tạo user + session + tokens
- [ ] Login với wrong password → track failed attempts
- [ ] Login quá 5 lần sai → rate limit
- [ ] Refresh token rotation hoạt động
- [ ] Reuse detection revoke toàn bộ family
- [ ] Device binding: dùng token từ device khác → fail
- [ ] Logout revoke session
- [ ] Logout all tăng tokenVersion + revoke all
- [ ] JWT strategy verify tokenVersion
- [ ] Audit log ghi lại mọi event

---

## 🔥 Pro Tips

1. **Hash là bắt buộc:**
   - Password: argon2
   - RefreshToken: SHA-256
   - IP/UA: SHA-256 (GDPR safe)

2. **Refresh token rotation:**
   - Luôn generate token mới
   - Update lastRotatedAt
   - Check reuse trong < 5s

3. **Device binding:**
   - Client generate deviceId 1 lần (UUID)
   - Lưu trong localStorage/SecureStorage
   - Server validate mỗi request

4. **Rate limiting:**
   - Track failed attempts
   - Lock account sau N lần
   - Expire sau 15-30 phút

5. **Audit logging:**
   - Log mọi auth event
   - Dùng cho security monitoring
   - Review khi có suspicious activity

---

Good luck! 🚀
